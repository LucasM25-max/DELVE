// UiPixel — the pixel UI kit (GDD-07 §7.3).
//
// Everything the shell draws is built from these primitives: a ground, a
// nine-patch panel, a text label, a 5 px pill. The kit is the only place that
// knows an asset path, and it reads the nine-patch margins from
// `assets/pixel/ui/ui_kit.json` — the same file `tools/preview_screen.py`
// renders from, so the offline previews and the live page agree.
//
// Rules the kit keeps:
//   * art is locked to the 32 + 8 palette (tools/check_project.py lints the PNGs);
//   * rects snap to whole pixels, so nothing is ever drawn half-on a pixel;
//   * chrome (buttons, frames, rails) is the `ui` face, body copy is `body`,
//     headings are `display` (the §7.3 roles, at the sizes in data/fonts.json).

import { Palette } from '../core/palette.js'
import { loadJSON } from '../core/data.js'

export const UI_DIR = 'assets/pixel/ui/'
export const BMP_DIR = 'assets/pixel/' // palette ramps, standalone sprites

/** Face names, resolved from the loaded font manifests. */
export const Face = { DISPLAY: 'display', BODY: 'body', UI: 'ui' }

/** A plain integer rect. Screens keep their geometry in these and nothing else. */
export class Rect {
  constructor(x = 0, y = 0, w = 0, h = 0) {
    this.x = Number(x)
    this.y = Number(y)
    this.w = Number(w)
    this.h = Number(h)
  }

  static from(array, fallback = [0, 0, 0, 0]) {
    const source = Array.isArray(array) && array.length === 4 ? array : fallback
    return new Rect(source[0], source[1], source[2], source[3])
  }

  static of(x, y, w, h) {
    return new Rect(x, y, w, h)
  }

  get right() { return this.x + this.w }
  get bottom() { return this.y + this.h }
  get centerX() { return Math.round(this.x + this.w / 2) }
  get centerY() { return Math.round(this.y + this.h / 2) }

  contains(px, py) {
    return px >= this.x && px < this.right && py >= this.y && py < this.bottom
  }

  inside(other) {
    return this.x >= other.x && this.y >= other.y && this.right <= other.right && this.bottom <= other.bottom
  }

  eq(array) {
    return this.x === array[0] && this.y === array[1] && this.w === array[2] && this.h === array[3]
  }
}

export const Ui = {
  painter: null,
  fonts: {},
  kit: { styles: {}, sprites: {} },

  /** Called once by the shell: the canvas painter, the faces, the nine-patch kit. */
  async install(painter, fonts) {
    this.painter = painter
    this.fonts = fonts
    this.kit = await loadJSON(`${UI_DIR}ui_kit.json`)
  },

  font(face) {
    return this.fonts[face] ?? this.fonts.body
  },

  // --- surfaces ---------------------------------------------------------

  /** Fill the whole canvas. `ground` is what each screen calls. */
  ground(colour) {
    this.painter.clear(colour)
  },

  /**
   * The shipped menu ground: plain white. The project's background rule predates
   * this port and the spec's ink ground is kept for the boot pages, so this is a
   * documented, deliberate deviation (see web/docs/PIXEL_MENU_BUILD_NOTES.md).
   * Grounds fill the whole window, not just the 480×270 design space.
   */
  white(alpha = 1) {
    this.painter.fillViewport('#FFFFFF', alpha)
  },

  /** A translucent scrim behind a modal card; covers the whole window. */
  dim(alpha = 0.5, colour = Palette.ink) {
    if (alpha <= 0) return
    this.painter.fillViewport(colour, alpha)
  },

  rect(rect, colour, alpha = 1) {
    if (alpha <= 0 || rect.w <= 0 || rect.h <= 0) return
    this.painter.withAlpha(alpha, () => this.painter.rect(rect.x, rect.y, rect.w, rect.h, colour))
  },

  frame(rect, colour, alpha = 1) {
    this.painter.withAlpha(alpha, () => this.painter.frame(rect.x, rect.y, rect.w, rect.h, colour))
  },

  image(path, x, y, { region = null, alpha = 1 } = {}) {
    if (alpha <= 0) return
    this.painter.withAlpha(alpha, () => this.painter.image(path, x, y, region))
  },

  sprite(id, x, y, alpha = 1) {
    const sprite = this.kit.sprites?.[id]
    if (!sprite) return
    this.image(`${UI_DIR}${sprite.file}`, x, y, { alpha })
  },

  spriteSize(id, fallback = [0, 0]) {
    return this.kit.sprites?.[id]?.size ?? fallback
  },

  /** A nine-patch style by id (`panel_parchment`, `button`, `pill`, …). */
  patch(styleId, rect, { state = null, alpha = 1 } = {}) {
    const style = this.kit.styles?.[styleId]
    if (!style || rect.w <= 0 || rect.h <= 0) return
    const file = state ? style.file.replace('{state}', style.states?.includes(state) ? state : style.states?.[0] ?? state) : style.file
    this.painter.withAlpha(alpha, () => {
      this.painter.nine(`${UI_DIR}${file}`, style.margin ?? 4, rect.x, rect.y, rect.w, rect.h)
    })
  },

  /** The three panel styles the pages use, by the spec's own names. */
  panel(style, rect, alpha = 1) {
    this.patch(style, rect, { alpha })
  },

  /**
   * A one-pixel scrollbar: track, then thumb sized and positioned from
   * `scroll`/`visible`/`total`. Invisible when everything fits.
   */
  scrollbar(rect, scroll, visible, total, { trackAlpha = 0.35 } = {}) {
    if (total <= visible || rect.h <= 0) return
    this.patch('scrollbar', new Rect(rect.x, rect.y, 4, rect.h), { state: 'track', alpha: trackAlpha })
    const thumbH = Math.max(12, Math.round((visible / total) * rect.h))
    const maxScroll = Math.max(1, total - visible)
    const thumbY = rect.y + Math.round((Math.max(0, Math.min(scroll, maxScroll)) / maxScroll) * (rect.h - thumbH))
    this.patch('scrollbar', new Rect(rect.x, thumbY, 4, thumbH), { state: 'thumb' })
  },

  // --- text -------------------------------------------------------------

  label(text, x, y, { face = Face.UI, colour = Palette.ink, width = null, align = 'left', lineSpacing = 0, alpha = 1 } = {}) {
    const font = this.font(face)
    if (alpha <= 0 || text === '') return 0
    this.painter.withAlpha(alpha, () => {
      if (width === null) font.draw(this.painter, text, x, y, colour)
      else font.drawBlock(this.painter, text, x, y, width, colour, lineSpacing, align)
    })
    return width === null ? font.measure(text) : font.measureBlock(text, width, lineSpacing)
  },

  /** Right-align a run against `rightX` (the option rows' control gutter). */
  labelRight(text, rightX, y, options = {}) {
    const font = this.font(options.face ?? Face.UI)
    return this.label(text, rightX - font.measure(text), y, options)
  },

  measure(text, width = null, face = Face.UI, lineSpacing = 0) {
    const font = this.font(face)
    return width === null ? font.measure(text) : font.measureBlock(text, width, lineSpacing)
  },

  wrap(text, width, face = Face.UI) {
    return this.font(face).wrap(text, width)
  },
}
