// PixelFont — bitmap text at the three spec sizes, with integer wrapping.
//
// Each face is a PNG atlas plus an AngelCode `.fnt` descriptor baked by
// `tools/build_fonts.py`. Text is measured in whole pixels by summing glyph
// advances, never with `measureText`: that returns fractional widths and the UI
// would stop snapping to the grid. `tools/check_project.py` measures the page
// layouts with the same descriptor, so the gate and the game agree exactly.

import { parseBMFont, textWidth } from './bmfont.js'
import { loadImage, loadedImage } from './render.js'

const IMAGE_DIR = 'assets/fonts/'
const FONT_MANIFEST = 'data/fonts.json'

/** One face: metrics from the `.fnt`, pixels from the PNG. */
export class PixelFont {
  constructor(name, descriptor) {
    this.name = name
    this.image = `${IMAGE_DIR}${descriptor.page}`
    this.px = descriptor.size
    this.lineHeight = descriptor.lineHeight
    this.chars = descriptor.chars
    this.atlasWidth = descriptor.scaleW
    this.atlasHeight = descriptor.scaleH
    this.missing = '?'.charCodeAt(0)
    // A face is monospaced in practice, so one advance describes the pen step.
    const advances = [...this.chars.values()].map((glyph) => glyph.advance)
    this.advance = advances.length ? Math.max(...advances) : this.px + 1
    // `info size` is the nominal em, not the ink box: the display face is baked
    // at 2x, so a 10 px face has 14 px glyphs. Anything that sizes a surface for
    // text must use the ink box, or descenders are clipped away.
    this.inkHeight = 1
    for (const glyph of this.chars.values()) {
      this.inkHeight = Math.max(this.inkHeight, glyph.offsetY + glyph.h)
    }
  }

  /** The glyph's cell in the atlas, or the `?` cell for an unknown character. */
  glyph(character) {
    return this.chars.get(character.charCodeAt(0)) ?? this.chars.get(this.missing) ?? null
  }

  /** Ink width of a run of text, in whole pixels. */
  measure(text) {
    return textWidth(this, text)
  }

  /** Wrap `text` at `width`: lines, splitting a word only when it cannot fit. */
  wrap(text, width) {
    const limit = Math.max(1, Math.floor(width))
    const lines = []
    for (const paragraph of String(text).split('\n')) {
      let line = ''
      for (const word of paragraph.split(/\s+/).filter((word) => word.length > 0)) {
        const candidate = line ? `${line} ${word}` : word
        if (this.measure(candidate) <= limit) {
          line = candidate
          continue
        }
        if (line) {
          lines.push(line)
          line = ''
        }
        if (this.measure(word) <= limit) {
          line = word
          continue
        }
        // A single word longer than the line: cut it at the last glyph that fits.
        let rest = word
        while (rest.length > 0 && this.measure(rest) > limit) {
          let cut = rest.length - 1
          while (cut > 1 && this.measure(rest.slice(0, cut)) > limit) cut -= 1
          lines.push(rest.slice(0, cut))
          rest = rest.slice(cut)
        }
        line = rest
      }
      lines.push(line)
    }
    return lines
  }

  /** Height of a wrapped block: lines × line height, plus `lineSpacing` per gap. */
  measureBlock(text, width, lineSpacing = 0) {
    const lines = this.wrap(text, width)
    return lines.length * this.lineHeight + Math.max(0, lines.length - 1) * lineSpacing
  }

  /** Draw one glyph 1:1. Scaling a bitmap face would break the pixel grid. */
  drawGlyph(painter, character, x, y) {
    const glyph = this.glyph(character)
    if (!glyph || glyph.w <= 0 || glyph.h <= 0) return glyph ? glyph.advance : 0
    painter.image(this.image, x + glyph.offsetX, y + glyph.offsetY, { x: glyph.x, y: glyph.y, w: glyph.w, h: glyph.h })
    return glyph.advance
  }

  /** Draw a string in `colour`. Returns the pen x after the run. */
  draw(painter, text, x, y, colour = null) {
    const string = String(text)
    const left = Math.round(x)
    const top = Math.round(y)
    if (colour && string.length > 0 && loadedImage(this.image)) {
      const tinted = tintedRun(this, string, colour)
      if (tinted) {
        painter.ctx.globalAlpha = painter.globalAlpha
        painter.ctx.drawImage(tinted, left, top)
        return left + this.measure(string)
      }
    }
    let cursor = left
    for (const character of string) cursor += this.drawGlyph(painter, character, cursor, top)
    return cursor
  }

  /** Draw a wrapped block. Returns the height drawn. */
  drawBlock(painter, text, x, y, width, colour, lineSpacing = 0, align = 'left') {
    const lines = this.wrap(text, width)
    let cursor = Math.round(y)
    for (const line of lines) {
      const offset = align === 'center' ? Math.floor((width - this.measure(line)) / 2)
        : align === 'right' ? width - this.measure(line)
          : 0
      this.draw(painter, line, Math.round(x) + offset, cursor, colour)
      cursor += this.lineHeight + lineSpacing
    }
    return lines.length * this.lineHeight + Math.max(0, lines.length - 1) * lineSpacing
  }
}

// --- tinting ------------------------------------------------------------

const tintCache = new Map()
const atlases = new Map()

/**
 * The run, inked in `colour`. The atlases are baked white-on-transparent, so a
 * tint is a `source-in` fill over the assembled run: the same job the engine
 * build did with a shader material, done once per unique string and cached.
 */
function tintedRun(font, string, colour) {
  const key = `${font.image}|${colour}|${string}`
  if (tintCache.has(key)) return tintCache.get(key)
  const atlas = atlasCanvas(font)
  const width = font.measure(string)
  if (!atlas || width <= 0) return null
  const surface = document.createElement('canvas')
  surface.width = width
  surface.height = font.inkHeight
  const ctx = surface.getContext('2d')
  ctx.imageSmoothingEnabled = false
  let cursor = 0
  for (const character of string) {
    const glyph = font.glyph(character)
    if (glyph && glyph.w > 0) {
      ctx.drawImage(atlas, glyph.x, glyph.y, glyph.w, glyph.h, cursor, glyph.offsetY, glyph.w, glyph.h)
    }
    cursor += glyph ? glyph.advance : 0
  }
  // Fill the whole ink box, not the nominal em: `info size` is 10 px on the
  // display face but its glyphs are 14 px tall, so a `font.px`-high fill leaves
  // the bottom four rows white — invisible on white, and every letter short.
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = colour
  ctx.fillRect(0, 0, width, surface.height)
  tintCache.set(key, surface)
  return surface
}

/** A drawable copy of the face's PNG, so cells can be composited out of it. */
function atlasCanvas(font) {
  if (atlases.has(font.image)) return atlases.get(font.image)
  const image = loadedImage(font.image)
  if (!image) return null
  const surface = document.createElement('canvas')
  surface.width = image.width
  surface.height = image.height
  const ctx = surface.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 0, 0)
  atlases.set(font.image, surface)
  return surface
}

/**
 * Load the three faces named by `data/fonts.json`: the descriptor next to the
 * atlas. Returns `{ display, body, ui }`, keyed by the roles the kit asks for.
 */
export async function loadFonts(loader) {
  const manifest = JSON.parse(await loader(FONT_MANIFEST))
  const faces = {}
  for (const [role, name] of Object.entries(manifest.faces)) {
    const descriptor = parseBMFont(await loader(`${IMAGE_DIR}${name}.fnt`))
    const font = new PixelFont(name, descriptor)
    await loadImage(font.image)
    faces[role] = font
  }
  atlases.clear()
  tintCache.clear()
  return { ...faces, byName: Object.fromEntries(Object.values(faces).map((font) => [font.name, font])) }
}
