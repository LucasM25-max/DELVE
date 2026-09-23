// Widgets — the interactive pieces the pages are assembled from (GDD-07 §7.3).
//
// A widget owns an integer rect, a focus/hover/disabled state and its own
// drawing; screens own the layout and the focus order. Keeping the two apart is
// what lets `tools/preview_screen.py` reproduce a page from the same numbers and
// what makes the option rows a data change rather than a code change.
//
// Every widget is focusable by keyboard and clickable by pointer through the
// same `activate()` path, so a touch, a mouse and a pad all take the same route.

import { Palette } from '../core/palette.js'
import { Face, Rect, Ui } from './kit.js'

const SILENT = () => {}

export class Widget {
  constructor(rect, { id = '', focusable = true, enabled = true } = {}) {
    this.rect = rect instanceof Rect ? rect : Rect.from(rect)
    this.id = id
    this.focusable = focusable
    this.enabled = enabled
    this.hovered = false
    this.focused = false
    this.visible = true
    this.onActivate = SILENT
    this.onFocus = SILENT
    this.onHover = SILENT
  }

  hit(px, py) {
    return this.visible && this.rect.contains(px, py)
  }

  setFocus(value) {
    if (this.focused === value) return
    this.focused = value
    if (value) this.onFocus(this)
  }

  activate() {
    if (!this.visible || !this.enabled) return false
    this.onActivate(this)
    return true
  }

  /** Pointer feedback: called by the screen's pointer handler. */
  setHovered(value) {
    if (this.hovered === value) return
    this.hovered = value
    if (value) this.onHover(this)
  }

  draw() {}
}

// --- buttons ------------------------------------------------------------

/**
 * A nine-patch button. `style` is `button`, `button_blood` (destructive) or a
 * pill (segmented controls), which is how DELETE and BREAK get the §5.5 blood
 * face and everything else the parchment one.
 */
export class Button extends Widget {
  constructor(rect, label, options = {}) {
    super(rect, options)
    this.label = label
    this.style = options.style ?? 'button'
    this.face = options.face ?? Face.UI
    this.colour = options.colour ?? Palette.ink
    this.disabledColour = options.disabledColour ?? Palette.stone_1
    this.align = options.align ?? 'center'
    this.held = false
  }

  state() {
    if (!this.enabled) return 'disabled'
    if (this.held) return 'pressed'
    return this.focused || this.hovered ? 'hover' : 'normal'
  }

  setLabel(label) {
    this.label = label
  }

  draw() {
    if (!this.visible) return
    const style = this.style.startsWith('pill') ? 'pill' : this.style
    const state = this.style.startsWith('pill')
      ? (this.focused || this.hovered ? (this.selected ? 'selected' : 'hover') : this.selected ? 'selected' : 'normal')
      : this.state()
    const patchId = this.style.startsWith('pill_') ? this.style.replace(/_(normal|selected|hover)$/, '') : style
    Ui.patch(patchId, this.rect, { state })
    const font = Ui.font(this.face)
    const label = this.label
    const y = Math.round(this.rect.y + (this.rect.h - font.lineHeight) / 2)
    const colour = this.enabled ? (this.selected ? Palette.ink : this.colour) : this.disabledColour
    if (this.align === 'center') {
      const x = Math.round(this.rect.x + (this.rect.w - font.measure(label)) / 2)
      Ui.label(label, x, y, { face: this.face, colour })
    } else {
      Ui.label(label, this.rect.x + 6, y, { face: this.face, colour })
    }
  }
}

/** A plain list row: the menu items and the ledger slots. */
export class ListRow extends Widget {
  constructor(rect, label, options = {}) {
    super(rect, options)
    this.label = label
    this.face = options.face ?? Face.DISPLAY
    this.colour = options.colour ?? Palette.ink
    this.tracking = options.tracking ?? null // null: whatever the face declares
    this.disabledColour = options.disabledColour ?? Palette.stone_1
    this.disabledDim = options.disabledDim ?? 0.4
    // The rows a menu does not have its cursor on sit back a little, so the
    // focused one reads as chosen rather than as one of five equals.
    this.idleDim = options.idleDim ?? 1
    this.underline = options.underline ?? null // {colour, offsetY, height, progress}
    this.trailing = options.trailing ?? '' // e.g. the ledger's DELETE affordance
    this.trailingColour = options.trailingColour ?? Palette.bronze_1
  }

  /** Ink width of the label, tracking included: the underline follows the word. */
  get labelWidth() {
    return Ui.measure(this.label, null, this.face, 0, this.tracking)
  }

  draw() {
    if (!this.visible) return
    const focused = this.focused || this.hovered
    const colour = this.enabled ? this.colour : this.disabledColour
    const alpha = this.enabled ? (focused ? 1 : this.idleDim) : this.disabledDim
    Ui.label(this.label, this.rect.x, this.rect.y, { face: this.face, colour, alpha, tracking: this.tracking })
    if (focused && this.enabled) this.drawCursor()
    if (this.underline && focused && this.enabled) {
      const info = this.underline
      const width = Math.round(Math.min(this.labelWidth, this.rect.w) * Math.min(1, Math.max(0, info.progress ?? 1)))
      Ui.rect(Rect.of(this.rect.x, this.rect.y + (info.offsetY ?? 14), width, info.height ?? 2), info.colour ?? Palette.bronze_2)
    }
    if (this.trailing && this.enabled) {
      Ui.labelRight(this.trailing, this.rect.right - 4, this.rect.y, { face: Face.UI, colour: this.trailingColour })
    }
  }

  /** The selection mark: the kit's 10×10 cursor, vertically centred on the row. */
  drawCursor() {
    const size = Ui.spriteSize('item_cursor', [10, 10])
    const x = this.rect.x - 14
    const y = Math.round(this.rect.y + (this.rect.h - size[1]) / 2) + 1
    Ui.sprite('item_cursor', x, y)
  }
}

// --- controls -----------------------------------------------------------

/** PILL_HEIGHT and the padding the spec's pill groups use (§5.5). */
export const PILL_HEIGHT = 16
export const PILL_GAP = 4
export const PILL_PADDING = 6

/** Total width of a pill row: each label plus 6 px of padding, 4 px between. */
export function pillGroupWidth(values, face = Face.UI) {
  const font = Ui.font(face)
  return values.reduce((sum, value) => sum + font.measure(value) + PILL_PADDING + PILL_GAP, 0) - PILL_GAP
}

/** A segmented control: pills in a row, one selected (§5.5, §5.6). */
export class PillGroup extends Widget {
  constructor(rect, values, selectedIndex = 0, options = {}) {
    super(rect, options)
    this.gap = options.gap ?? PILL_GAP
    this.face = options.face ?? Face.UI
    const font = Ui.font(this.face)
    let cursor = rect.x
    this.pills = values.map((value, index) => {
      const w = options.widths ? options.widths[index] : font.measure(value) + PILL_PADDING
      const pill = { value, index, rect: Rect.of(cursor, rect.y, w, rect.h) }
      cursor += w + this.gap
      return pill
    })
    this.index = selectedIndex
    this.enabledPill = options.enabledPill ?? (() => true)
    this.onChange = options.onChange ?? SILENT
  }

  get value() {
    return this.pills[this.index]?.value
  }

  setIndex(index, notify = true) {
    const next = Math.max(0, Math.min(this.pills.length - 1, index))
    if (next === this.index) return
    this.index = next
    if (notify) this.onChange(this.value, next)
  }

  setValue(value, notify = true) {
    const index = this.pills.findIndex((pill) => pill.value === value)
    if (index >= 0) this.setIndex(index, notify)
  }

  /** Left/right from the keyboard walks the pills, skipping disabled ones. */
  step(direction) {
    let index = this.index
    for (let step = 0; step < this.pills.length; step += 1) {
      index = (index + direction + this.pills.length) % this.pills.length
      if (this.enabledPill(this.pills[index].value)) break
    }
    this.setIndex(index)
  }

  pillAt(px, py) {
    return this.pills.find((pill) => pill.rect.contains(px, py))
  }

  hit(px, py) {
    return this.visible && this.enabled && this.pillAt(px, py) !== undefined
  }

  activate() {
    return false // a pill group is chosen pointwise, not activated
  }

  pointerDown(px, py) {
    const pill = this.pillAt(px, py)
    if (!pill || !this.enabledPill(pill.value)) return false
    this.setIndex(pill.index)
    return true
  }

  draw() {
    if (!this.visible) return
    for (const pill of this.pills) {
      const usable = this.enabledPill(pill.value)
      const selected = pill.index === this.index
      const state = !usable ? 'normal' : selected ? 'selected' : (this.focused || this.hovered) ? 'hover' : 'normal'
      Ui.patch('pill', pill.rect, { state, alpha: usable ? 1 : this.disabledPillAlpha ?? 0.4,  })
      const font = Ui.font(this.face)
      const colour = selected ? Palette.ink : usable ? Palette.bronze_3 : Palette.stone_1
      Ui.label(pill.value, Math.round(pill.rect.x + (pill.rect.w - font.measure(pill.value)) / 2),
        Math.round(pill.rect.y + (pill.rect.h - font.lineHeight) / 2), { face: this.face, colour, alpha: usable ? 1 : 0.6 })
    }
  }
}

/** A 10-pip volume slider (§5.6 Audio). Click a pip; left/right nudges one step. */
export class Slider extends Widget {
  constructor(rect, options = {}) {
    super(rect, options)
    this.min = options.min ?? 0
    this.max = options.max ?? 100
    this.pips = options.pips ?? 10
    this.value = options.value ?? this.min
    this.colour = options.colour ?? Palette.bronze_2
    this.emptyColour = options.emptyColour ?? Palette.stone_1
    this.onChange = options.onChange ?? SILENT
  }

  get step() {
    return (this.max - this.min) / this.pips
  }

  setValue(value, notify = true) {
    const clamped = Math.max(this.min, Math.min(this.max, Math.round(value)))
    if (clamped === this.value) return
    this.value = clamped
    if (notify) this.onChange(clamped)
  }

  /** 0..pips lit pips for the current value. */
  litPips() {
    const span = Math.max(1, this.max - this.min)
    return Math.round(((this.value - this.min) / span) * this.pips)
  }

  /** Pip `index`'s rect: 5 px wide, 3 px gap, vertically centred in the row. */
  pipRect(index) {
    const width = 5
    const gap = 3
    const total = this.pips * width + (this.pips - 1) * gap
    const x = this.rect.right - total + index * (width + gap)
    return Rect.of(x, this.rect.y + Math.round((this.rect.h - 8) / 2) - 1, width, 8)
  }

  valueForPip(px) {
    let best = 0
    let bestDistance = Infinity
    for (let index = 0; index < this.pips; index += 1) {
      const distance = Math.abs(this.pipRect(index).centerX - px)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    }
    return this.min + (best + 1) * this.step === this.max ? this.max : Math.round(this.min + (best + 1) * this.step)
  }

  step_by(direction) {
    this.setValue(this.value + direction * this.step)
  }

  hit(px, py) {
    return this.visible && this.enabled && this.rect.contains(px, py)
  }

  pointerDown(px, py) {
    this.setValue(this.valueForPip(px))
    return true
  }

  draw() {
    if (!this.visible) return
    const lit = this.litPips()
    for (let index = 0; index < this.pips; index += 1) {
      const rect = this.pipRect(index)
      Ui.rect(rect, index < lit ? this.colour : this.emptyColour, index < lit ? 1 : 0.45)
    }
    const font = Ui.font(Face.UI)
    const text = String(this.value)
    Ui.label(text, Math.round(this.pipRect(0).x - 8 - font.measure(text)), this.rect.y + Math.round((this.rect.h - font.lineHeight) / 2),
      { face: Face.UI, colour: Palette.ink })
    if (this.focused) Ui.frame(this.rect, Palette.bronze_2, 0.6)
  }
}

/** A key-capture control: shows the bound key, captures the next press (§5.6). */
export class Rebind extends Widget {
  constructor(rect, options = {}) {
    super(rect, options)
    this.label = options.label ?? ''
    this.listening = false
    this.onChanged = options.onChanged ?? SILENT
    this.onCancel = options.onCancel ?? SILENT
  }

  startListening(listenText) {
    this.listening = true
    this.listenText = listenText
  }

  cancel() {
    if (!this.listening) return
    this.listening = false
    this.onCancel()
  }

  capture(code) {
    if (!this.listening) return false
    this.listening = false
    this.label = code
    this.onChanged(code)
    return true
  }

  hit(px, py) {
    return super.hit(px, py)
  }

  draw() {
    if (!this.visible) return
    const listening = this.listening
    const rect = this.rect
    Ui.patch('button', rect, { state: listening ? 'hover' : this.focused || this.hovered ? 'hover' : 'normal' })
    const font = Ui.font(Face.UI)
    const text = listening ? (this.listenText ?? 'Press a key…') : this.label
    const colour = listening ? Palette.bronze_1 : Palette.ink
    if (listening) {
      Ui.label(text, rect.x + 6, rect.y + Math.round((rect.h - font.lineHeight) / 2), { face: Face.UI, colour })
    } else {
      Ui.label(text, Math.round(rect.right - 6 - font.measure(text)), rect.y + Math.round((rect.h - font.lineHeight) / 2), { face: Face.UI, colour })
    }
  }
}

/** A read-only row: the spec's "locked" control (§5.6 Fast travel). */
export class LockedLabel extends Widget {
  constructor(rect, options = {}) {
    super(rect, { ...options, focusable: false })
    this.text = options.text ?? ''
    this.face = options.face ?? Face.UI
    this.colour = options.colour ?? Palette.stone_1
  }

  draw() {
    if (!this.visible) return
    Ui.labelRight(this.text, this.rect.right - 6, this.rect.y + Math.round((this.rect.h - Ui.font(this.face).lineHeight) / 2),
      { face: this.face, colour: this.colour, alpha: 0.8 })
  }
}

/** A hover tooltip: a parchment box under the anchor (§5.4 CONTINUE, §5.5 pill). */
export class Tooltip extends Widget {
  constructor(rect, text, options = {}) {
    super(rect, { ...options, focusable: false })
    this.text = text
    this.face = options.face ?? Face.UI
    this.visible = false
  }

  setText(text) {
    this.text = text
  }

  draw() {
    if (!this.visible || !this.text) return
    const font = Ui.font(this.face)
    const width = font.measure(this.text) + 8
    const rect = Rect.of(this.rect.x, this.rect.y, width, font.lineHeight + 6)
    Ui.patch('tooltip', rect, { state: null })
    Ui.label(this.text, rect.x + 4, rect.y + 3, { face: this.face, colour: Palette.ink })
  }
}

// --- cards --------------------------------------------------------------

/** The modal card the ledger confirms and the stub pages open (§5.5). */
export class Card {
  constructor(rect, { style = 'panel_parchment', dim = 0.5 } = {}) {
    this.rect = rect instanceof Rect ? rect : Rect.from(rect)
    this.style = style
    this.dim = dim
    this.visible = true
  }

  draw() {
    if (!this.visible) return
    Ui.dim(this.dim)
    Ui.panel(this.style, this.rect)
  }
}

export { Palette }
