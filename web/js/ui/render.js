// Painter — the game's 480×270 design space, and every primitive the UI kit
// draws with.
//
// Layout is still written in the spec's base resolution (GDD-06 §1.3): a rect at
// (29, 92) is at (29, 92) whatever the window is. The canvas itself is the
// window, and `setViewport` installs the one transform that maps design pixels
// onto it — a single scale that fills the viewport, with the remainder split
// between the two sides. Vector text is rasterised at that scale, so it is crisp
// at any window size; pixel art is blitted with smoothing off, so it stays
// nearest-neighbour.
//
// All drawing goes through this file, which is what keeps "art is locked to the
// palette" and "the shell paints nothing itself" enforceable.

import { Palette } from '../core/palette.js'

export const WIDTH = 480
export const HEIGHT = 270

/**
 * Fit the 480×270 design space to a viewport, in device pixels.
 *
 * One uniform scale — the largest that fits — so the design keeps its
 * proportions and reaches two of the four edges; the remainder is split between
 * the other two and painted by the screen's own ground. Pure, so the sizing rule
 * is testable without a browser (`web/tests/run.mjs`).
 */
export function fitViewport(deviceWidth, deviceHeight) {
  const width = Math.max(1, Number(deviceWidth))
  const height = Math.max(1, Number(deviceHeight))
  const scale = Math.min(width / WIDTH, height / HEIGHT)
  return {
    width,
    height,
    scale,
    x: Math.round((width - WIDTH * scale) / 2),
    y: Math.round((height - HEIGHT * scale) / 2),
  }
}

/** Loaded images, keyed by path. */
const images = new Map()

export function resolveAsset(path) {
  return path.startsWith('assets/') ? path : `assets/${path}`
}

/** Load one image; resolves to null when it is missing (callers guard). */
export function loadImage(path) {
  const url = resolveAsset(path)
  if (images.has(url)) return images.get(url)
  const promise = new Promise((resolve) => {
    const image = new Image()
    // The map swaps the promise for the image the moment it decodes, so
    // `getImage()` starts returning pixels instead of "still loading".
    image.onload = () => {
      images.set(url, image)
      resolve(image)
    }
    image.onerror = () => {
      console.error(`Painter: missing image ${url}`)
      images.set(url, null)
      resolve(null)
    }
    image.src = url
  })
  images.set(url, promise)
  return promise
}

/** The image if it has finished loading, else null. Never starts a fetch. */
export function loadedImage(path) {
  const entry = images.get(resolveAsset(path))
  return entry && !(entry instanceof Promise) ? entry : null
}

/** Load every image the kit and the screens name, before the first frame. */
export async function preloadImages(paths) {
  await Promise.all(paths.map((path) => loadImage(path)))
}

export class Painter {
  constructor(ctx) {
    this.ctx = ctx
    this.ctx.imageSmoothingEnabled = false
    /** Alpha applied to every primitive (screens dim panels by drawing twice). */
    this.globalAlpha = 1
    /** Design pixels -> device pixels: the scale that fills the window, and the
     *  offset that centres the design space inside it. */
    this.viewport = { scale: 1, x: 0, y: 0 }
    this._clips = []
  }

  /** Resolve a loaded image synchronously; `null` until `loadImage` resolves. */
  getImage(path) {
    const entry = images.get(resolveAsset(path))
    return entry instanceof Promise ? null : entry
  }

  /**
   * Tell the painter how the design space sits on the canvas. Called from
   * `Shell.resize()`; every later primitive is in design coordinates.
   */
  setViewport(viewport) {
    this.viewport = { ...this.viewport, ...viewport }
    const { scale, x, y } = this.viewport
    this.ctx.setTransform(scale, 0, 0, scale, x, y)
    this.ctx.imageSmoothingEnabled = false
  }

  /**
   * Fill everything the player can see, in device pixels: page grounds and the
   * letterbox bands are drawn here, so a window that is not 16:9 shows the
   * screen's own colour to its edges instead of bars.
   */
  fillViewport(colour, alpha = 1) {
    const ctx = this.ctx
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = alpha
    ctx.fillStyle = colour
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
    ctx.setTransform(this.viewport.scale, 0, 0, this.viewport.scale, this.viewport.x, this.viewport.y)
  }

  clear(colour) {
    this.fillViewport(colour)
  }

  withAlpha(alpha, draw) {
    const previous = this.globalAlpha
    this.globalAlpha = alpha
    draw()
    this.globalAlpha = previous
  }

  rect(x, y, w, h, colour) {
    if (w <= 0 || h <= 0) return
    this.ctx.globalAlpha = this.globalAlpha
    this.ctx.fillStyle = colour
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  /**
   * One run of text, pen at (x, baseline). `js/ui/font.js` draws a glyph at a
   * time so that text lands on whole design pixels; the font string is the
   * face's own (`600 9px "Delve Sans", …`), declared by the stylesheet.
   */
  text(string, x, y, colour = null, font = null) {
    if (string === null || string === undefined || String(string).length === 0) return
    const ctx = this.ctx
    ctx.globalAlpha = this.globalAlpha
    if (font) ctx.font = font
    ctx.fillStyle = colour ?? Palette.ink
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(String(string), Math.round(x), Math.round(y))
  }

  /** Draw an image 1:1 at (x, y), optionally a source region of it. */
  image(path, x, y, source = null) {
    const image = this.getImage(path)
    if (!image) return
    this.ctx.globalAlpha = this.globalAlpha
    if (source) {
      this.ctx.drawImage(image, source.x, source.y, source.w, source.h, Math.round(x), Math.round(y), source.w, source.h)
    } else {
      this.ctx.drawImage(image, Math.round(x), Math.round(y))
    }
  }

  /**
   * Nine-patch: the four corners 1:1, the four edges stretched along their axis,
   * the middle stretched. Every panel in the kit has a flat interior (the art
   * lint proves it), so stretching is pixel-identical to tiling — and it is nine
   * `drawImage` calls instead of one per pixel-run, which matters at 60 fps.
   * `tools/preview_screen.py` draws the same nine slices to the same margins.
   */
  nine(imagePath, margin, x, y, w, h) {
    const image = this.getImage(imagePath)
    if (!image) return
    x = Math.round(x)
    y = Math.round(y)
    w = Math.round(w)
    h = Math.round(h)
    if (w <= 0 || h <= 0) return
    const size = image.width
    // A small rect (a 4 px scrollbar, a 16 px pill) cannot hold the full margin.
    const edge = Math.max(1, Math.min(margin, Math.floor(size / 2), Math.floor(w / 2), Math.floor(h / 2)))
    const inner = size - edge * 2
    const far = size - edge
    const across = w - edge * 2
    const down = h - edge * 2
    const ctx = this.ctx
    ctx.globalAlpha = this.globalAlpha
    const slice = (sx, sy, sw, sh, dx, dy, dw, dh) => {
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return
      ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
    }
    slice(0, 0, edge, edge, x, y, edge, edge)
    slice(far, 0, edge, edge, x + w - edge, y, edge, edge)
    slice(0, far, edge, edge, x, y + h - edge, edge, edge)
    slice(far, far, edge, edge, x + w - edge, y + h - edge, edge, edge)
    slice(edge, 0, inner, edge, x + edge, y, across, edge)
    slice(edge, far, inner, edge, x + edge, y + h - edge, across, edge)
    slice(0, edge, edge, inner, x, y + edge, edge, down)
    slice(far, edge, edge, inner, x + w - edge, y + edge, edge, down)
    slice(edge, edge, inner, inner, x + edge, y + edge, across, down)
  }

  /** A 1 px frame, used for the debug grid and the focus marks. */
  frame(x, y, w, h, colour) {
    this.rect(x, y, w, 1, colour)
    this.rect(x, y + h - 1, w, 1, colour)
    this.rect(x, y, 1, h, colour)
    this.rect(x + w - 1, y, 1, h, colour)
  }
}

export const Colours = Palette
