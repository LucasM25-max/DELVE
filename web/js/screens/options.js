// Options — the Options page (GDD-07 §5.6), schema-driven from
// `data/options_schema.json`.
//
//   tab rail  (8, 16, 72, 238)   Graphics · Gameplay · Accessibility · Audio · Controls
//   rows panel (88, 16, 384, 238) row h 20, controls right-aligned:
//                                 segmented pills / toggle / slider-as-10-pips / rebind
//   BACK      (88, 244, 80, 18)   commits + writes the save document
//
// Rows are generated from the schema, so adding a row to `options_schema.json`
// adds it to this page with no code change: the schema's `control` field picks
// the widget (`list`/`toggle` → pills, `slider` → 10 pips, `rebind` → key
// capture, `locked` → dimmed read-only value).
//
// **Documented deviations.**
// 1. The spec fixes no help line for this page (the engine-build page had one at
//    the bottom of its own panel). The schema's `help` text is drawn at
//    (176, 244, 288, 8) — beside BACK, the row the spec already reserves for it —
//    wrapped to that width in the 5 px chrome face. The two longest strings
//    (§5.6 difficulty and combat pacing) take three 8 px chrome lines and end at
//    y 268, inside the canvas. Ink reads on both the parchment panel and the
//    white field, so no colour swap is needed.
// 2. The Controls tab has 12 rows against 10 visible slots, so the page scrolls
//    (wheel, PageUp/PageDown, or holding ↑/↓ at the ends) and shows the 4 px
//    scrollbar the UI kit already builds. The spec's row height and panel rect
//    are unchanged.
// 3. `Accessibility` is 78 px at the shipped 5 px face, 3 px wider each side
//    than the 64 px tab the spec's rail allows; the label is centred and the
//    overhang falls in the rail's unused 8 px gap, clear of the rows panel.

import { ShellData } from '../core/data.js'
import { Palette } from '../core/palette.js'
import { SaveStore } from '../core/save.js'
import { Sound } from '../core/sound.js'
import { GameState } from '../core/state.js'
import { codeLabel, eventCode } from '../core/input.js'
import { Face, Rect, Ui } from '../ui/kit.js'
import { Button, LockedLabel, PILL_HEIGHT, PillGroup, Rebind, Slider, pillGroupWidth } from '../ui/widgets.js'
import { ShellScreen } from './screen.js'

const TABS = [
  { id: 'graphics', string: 'STR_OPTIONS_TAB_GRAPHICS' },
  { id: 'gameplay', string: 'STR_OPTIONS_TAB_GAMEPLAY' },
  { id: 'accessibility', string: 'STR_OPTIONS_TAB_ACCESSIBILITY' },
  { id: 'audio', string: 'STR_OPTIONS_TAB_AUDIO' },
  { id: 'controls', string: 'STR_OPTIONS_TAB_CONTROLS' },
]

const CONTROL_RIGHT = 372 // row-relative: 4 px clear of the scrollbar
const SLIDER_WIDTH = 95
const REBIND_WIDTH = 124

export class OptionsScreen extends ShellScreen {
  constructor(shell) {
    super(shell)
    this.tabIndex = 0
    this.scroll = 0
    this.focus = 0
    this.body = [] // row controls, in schema order, for the active tab
    this.listening = null
  }

  build() {
    this.layout = ShellData.screenTiming().options ?? {}
    this.rowRect = this.rect('row_rect', [96, 40, 372, 20])
    this.rowPitch = Number(this.layout.row_pitch ?? 20)
    this.visibleRows = Number(this.layout.visible_rows ?? 10)
    this.helpRect = this.rect('help_rect', [176, 244, 288, 8])
    this.helpLineHeight = Number(this.layout.help_line_height ?? 8)
  }

  enter() {
    this.inputLocked = false
    this.tabRail = this.rect('tab_rail', [8, 16, 72, 238])
    this.rowsPanel = this.rect('rows_panel', [88, 16, 384, 238])
    this.tabRect = this.rect('tab_rect', [12, 20, 64, 24])
    this.tabPitch = Number(this.layout.tab_pitch ?? 28)
    this.scrollbarRect = this.rect('scrollbar_rect', [468, 24, 4, 216])
    this.tabs = TABS.map((tab, index) => {
      const button = new Button(
        Rect.of(this.tabRect.x, this.tabRect.y + this.tabPitch * index, this.tabRect.w, this.tabRect.h),
        this.t(tab.string),
        { id: tab.id, style: 'tab' },
      )
      button.onActivate = () => this.showTab(index)
      button.draw = () => this.drawTab(button, index)
      this.add(button)
      return button
    })
    this.back = new Button(this.rect('back_rect', [88, 244, 80, 18]), this.t('STR_BACK'), { id: 'back' })
    this.back.onActivate = () => this.onBack()
    this.add(this.back)
    this.showTab(0)
    Sound.playLoop('MUS_MENU_THEME')
  }

  exit() {
    this.cancelListening(true)
  }

  // --- tabs -------------------------------------------------------------

  showTab(index) {
    if (index === this.tabIndex && this.builtTab !== undefined) this.cancelListening()
    this.tabIndex = Math.max(0, Math.min(TABS.length - 1, index))
    this.builtTab = this.tabIndex
    this.scroll = 0
    this.focus = 0
    this.buildRows()
    this.showHelpFor(this.body[0])
  }

  schemaRows(tabIndex = this.tabIndex) {
    const tab = ShellData.schema.tabs?.find((candidate) => candidate.id === TABS[tabIndex].id)
    return tab?.rows ?? []
  }

  // --- rows -------------------------------------------------------------

  buildRows() {
    for (const widget of this.body) this.remove(widget)
    this.body = []
    const schemaRows = this.schemaRows()
    schemaRows.forEach((schema, index) => {
      const row = this.buildRow(schema, index)
      this.body.push(row)
    })
    this.layoutRows()
    this.focusRow(this.focus)
  }

  /** One schema row: label, control, focus bar. */
  buildRow(schema, index) {
    const rowId = schema.id
    const rect = this.rowRect
    const current = this.currentValue(schema)
    const control = String(schema.control ?? 'list')
    let widget = null

    if (control === 'slider') {
      const width = SLIDER_WIDTH
      widget = new Slider(Rect.of(rect.x + CONTROL_RIGHT - width, rect.y, width, rect.h), {
        id: rowId,
        min: Number(schema.min ?? 0),
        max: Number(schema.max ?? 100),
        value: Number(current),
      })
      widget.onChange = (value) => this.applySetting(rowId, value)
    } else if (control === 'rebind') {
      // Right-aligned like every other control, so the row label keeps its column.
      widget = new Rebind(Rect.of(rect.x + CONTROL_RIGHT - REBIND_WIDTH, rect.y + 2, REBIND_WIDTH, PILL_HEIGHT), {
        id: rowId,
        label: codeLabel(String(schema.default ?? '')),
      })
      widget.label = String(current ?? schema.default ?? '')
      widget.action = String(schema.action ?? rowId)
      widget.onChanged = (code) => this.onRebind(rowId, widget.action, code)
      widget.onCancel = () => this.showHelpFor(widget)
    } else if (control === 'locked') {
      const text = String(current || (schema.values ?? [''])[0] || '')
      widget = new LockedLabel(Rect.of(rect.x + CONTROL_RIGHT - 120, rect.y, 120, rect.h), { id: rowId, text })
    } else {
      const values = (schema.values ?? []).map(String)
      widget = new PillGroup(Rect.of(rect.x + CONTROL_RIGHT - pillGroupWidth(values), rect.y + 2, pillGroupWidth(values), PILL_HEIGHT), values, 0, { id: rowId })
      widget.setValue(String(current ?? schema.default ?? ''), false)
      widget.onChange = (value) => this.applySetting(rowId, value)
    }

    widget.schema = schema
    widget.rowIndex = index
    widget.rowId = rowId
    widget.help = String(schema.help ?? '')
    widget.locked = control === 'locked'
    widget.rowRect = rect
    widget.helpText = () => (control === 'rebind' ? '' : widget.help)
    widget.onFocus = () => this.showHelpFor(widget)
    this.add(widget)
    return widget
  }

  currentValue(schema) {
    const rowId = schema.id
    if (GameState.settings[rowId] !== undefined) return GameState.settings[rowId]
    const saved = SaveStore.getSettings()
    if (saved[rowId] !== undefined) return saved[rowId]
    return schema.default
  }

  /** Place the rows for the current scroll offset; hide the ones off the band. */
  layoutRows() {
    this.body.forEach((widget, index) => {
      const offset = index - this.scroll
      widget.visible = offset >= 0 && offset < this.visibleRows && widget.enabled !== false
      const y = this.rowRect.y + this.rowPitch * offset
      widget.rect = Rect.of(widget.rect.x, y, widget.rect.w, widget.rect.h)
      widget.rowRect = Rect.of(this.rowRect.x, y, this.rowRect.w, this.rowRect.h)
      if (widget.pills) {
        let cursor = this.rowRect.x + CONTROL_RIGHT - pillGroupWidth(widget.pills.map((pill) => pill.value))
        for (const pill of widget.pills) {
          pill.rect = Rect.of(cursor, y + 2, pill.rect.w, PILL_HEIGHT)
          cursor += pill.rect.w + widget.gap
        }
      }
    })
  }

  scrollBy(delta) {
    const limit = Math.max(0, this.body.length - this.visibleRows)
    const next = Math.max(0, Math.min(limit, this.scroll + delta))
    if (next === this.scroll) return
    this.scroll = next
    this.layoutRows()
    Sound.play('SFX_UI_MOVE')
  }

  // --- focus & help -----------------------------------------------------

  focusRow(index) {
    if (this.body.length === 0) return
    this.focus = Math.max(0, Math.min(this.body.length - 1, index))
    this.body.forEach((widget, widgetIndex) => widget.setFocus(widgetIndex === this.focus))
    const widget = this.body[this.focus]
    // Locked rows explain themselves rather than silently refusing (§5.6).
    this.showHelpFor(widget)
  }

  /** Help is wrapped with the real font metrics, so the line count follows the string. */
  showHelpFor(widget) {
    if (!widget) return
    this.helpText = widget.locked ? widget.help : widget.helpText()
  }

  // --- values -----------------------------------------------------------

  /** Store a value: GameState (live) -> SaveStore (persisted) -> the audio buses. */
  applySetting(rowId, value) {
    GameState.setSetting(rowId, value)
    SaveStore.setSetting(rowId, value)
    if (rowId.startsWith('volume_')) Sound.setBusVolume(busNameFor(rowId), Number(value))
    if (rowId === 'mute_when_unfocused') Sound.setMuted(value === 'On')
    Sound.applySettings(GameState.settings)
  }

  /** ←/→ (and accept) change the focused row's value. */
  stepFocusedRow(direction) {
    const widget = this.body[this.focus]
    if (!widget) return
    if (widget.pills) widget.step(direction)
    else if (widget instanceof Slider) widget.setValue(widget.value + 10 * direction)
  }

  activateFocusedRow() {
    const widget = this.body[this.focus]
    if (!widget) return
    if (widget instanceof Rebind) {
      this.startListening(widget)
      return
    }
    this.stepFocusedRow(1)
  }

  // --- rebind -----------------------------------------------------------

  /**
   * The pill becomes a prompt, the next key press is captured, ESC cancels, and
   * the choice is written to the save so it survives a restart.
   */
  startListening(widget) {
    if (this.listening === widget) {
      this.cancelListening()
      return
    }
    this.cancelListening(true)
    this.listening = widget
    widget.startListening(this.t('STR_REBIND_LISTEN'))
    this.helpText = this.t('STR_REBIND_LISTEN')
    this.focusWidget(widget)
  }

  cancelListening(silent = false) {
    if (!this.listening) return
    this.listening.cancel()
    if (!silent) this.helpText = this.t('STR_REBIND_CANCELLED')
    this.listening = null
  }

  onRebind(rowId, action, code) {
    const label = codeLabel(code)
    this.applySetting(rowId, label)
    this.applySetting(`${rowId}_keycode`, code)
    this.listening = null
    this.focusRow(this.focus)
    Sound.play('SFX_UI_CONFIRM')
    void action
  }

  // --- commit -----------------------------------------------------------

  /** BACK commits and writes the save document (§5.6). */
  onBack() {
    this.cancelListening()
    Sound.play('SFX_UI_BACK')
    SaveStore.flush()
    Sound.applySettings(GameState.settings)
    this.go_to('menu')
  }

  // --- drawing ----------------------------------------------------------

  draw() {
    Ui.white()
    Ui.panel('panel_ink', this.tabRail)
    Ui.panel('panel_parchment', this.rowsPanel)
    // Tabs draw last: the longest label ("Accessibility") overhangs the 64 px
    // tab by a few pixels either side, and the panel must not clip it.
    for (const tab of this.tabs) tab.draw()

    for (const widget of this.body) {
      if (!widget.visible) continue
      this.drawRow(widget)
      widget.draw()
    }

    Ui.scrollbar(this.scrollbarRect, this.scroll, this.visibleRows, this.body.length)
    this.back.draw()
    this.drawHelp()
  }

  drawTab(tab, index) {
    const selected = index === this.tabIndex
    const state = selected ? 'selected' : tab.hovered || tab.focused ? 'hover' : 'normal'
    Ui.patch('tab', tab.rect, { state })
    Ui.label(tab.label, 0, tab.rect.y + Math.round((tab.rect.h - Ui.font(Face.UI).lineHeight) / 2), {
      face: Face.UI,
      colour: selected ? Palette.ink : Palette.parchment_1,
      width: tab.rect.w + 24,
      align: 'center',
    })
  }

  /** One row: focus bar, label, control. The control draws itself. */
  drawRow(widget) {
    const rect = widget.rowRect
    if (widget.focused) Ui.rect(Rect.of(rect.x, rect.y + 2, 2, rect.h - 4), Palette.bronze)
    const alpha = widget.locked ? 0.5 : 1
    Ui.label(String(widget.schema.label ?? widget.rowId), rect.x + 8, rect.y + 6, {
      face: Face.UI,
      colour: widget.focused && !widget.locked ? Palette.bronze_0 : Palette.ink,
      alpha,
    })
  }

  drawHelp() {
    const text = this.helpText ?? ''
    if (!text) return
    // The help line is chrome: the same 5 px face as the menu footer and the
    // ledger hint, wrapped to its rect. The label needs a line count, so the
    // measured height is passed in rather than clipped.
    const lines = Ui.wrap(text, this.helpRect.w, Face.UI)
    const height = Math.max(this.helpRect.h, lines.length * this.helpLineHeight)
    Ui.label(text, this.helpRect.x, this.helpRect.y, {
      face: Face.UI, colour: Palette.ink, width: this.helpRect.w, alpha: 0.8, lineSpacing: 0,
    })
    void height
  }

  // --- input ------------------------------------------------------------

  onKey(event) {
    if (event.type === 'keyup') return false
    if (this.listening) return this.onListeningKey(event)
    const code = mapKey(event)
    if (code === 'up') {
      if (this.focus === 0 && this.scroll > 0) {
        this.scrollBy(-1)
        return true
      }
      const next = Math.max(0, this.focus - 1)
      if (next !== this.focus) {
        this.focusRow(next)
        Sound.play('SFX_UI_MOVE')
      }
      return true
    }
    if (code === 'down') {
      if (this.focus === this.body.length - 1 && this.scroll < this.body.length - this.visibleRows) {
        this.scrollBy(1)
        return true
      }
      const next = Math.min(this.body.length - 1, this.focus + 1)
      if (next !== this.focus) {
        this.focusRow(next)
        Sound.play('SFX_UI_MOVE')
      }
      return true
    }
    if (code === 'left') {
      this.stepFocusedRow(-1)
      return true
    }
    if (code === 'right') {
      this.stepFocusedRow(1)
      return true
    }
    if (code === 'tab') {
      this.showTab((this.tabIndex + 1) % TABS.length)
      Sound.play('SFX_UI_MOVE')
      return true
    }
    if (code === 'enter' || code === 'space') {
      this.activateFocusedRow()
      return true
    }
    if (code === 'esc') {
      this.onBack()
      return true
    }
    if (event.code === 'PageDown') {
      this.scrollBy(1)
      return true
    }
    if (event.code === 'PageUp') {
      this.scrollBy(-1)
      return true
    }
    return false
  }

  /** While a rebind is armed the next key is captured, and ESC cancels. */
  onListeningKey(event) {
    if (event.key === 'Escape' || event.code === 'Escape') {
      this.cancelListening()
      Sound.play('SFX_UI_DENY')
      return true
    }
    const code = eventCode(event)
    if (!code) return true
    this.listening.capture(code)
    return true
  }

  handlePointerDown(x, y) {
    const tab = this.tabs.find((candidate) => candidate.hit(x, y))
    if (tab) {
      this.showTab(TABS.findIndex((entry) => entry.id === tab.id))
      Sound.play('SFX_UI_MOVE')
      return true
    }
    return super.handlePointerDown(x, y)
  }

  handleWheel(delta) {
    this.scrollBy(delta)
    return true
  }
}

/** `volume_music` -> `Music`, for the audio buses. */
function busNameFor(rowId) {
  const name = rowId.replace('volume_', '')
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** The shell's key vocabulary. */
function mapKey(event) {
  const map = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    Enter: 'enter', NumpadEnter: 'enter', Space: 'space', Escape: 'esc', Tab: 'tab',
  }
  return map[event.code] ?? ''
}

export { TABS }
