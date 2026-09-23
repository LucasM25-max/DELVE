// Ledger — the contract ledger (GDD-07 §5.5), reached from CONTINUE.
//
//   panel (60, 24, 360, 222), title `The contract ledger`
//   8 rows, 24 px each, at y 48 + 24i:
//     emblem stamp (steps lit = beats completed) · slot name · `{class} · {chapter}` · date
//   row actions: select (confirm) / `DELETE` (blood confirm card)
//   empty slot row: `— empty —` dim 40 %
//   corrupt save: ink card `The ledger is scorched. (save failed checksum)`
//                 + `RETRY` / `CONTINUE WITHOUT SAVING`
//
// **Two documented deviations.**
// 1. §5.5 gives the ledger no exit control and §5.4 only forbids ESC from
//    quitting the *menu*, so this page adds `BACK` at (60, 244, 80, 18) — the
//    same rect the Options page uses for its own BACK. Without it a mouse player
//    could not leave the page.
// 2. Selecting a row is specified as "→ Loading → YARD (resume)". The loading
//    screen and the yard are not built in this pass and pages that would leave
//    the menu return to it, so a selected row returns to the menu instead; the
//    slot is still recorded in `GameState.payload` so the yard can pick it up
//    unchanged. One call site to change: `onRowSelected()`.

import { Brand } from '../core/brand.js'
import { ShellData } from '../core/data.js'
import { Palette } from '../core/palette.js'
import { SaveStore } from '../core/save.js'
import { Sound } from '../core/sound.js'
import { Face, Rect, Ui, UI_DIR } from '../ui/kit.js'
import { Button, Card, ListRow } from '../ui/widgets.js'
import { ShellScreen } from './screen.js'

const ROW_COUNT = 8

export class LedgerScreen extends ShellScreen {
  constructor(shell) {
    super(shell)
    this.rows = []
    this.focus = 0
    this.card = null
    this.pendingDelete = -1
    this.corrupt = false
  }

  build() {
    this.layout = ShellData.screenTiming().ledger ?? {}
  }

  enter() {
    this.inputLocked = false
    this.panel = this.rect('panel', [60, 24, 360, 222])
    this.rowRect = this.rect('row_rect', [68, 48, 344, 24])
    this.pitch = Number(this.layout.row_pitch ?? 24)
    this.corrupt = SaveStore.corrupt
    this.card = null
    this.pendingDelete = -1
    this.buildRows()
    this.back = new Button(this.rect('back_rect', [60, 244, 80, 18]), this.t('STR_BACK'), { id: 'back' })
    this.back.onActivate = () => this.goBack()
    this.add(this.back)
    this.focusRow(this.firstUsedRow())
    Sound.playLoop('MUS_MENU_THEME')
    if (this.corrupt) this.buildScorchedCard()
  }

  exit() {
    this.closeCard()
  }

  // --- rows -------------------------------------------------------------

  buildRows() {
    for (const row of this.rows) this.remove(row)
    this.rows = []
    for (let index = 0; index < ROW_COUNT; index += 1) {
      const row = new ListRow(this.rowRectFor(index), this.rowText(index), {
        id: `slot_${index}`,
        face: Face.UI,
        colour: Palette.ink,
        enabled: this.slotEntry(index) !== null,
      })
      row.slotIndex = index
      row.onActivate = () => this.onRowSelected(index)
      row.onHover = () => this.focusRow(index)
      row.draw = () => this.drawRow(row)
      this.add(row)
      this.rows.push(row)
    }
    this.focusRow(this.focus)
  }

  slotEntry(index) {
    const entry = SaveStore.slot(index)
    return Object.keys(entry).length > 0 ? entry : null
  }

  rowText(index) {
    const entry = this.slotEntry(index)
    return entry ? String(entry.name ?? '') : this.t('STR_LEDGER_EMPTY')
  }

  /**
   * `steps lit = beats completed` (§5.5). The pixel build stores the P1 beat list
   * in `shell_content.json`; a save with no beats yet shows the plain emblem.
   */
  stepsLit(index) {
    if (this.corrupt) return 0
    const entry = this.slotEntry(index)
    if (!entry) return 0
    const total = (ShellData.content.tutorial_beats?.p1 ?? []).length
    const done = (entry.beats ?? []).length
    return Brand.stepsLitFor(done, total)
  }

  rowRectFor(index) {
    return Rect.of(this.rowRect.x, this.rowRect.y + this.pitch * index, this.rowRect.w, this.rowRect.h)
  }

  firstUsedRow() {
    for (let index = 0; index < ROW_COUNT; index += 1) if (this.slotEntry(index)) return index
    return 0
  }

  focusRow(index) {
    this.focus = Math.max(0, Math.min(ROW_COUNT - 1, index))
    // One lit row at a time: the rows are an exclusive group, so the focus clears
    // any hover left on a sibling (see MenuScreen.select for the same rule).
    this.rows.forEach((row, rowIndex) => {
      row.setFocus(rowIndex === this.focus)
      if (rowIndex !== this.focus) row.setHovered(false)
    })
  }

  drawRow(row) {
    const index = row.slotIndex
    const entry = this.slotEntry(index)
    const focused = row.focused
    if (focused) Ui.rect(Rect.of(row.rect.x, row.rect.y + 5, 2, 14), Palette.bronze)
    if (!entry) {
      // §5.5: `— empty —` dim 40 %.
      Ui.label(this.t('STR_LEDGER_EMPTY'), row.rect.x + 32, row.rect.y + 8, { face: Face.UI, colour: Palette.ink, alpha: 0.4 })
      return
    }
    Ui.image(`${UI_DIR}${Brand.stampFile(this.stepsLit(index))}`, row.rect.x, row.rect.y)
    Ui.label(String(entry.name ?? ''), row.rect.x + 32, row.rect.y + 2, { face: Face.UI, colour: Palette.ink })
    Ui.label(this.detailText(entry), row.rect.x + 32, row.rect.y + 13, { face: Face.UI, colour: Palette.ink, alpha: 0.7 })
    const stamp = String(entry.signed_at ?? '').split('T')[0]
    Ui.labelRight(stamp, row.rect.right - 152, row.rect.y + 2, { face: Face.UI, colour: Palette.ink, alpha: 0.6 })

    // The DELETE affordance: the blood face the kit reserves for destruction.
    const deleteRect = Rect.of(row.rect.right - 46, row.rect.y + 3, 46, 18)
    Ui.patch('button_blood', deleteRect, { state: focused ? 'hover' : 'normal', alpha: focused ? 1 : 0.85 })
    Ui.label(this.t('STR_LEDGER_DELETE'), deleteRect.x + Math.round((deleteRect.w - Ui.measure(this.t('STR_LEDGER_DELETE'), null, Face.UI)) / 2),
      deleteRect.y + 6, { face: Face.UI, colour: Palette.parchment_1 })
  }

  /** The spec's literal second line: `{class} · {chapter}` (§5.5). */
  detailText(entry) {
    const klass = String(entry.class ?? '—')
    const chapter = String(entry.chapter ?? '')
    return chapter ? `${klass} · ${chapter}` : klass
  }

  // --- cards ------------------------------------------------------------

  /** Blood confirm card: `Break this contract?` · `BREAK` · `KEEP`. */
  onDeleteRequested(index) {
    if (this.corrupt || this.pendingDelete >= 0) return
    this.pendingDelete = index
    Sound.play('SFX_UI_DENY')
    this.card = this.buildCard({
      rect: this.rect('card_rect', [80, 76, 320, 118]),
      title: this.t('STR_BREAK_TITLE'),
      yes: this.t('STR_BREAK_YES'),
      yesStyle: 'button_blood',
      onYes: () => this.onBreakConfirmed(),
      no: this.t('STR_BREAK_NO'),
      keepRect: this.rect('keep_rect', [244, 152, 140, 18]),
      breakRect: this.rect('break_rect', [96, 152, 140, 18]),
    })
  }

  onBreakConfirmed() {
    const index = this.pendingDelete
    this.pendingDelete = -1
    this.closeCard()
    if (index < 0) return
    SaveStore.deleteContract(index)
    SaveStore.flush()
    Sound.play('SFX_UI_CONFIRM')
    this.rebuildRows()
  }

  /** Boot edge case card (§5.5): ink card, `RETRY` / `CONTINUE WITHOUT SAVING`. */
  buildScorchedCard() {
    this.card = this.buildCard({
      rect: this.rect('scorched_card_rect', [80, 84, 320, 102]),
      title: this.t('STR_LEDGER_SCORCHED'),
      yes: this.t('STR_RETRY'),
      yesStyle: 'button',
      onYes: () => this.onRetry(),
      no: this.t('STR_LEDGER_SKIP'),
      ink: true,
      keepRect: this.rect('skip_rect', [244, 152, 140, 18]),
      breakRect: this.rect('retry_rect', [96, 152, 140, 18]),
    })
  }

  buildCard({ rect, title, yes, yesStyle, onYes, no, ink = false, keepRect, breakRect }) {
    const card = new Card(rect, { style: ink ? 'panel_ink' : 'panel_parchment', dim: 0.55 })
    const yesButton = new Button(breakRect, yes, { id: 'yes', style: yesStyle, colour: ink ? Palette.parchment_1 : Palette.parchment_1 })
    const noButton = new Button(keepRect, no, { id: 'no' })
    yesButton.onActivate = onYes
    noButton.onActivate = () => this.closeCard()
    card.title = title
    card.ink = ink
    card.widgets = [yesButton, noButton]
    for (const widget of card.widgets) this.add(widget)
    this.focusWidget(noButton)
    return card
  }

  onRetry() {
    SaveStore.load()
    if (SaveStore.corrupt) {
      Sound.play('SFX_UI_DENY')
      return
    }
    this.corrupt = false
    this.closeCard()
    this.rebuildRows()
  }

  continueWithoutSaving() {
    this.corrupt = true
    this.closeCard()
    this.rebuildRows()
  }

  closeCard() {
    if (!this.card) return
    for (const widget of this.card.widgets ?? []) this.remove(widget)
    this.card = null
    this.pendingDelete = -1
  }

  rebuildRows() {
    const focus = this.focus
    this.buildRows()
    this.focusRow(Math.min(focus, ROW_COUNT - 1))
  }

  // --- drawing ----------------------------------------------------------

  draw() {
    Ui.white()
    Ui.panel('panel_parchment', this.panel)
    Ui.label(this.t('STR_LEDGER_TITLE'), this.panel.x, Number(this.layout.title_y ?? 32), {
      face: Face.DISPLAY, colour: Palette.ink, width: this.panel.w, align: 'center',
    })
    for (const row of this.rows) row.draw()
    this.back.draw()

    // The hint sits beside BACK on the white field: inside the panel it would
    // land on the eighth row (rows end at y 240, panel bottom 246).
    const hint = this.rect('hint_rect', [148, 250, 344, 8])
    Ui.label(this.t('STR_LEDGER_HINT'), hint.x, hint.y, { face: Face.UI, colour: Palette.ink, alpha: 0.6 })

    if (this.card) this.drawCard()
  }

  drawCard() {
    this.card.draw()
    const rect = this.card.rect
    const colour = this.card.ink ? Palette.parchment : Palette.ink
    if (this.card.ink) {
      Ui.label(this.card.title, rect.x + 12, rect.y + 24, {
        face: Face.UI, colour, width: rect.w - 24, lineSpacing: -2, align: 'center',
      })
    } else {
      Ui.label(this.card.title, rect.x + 12, rect.y + 28, { face: Face.UI, colour, width: rect.w - 24, align: 'center' })
    }
    for (const widget of this.card.widgets ?? []) widget.draw()
  }

  // --- input ------------------------------------------------------------

  onKey(event) {
    if (event.type === 'keyup') return false
    if (this.card) return this.onCardKey(event)
    const code = mapKey(event)
    if (code === 'up') {
      this.focusRow((this.focus - 1 + ROW_COUNT) % ROW_COUNT)
      Sound.play('SFX_UI_MOVE')
      return true
    }
    if (code === 'down') {
      this.focusRow((this.focus + 1) % ROW_COUNT)
      Sound.play('SFX_UI_MOVE')
      return true
    }
    if (code === 'enter' || code === 'space') {
      this.onRowSelected(this.focus)
      return true
    }
    if (code === 'esc') {
      this.goBack()
      return true
    }
    if (event.code === 'Delete' || event.key === 'Delete') {
      this.onDeleteRequested(this.focus)
      return true
    }
    return false
  }

  onCardKey(event) {
    const code = mapKey(event)
    const widgets = this.card?.widgets ?? []
    if (code === 'left' || code === 'right') {
      this.focusWidget(this.focused() === widgets[0] ? widgets[1] : widgets[0])
      return true
    }
    if (code === 'enter' || code === 'space') {
      (this.focused() ?? widgets[1])?.activate()
      return true
    }
    if (code === 'esc') {
      this.closeCard()
      return true
    }
    void widgets
    return false
  }

  handlePointerMove(x, y) {
    if (this.card) {
      for (const widget of this.card.widgets ?? []) widget.setHovered(widget.hit(x, y))
      const hit = (this.card.widgets ?? []).find((widget) => widget.hit(x, y))
      if (hit) this.focusWidget(hit)
      return Boolean(hit)
    }
    const consumed = super.handlePointerMove(x, y)
    const row = this.rows.find((candidate) => candidate.hit(x, y))
    if (row) this.focusRow(row.slotIndex)
    return consumed
  }

  handlePointerDown(x, y) {
    if (this.card) {
      const hit = (this.card.widgets ?? []).find((widget) => widget.hit(x, y))
      return hit ? hit.activate() : false
    }
    if (this.back.hit(x, y)) return this.back.activate()
    for (const row of this.rows) {
      if (!row.hit(x, y)) continue
      // The DELETE affordance sits at the row's right edge and is checked first.
      const deleteRect = Rect.of(row.rect.right - 46, row.rect.y + 3, 46, 18)
      if (deleteRect.contains(x, y) && this.slotEntry(row.slotIndex)) {
        this.focusRow(row.slotIndex)
        this.onDeleteRequested(row.slotIndex)
        return true
      }
      this.focusRow(row.slotIndex)
      return row.activate()
    }
    return false
  }

  /** Select a slot — see deviation 2 in the class header. */
  onRowSelected(index) {
    const entry = this.slotEntry(index)
    if (!entry) {
      Sound.play('SFX_UI_DENY')
      return
    }
    Sound.play('SFX_UI_CONFIRM')
    this.go_to('menu', { resume_slot: index, resume_name: String(entry.name ?? '') })
  }

  goBack() {
    Sound.play('SFX_UI_BACK')
    this.go_to('menu')
  }
}

function mapKey(event) {
  const map = {
    ArrowUp: 'up', ArrowDown: 'down', KeyW: 'up', KeyS: 'down',
    Enter: 'enter', NumpadEnter: 'enter', Space: 'space', Escape: 'esc',
  }
  return map[event.code] ?? ''
}
