// Painter — the 480×270 canvas, its integer scale, and every primitive the UI
// kit draws with.
//
// One canvas holds the whole game at the spec's base resolution (GDD-06 §1.3);
// CSS scales it by a whole number, so a pixel is always an exact square of screen
// pixels and the frame never resamples. All drawing goes through this file, which
// is what keeps "art is locked to the palette" and "text is bitmap" enforceable.

import { Palette } from '../core/palette.js'

export const WIDTH = 480
export const HEIGHT = 270

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
    this._clips = []
  }

  /** Resolve a loaded image synchronously; `null` until `loadImage` resolves. */
  getImage(path) {
    const entry = images.get(resolveAsset(path))
    return entry instanceof Promise ? null : entry
  }

  clear(colour) {
    this.ctx.globalAlpha = 1
    this.ctx.fillStyle = colour
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT)
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
   * Nine-patch: the four corners 1:1, the edges stretched along one axis, and the
   * middle tiled — the same treatment `tools/preview_screen.py` applies, so the
   * offline previews and the game agree pixel for pixel.
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
    const middle = size - margin * 2
    const sourceY = (py) => {
      if (py < margin) return py
      if (py >= h - margin) return size - (h - py)
      return margin + ((py - margin) % middle)
    }
    const sourceX = (px) => {
      if (px < margin) return px
      if (px >= w - margin) return size - (w - px)
      return margin + ((px - margin) % middle)
    }
    this.ctx.globalAlpha = this.globalAlpha
    // Rows first, so the per-row y lookup is computed once per scanline.
    const rows = []
    let runStart = 0
    for (let py = 1; py <= h; py += 1) {
      if (py === h || sourceY(py) !== sourceY(runStart)) {
        rows.push([runStart, py - runStart, sourceY(runStart)])
        runStart = py
      }
    }
    for (const [rowY, rowH, sy] of rows) {
      let runX = 0
      for (let px = 1; px <= w; px += 1) {
        if (px === w || sourceX(px) !== sourceX(runX)) {
          const length = px - runX
          this.ctx.drawImage(image, sourceX(runX), sy, 1, 1, x + runX, y + rowY, length, rowH)
          runX = px
        }
      }
    }
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
