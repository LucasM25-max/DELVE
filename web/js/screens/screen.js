// ShellScreen — the base every page extends (GDD-07 §5).
//
// A screen owns one page of the shell: its widgets, its layout numbers (read
// from `data/shell_timings.json`, never hard-coded), its update and its draw.
// Screens never talk to each other; they ask `go_to()`, and the shell swaps the
// page. The base class supplies the parts every page shares: focus walking,
// pointer routing, the block helper and the fade-out timing.

import { Palette } from '../core/palette.js'
import { GameState, State } from '../core/state.js'
import { ShellData } from '../core/data.js'
import { Sound } from '../core/sound.js'
import { Face, Rect, Ui } from '../ui/kit.js'

export class ShellScreen {
  constructor(shell) {
    this.shell = shell
    this.widgets = []
    this.focusIndex = -1
    this.inputLocked = false
    this.visible = false
    this.built = false
    this.layout = {}
  }

  // --- lifecycle --------------------------------------------------------

  /** Build the page's widget list once, after the assets are loaded. */
  build() {}

  /** The page is about to be shown. `payload` is whatever the previous page passed. */
  enter(_payload = {}) {
    this.inputLocked = false
  }

  /** The page is being hidden. */
  exit() {}

  /** Called every frame with seconds since the last frame. */
  update(_delta) {}

  /** Called every frame; draw into the shared painter. */
  draw() {}

  // --- helpers ----------------------------------------------------------

  /** A rect from the screen's timing block, with a documented fallback. */
  rect(key, fallback) {
    const raw = this.layout?.[key]
    return Rect.from(Array.isArray(raw) ? raw : fallback)
  }

  t(id, args = []) {
    return ShellData.t(id, args)
  }

  /** Navigate. The shell does the fade and the swap. */
  go_to(state, payload = {}) {
    this.shell.go_to(state, payload)
  }

  add(widget) {
    this.widgets.push(widget)
    return widget
  }

  addAll(widgets) {
    this.widgets.push(...widgets)
    return widgets
  }

  remove(widget) {
    const index = this.widgets.indexOf(widget)
    if (index >= 0) this.widgets.splice(index, 1)
  }

  /** Widgets the keyboard can land on, in reading order. */
  focusables() {
    return this.widgets.filter((widget) => widget.visible && widget.focusable && widget.enabled)
  }

  focusWidget(widget) {
    for (const candidate of this.widgets) candidate.setFocus(candidate === widget)
    const focusables = this.focusables()
    this.focusIndex = focusables.indexOf(widget)
    if (widget && widget.focusable) widget.onFocus(widget)
  }

  /** Move the focus ring by `delta`, skipping disabled widgets. */
  moveFocus(delta) {
    const focusables = this.focusables()
    if (focusables.length === 0) return null
    let index = focusables.indexOf(focusables.find((widget) => widget.focused))
    if (index < 0) index = 0
    else index = (index + delta + focusables.length) % focusables.length
    const widget = focusables[index]
    this.focusWidget(widget)
    return widget
  }

  focused() {
    return this.widgets.find((widget) => widget.focused) ?? null
  }

  // --- input ------------------------------------------------------------

  /**
   * A key-down event. Returns true when the screen consumed it. Screens override
   * `onKey()`, which is only called when input is not locked.
   */
  handleKey(event) {
    if (this.inputLocked || !this.visible) return false
    return this.onKey(event)
  }

  onKey(_event) {
    return false
  }

  /** Pointer moved over the canvas, in canvas pixels. */
  handlePointerMove(x, y) {
    if (this.inputLocked || !this.visible) return false
    for (const widget of this.widgets) widget.setHovered(widget.hit(x, y))
    const hit = this.hitTest(x, y)
    if (hit && hit.focusable && hit.enabled) this.focusWidget(hit)
    return Boolean(hit)
  }

  handlePointerDown(x, y) {
    if (this.inputLocked || !this.visible) return false
    const widget = this.hitTest(x, y)
    if (!widget) return false
    if (typeof widget.pointerDown === 'function') return widget.pointerDown(x, y)
    return widget.activate()
  }

  handlePointerUp(_x, _y) {
    return false
  }

  /** The topmost widget under the point; later widgets win (they draw on top). */
  hitTest(x, y) {
    for (let index = this.widgets.length - 1; index >= 0; index -= 1) {
      const widget = this.widgets[index]
      if (widget.visible && widget.enabled && widget.hit(x, y)) return widget
    }
    return null
  }

  /** Consume a key by its `code`/`key` spelling (the input module's vocabulary). */
  static isKey(event, code) {
    return event.code === code || event.key === code
  }

  // --- shared drawing ---------------------------------------------------

  /** A wrapped prose block, the shape every spec page uses for help text. */
  block(text, rect, { face = Face.BODY, colour = Palette.ink, lineSpacing = 0, alpha = 1, align = 'left' } = {}) {
    return Ui.label(text, rect.x, rect.y, { face, colour, width: rect.w, align, lineSpacing, alpha })
  }

  /** The bronze focus bar the ledger rows and option rows share. */
  focusBar(rect, visible) {
    if (visible) Ui.rect(Rect.of(rect.x, rect.y + 5, 2, Math.max(6, rect.h - 10)), Palette.bronze)
  }

  /** Post a development note to the console; the shell's only logging surface. */
  note(message) {
    console.info(`[shell] ${message}`)
  }

  get state() {
    return GameState.state
  }

  static get State() {
    return State
  }
}

export { Palette, Rect, Ui, Face, Sound }
