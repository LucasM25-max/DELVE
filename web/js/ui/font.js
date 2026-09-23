// TextFace — the shell's type: a real webfont, measured in whole pixels.
//
// Each face is one size of one family (the `@font-face` rules live in
// `css/shell.css`, the sizes and vertical metrics in `data/fonts.json`):
//
//   `px`          the em size in game pixels;
//   `ascent`      the baseline offset from the top of the line box;
//   `descent`     the room below the baseline;
//   `lineHeight`  the step between wrapped lines.
//
// Advances come from `assets/fonts/font_metrics.json` — per-character widths in
// font units, baked from the shipped font by `tools/build_text_faces.py`. A
// character is drawn on its own, at an integer pen position, so the width the
// layout measures and the width the page inks are the same integer; nothing here
// calls `measureText`, which returns fractional widths and would drift the UI off
// the grid. `tools/check_project.py` measures the page layouts from the same
// table, so the gate and the page agree exactly.

import { loadJSON } from '../core/data.js'

const FONT_DIR = 'assets/fonts/'
const FONT_MANIFEST = 'data/fonts.json'
const FONT_METRICS = `${FONT_DIR}font_metrics.json`

export class TextFace {
  constructor(role, family, definition, source) {
    this.role = role
    this.family = family
    this.file = `${FONT_DIR}${source.file}`
    this.weight = Number(source.weight)
    this.px = Number(definition.size)
    this.ascent = Number(definition.ascent)
    this.descent = Number(definition.descent)
    this.lineHeight = Number(definition.lineHeight)
    this.inkHeight = this.ascent + this.descent
    this.unitsPerEm = Number(source.unitsPerEm)
    this.advances = source.advances ?? {}
    // A character the face carries no advance for (a fallback glyph the browser
    // substitutes) still needs a width: half an em is the usual guess.
    this.fallbackAdvance = Math.max(1, Math.round(this.px * 0.5))
    this.font = `${this.weight} ${this.px}px "${family}", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  }

  /** Advance width of one character, in whole pixels. */
  advance(character) {
    const units = this.advances[character.charCodeAt(0)]
    if (units === undefined) return this.fallbackAdvance
    return Math.max(1, Math.round((units * this.px) / this.unitsPerEm))
  }

  /** Ink width of a run of text, in whole pixels. */
  measure(text) {
    let width = 0
    for (const character of String(text)) width += this.advance(character)
    return width
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

  /** Draw one glyph with its pen at (x, baseline). Returns the advance. */
  drawGlyph(painter, character, x, y, colour) {
    painter.text(character, x, y, colour, this.font)
    return this.advance(character)
  }

  /** Draw a string with its line box top-left at (x, y). Returns the pen x. */
  draw(painter, text, x, y, colour = null) {
    const string = String(text)
    const left = Math.round(x)
    const baseline = Math.round(y) + this.ascent
    let cursor = left
    for (const character of string) cursor += this.drawGlyph(painter, character, cursor, baseline, colour)
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

/**
 * Load the faces named by `data/fonts.json`.
 *
 * The webfonts themselves arrive through the stylesheet; this only parses the
 * metrics and asks the browser to have each weight ready before the first frame,
 * so the first paint is never a fallback face. In Node (the smoke and shot
 * suites) there is no `document.fonts`, and the metrics table is all those
 * suites need to measure and place text.
 */
export async function loadFonts(loader) {
  const manifest = JSON.parse(await loader(FONT_MANIFEST))
  const metrics = JSON.parse(await loader(FONT_METRICS))
  const faces = {}
  for (const [role, definition] of Object.entries(manifest.faces)) {
    const source = metrics.sources[definition.source]
    if (!source) throw new Error(`data/fonts.json: no metrics for source ${definition.source}`)
    faces[role] = new TextFace(role, manifest.family, definition, source)
  }
  if (typeof document !== 'undefined' && document.fonts?.load) {
    await Promise.all(Object.values(faces).map((face) => document.fonts.load(face.font)))
  }
  return { ...faces, byRole: Object.fromEntries(Object.values(faces).map((face) => [face.role, face])) }
}
