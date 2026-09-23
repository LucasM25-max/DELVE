// FirstRun — the First Run contract page (GDD-07 §5.5), reached from PLAY.
//
//   single parchment panel (40, 16, 400, 238), ink text
//   three pill groups (nine-patch pills, h 16, gap 4; selected = bronze + ink):
//     y  56  Difficulty           Story / Balanced / Tactical     default Balanced
//     y 104  Combat pacing        Table Mode / Skirmish Mode       default Table Mode
//     y 152  Subtitles  +  Camera comfort preset
//   footer: (56, 224, 148, 18) BACK · (276, 224, 148, 18) SIGN & DESCEND
//
// Group help text is shown verbatim from `data/options_schema.json` under each
// group (8 px), and the Skirmish pill carries the SECONDARY tag with its P1
// tooltip.
//
// **This build deviates in one place, and only one.** `SIGN & DESCEND` is
// specified as "save slot created here → Loading → YARD"; the loading screen and
// the yard are not built, and pages that would leave the menu return to it
// instead. The button keeps its spec text and its spec effect on the *ledger*
// (the contract really is written into the next free slot, with the chosen
// settings stored beside it), then returns to the menu — where CONTINUE lights
// up and the ledger shows the new contract. One call site to change when the
// yard lands: `signAndDescend()`.

import { ShellData } from '../core/data.js'
import { Palette } from '../core/palette.js'
import { SaveStore } from '../core/save.js'
import { Sound } from '../core/sound.js'
import { GameState } from '../core/state.js'
import { Face, Rect, Ui } from '../ui/kit.js'
import { Button, PILL_HEIGHT, PillGroup, Tooltip, pillGroupWidth } from '../ui/widgets.js'
import { ShellScreen } from './screen.js'

const GROUP_DEFS = [
  { id: 'difficulty', labelKey: 'STR_FR_DIFF', row: 'difficulty' },
  { id: 'combat_pacing', labelKey: 'STR_FR_PACE', row: 'combat_pacing' },
]

export class FirstRunScreen extends ShellScreen {
  constructor(shell) {
    super(shell)
    this.groups = {}
    this.settings = {}
  }

  build() {
    this.layout = ShellData.screenTiming().first_run ?? {}
  }

  enter() {
    this.inputLocked = false
    this.widgets = []
    this.groups = {}
    // GameState.settings merges the schema defaults with the save, so the page
    // opens on whatever the player chose last time and on the spec defaults
    // otherwise.
    this.settings = { ...GameState.settings }
    this.drawHelpLater = []
    this.order = ['difficulty', 'combat_pacing', 'subtitles', 'reduced_motion']
    this.focusId = 'difficulty'
    this.panel = this.rect('panel', [40, 16, 400, 238])
    this.contentX = Number(this.layout.content_x ?? 48)
    this.contentW = Number(this.layout.content_w ?? 384)
    this.rightX = Number(this.layout.right_column_x ?? 240)
    this.lineSpacing = Number(this.layout.help_line_spacing ?? -3)

    // The spec anchors the three groups at y 56 / 104 / 152, and the help under
    // each one is prose of a different length, so the anchors are treated as
    // floors: a group drops only when the help above it would otherwise run into
    // it. Nothing is ever drawn over anything else, and the columns below stay
    // in their own half of the panel.
    const groupYs = this.layout.group_ys ?? [56, 104, 152]
    const gap = Number(this.layout.group_gap ?? 8)
    const helpOffset = Number(this.layout.help_offset_y ?? 24)
    this.labelYs = [groupYs[0], groupYs[1], groupYs[2]]
    let cursor = groupYs[0]
    GROUP_DEFS.forEach((definition, index) => {
      const y = Math.max(groupYs[index], cursor)
      this.labelYs[index] = y
      this.buildGroup(definition, y, this.contentW)
      cursor = y + helpOffset + this.helpHeight(this.schemaRow(definition.row).help, this.contentW) + gap
    })
    this.labelYs[2] = Math.max(groupYs[2], cursor - gap)
    this.buildComfortGroup(this.labelYs[2])
    this.buildTooltip()

    const back = new Button(this.rect('back_rect', [56, 224, 148, 18]), this.t('STR_BACK'), { id: 'back' })
    back.onActivate = () => this.onBack()
    const go = new Button(this.rect('go_rect', [276, 224, 148, 18]), this.t('STR_FR_GO'), { id: 'go' })
    go.onActivate = () => this.signAndDescend()
    this.add(back)
    this.add(go)
    this.focusWidget(this.groups.difficulty)
    Sound.playLoop('MUS_MENU_THEME')
  }

  exit() {
    this.hideTooltip()
  }

  // --- groups -----------------------------------------------------------

  /** Height of a help block as the body face will actually wrap it. */
  helpHeight(text, width) {
    if (!text) return 0
    return Ui.font(Face.BODY).measureBlock(text, width, this.lineSpacing)
  }

  /** Difficulty and Combat pacing: label, pills, verbatim help beneath. */
  buildGroup(definition, y, helpWidth = null) {
    const schemaRow = this.schemaRow(definition.row)
    const labelY = Number(y)
    const pillsY = labelY + Number(this.layout.label_to_pills ?? 8)

    const values = schemaRow.values ?? []
    const group = new PillGroup(
      Rect.of(this.contentX, pillsY, pillGroupWidth(values), PILL_HEIGHT),
      values,
      Math.max(0, values.indexOf(this.settings[definition.row] ?? schemaRow.default)),
      { id: definition.row },
    )
    group.onChange = (value) => this.onGroupChanged(definition.row, value)
    this.add(group)
    this.groups[definition.row] = group

    if (schemaRow.help) {
      const width = Number(helpWidth ?? this.contentW)
      const help = Rect.of(this.contentX, labelY + Number(this.layout.help_offset_y ?? 24), width,
        this.helpHeight(schemaRow.help, width))
      this.drawHelpLater.push([schemaRow.help, help])
    }
    if (schemaRow.tag === 'SECONDARY') this.addSecondaryTag(group, this.contentX + this.contentW, labelY)
  }

  /** Subtitles (left) + Camera comfort preset (right), per the §5.5 table. */
  buildComfortGroup(y) {
    const pillsY = Number(y) + Number(this.layout.label_to_pills ?? 8)
    const subsRow = this.schemaRow('subtitles')
    this.subsLabel = Rect.of(this.contentX, y, 120, 8)
    this.groups.subtitles = this.makeGroup('subtitles', subsRow, this.contentX, pillsY)
    this.comfortLabel = Rect.of(this.rightX, y, 190, 8)
    const comfortRow = this.schemaRow('reduced_motion')
    this.groups.reduced_motion = this.makeGroup('reduced_motion', comfortRow, this.rightX, pillsY)

    // The §5.5 table spells both of these out as prose notes; they fit under
    // their own columns without touching the footer.
    // Each column keeps its own width, so subtitles' help can never run under
    // the camera-comfort pill (and vice versa).
    const helpY = Number(y) + Number(this.layout.help_offset_y ?? 24)
    const columnW = this.rightX - this.contentX - 8
    const rightW = this.contentX + this.contentW - this.rightX
    this.comfortHelp = [subsRow.help, Rect.of(this.contentX, helpY, columnW, this.helpHeight(subsRow.help, columnW))]
    this.comfortRightHelp = [comfortRow.help, Rect.of(this.rightX, helpY, rightW, this.helpHeight(comfortRow.help, rightW))]
  }

  makeGroup(rowId, schemaRow, x, y) {
    const values = schemaRow.values ?? []
    const group = new PillGroup(
      Rect.of(x, y, pillGroupWidth(values), PILL_HEIGHT),
      values,
      Math.max(0, values.indexOf(this.settings[rowId] ?? schemaRow.default)),
      { id: rowId },
    )
    group.onChange = (value) => this.onGroupChanged(rowId, value)
    this.add(group)
    return group
  }

  onGroupChanged(rowId, value) {
    this.settings[rowId] = value
    SaveStore.setSetting(rowId, value)
    GameState.setSetting(rowId, value)
    if (rowId === 'reduced_motion') Sound.applySettings(this.settings)
  }

  // --- SECONDARY tag and its tooltip ------------------------------------

  /**
   * A bronze chip on the group's label line, right-aligned: the Skirmish pill
   * alone is wide, so there is no room for an inline chip on the pill row.
   */
  addSecondaryTag(group, rightX, y) {
    const text = 'SECONDARY'
    const width = Ui.measure(text, null, Face.UI) + 4
    this.secondaryTag = { rect: Rect.of(rightX - width, y, width, 8) }
    const skirmish = group.pills[group.pills.length - 1]
    if (!skirmish) return
    this.skirmishPill = skirmish
  }

  buildTooltip() {
    const text = this.t('STR_SKIRMISH_TOOLTIP')
    this.tooltip = new Tooltip(Rect.of(0, 0, Ui.measure(text, null, Face.UI) + 8, 12), text)
    this.add(this.tooltip)
  }

  /**
   * Park the tooltip under the Skirmish pill, nudged left so it never leaves the
   * canvas (the pill ends near x 372 and the string is ~210 px wide).
   */
  showTooltip(pill) {
    if (!this.tooltip) return
    const width = this.tooltip.rect.w
    this.tooltip.rect = Rect.of(Math.max(2, Math.min(pill.rect.x, 478 - width)), pill.rect.bottom + 2, width, 12)
    this.tooltip.visible = true
  }

  hideTooltip() {
    if (this.tooltip) this.tooltip.visible = false
  }

  // --- drawing ----------------------------------------------------------

  draw() {
    // A screen owns its ground: `Ui.dim(0.6)` here dimmed whatever the last frame
    // left on the canvas and re-dimmed it every frame, so the page arrived white
    // and settled to ink. Every other page paints white or ink on the first line.
    Ui.white()
    Ui.panel('panel_parchment', this.panel)
    Ui.label(this.t('STR_FR_TITLE'), this.panel.x, this.panel.y + 8, {
      face: Face.DISPLAY, colour: Palette.ink, width: this.panel.w, align: 'center',
    })

    const ys = this.labelYs ?? this.layout.group_ys ?? [56, 104, 152]
    Ui.label(this.t('STR_FR_DIFF'), this.contentX, ys[0], { face: Face.UI, colour: Palette.ink })
    Ui.label(this.t('STR_FR_PACE'), this.contentX, ys[1], { face: Face.UI, colour: Palette.ink })
    Ui.label(this.t('STR_FR_SUBS'), this.subsLabel.x, this.subsLabel.y, { face: Face.UI, colour: Palette.ink })
    Ui.label(this.t('STR_FR_COMFORT'), this.comfortLabel.x, this.comfortLabel.y, { face: Face.UI, colour: Palette.ink })

    for (const [help, rect] of [...(this.drawHelpLater ?? []), this.comfortHelp, this.comfortRightHelp]) {
      if (help) this.block(help, rect, { face: Face.BODY, colour: Palette.ink, lineSpacing: this.lineSpacing, alpha: 0.78 })
    }

    if (this.secondaryTag) {
      Ui.label('SECONDARY', this.secondaryTag.rect.x, this.secondaryTag.rect.y, {
        face: Face.UI, colour: Palette.bronze_0, width: this.secondaryTag.rect.w, align: 'center',
      })
      Ui.rect(Rect.of(this.secondaryTag.rect.x, this.secondaryTag.rect.y + 7, this.secondaryTag.rect.w, 1), Palette.bronze_3)
    }

    for (const group of Object.values(this.groups)) group.draw()
    this.tooltip?.draw()
    for (const widget of this.widgets) if (widget instanceof Button) widget.draw()
  }

  // --- actions ----------------------------------------------------------

  onBack() {
    Sound.play('SFX_UI_BACK')
    this.go_to('menu')
  }

  /**
   * SIGN & DESCEND — the one deviating call site in this screen.
   *
   * §5.5: "→ save slot created here (P1: slot label = `New contract` until yard
   * naming at E) → Loading". The slot is created exactly as specified, with the
   * chosen settings beside it; the target is the menu instead of Loading,
   * because the loading screen and the yard are not built. Everything else about
   * the flow (the next free slot, the P1 label, the stored difficulty / pacing /
   * subtitle / comfort values) is as written.
   */
  signAndDescend() {
    const slot = SaveStore.firstEmptySlot()
    if (slot < 0) {
      // Unreachable from PLAY, but a full ledger must never be overwritten.
      Sound.play('SFX_UI_DENY')
      return
    }
    SaveStore.createContract(slot, {
      name: this.t('STR_CONTRACT_NEW_NAME'),
      class: this.t('STR_CONTRACT_UNASSIGNED'),
      level: 1,
      chapter: this.t('STR_CONTRACT_CHAPTER'),
    })
    for (const [rowId, value] of Object.entries(this.settings)) SaveStore.setSetting(rowId, value)
    SaveStore.flush()
    Sound.play('SFX_UI_CONFIRM')
    this.go_to('menu')
  }

  // --- input ------------------------------------------------------------

  onKey(event) {
    if (event.type === 'keyup') return false
    const code = mapKey(event)
    const group = this.focusedGroup()
    if (code === 'esc') {
      this.onBack()
      return true
    }
    if (code === 'up' || code === 'down') {
      const current = Math.max(0, this.order.indexOf(this.focusId))
      const next = (current + (code === 'up' ? -1 : 1) + this.order.length) % this.order.length
      this.focusId = this.order[next]
      this.focusWidget(this.groups[this.focusId])
      return true
    }
    if (code === 'left' && group) {
      group.step(-1)
      return true
    }
    if (code === 'right' && group) {
      group.step(1)
      return true
    }

    if (code === 'enter' || code === 'space') {
      const widget = this.focused()
      if (widget instanceof Button) widget.activate()
      else if (group) group.step(1)
      return true
    }
    return false
  }

  handlePointerMove(x, y) {
    const consumed = super.handlePointerMove(x, y)
    if (!this.skirmishPill?.rect.contains(x, y)) this.hideTooltip()
    else this.showTooltip(this.skirmishPill)
    return consumed
  }

  focusedGroup() {
    const widget = this.focused()
    if (widget && widget.pills) {
      this.focusId = widget.id
      return widget
    }
    return this.groups[this.focusId] ?? this.groups.difficulty
  }

  // --- helpers ----------------------------------------------------------

  schemaRow(rowId) {
    return ShellData.optionRows()[rowId] ?? {}
  }
}

function mapKey(event) {
  const map = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    Enter: 'enter', NumpadEnter: 'enter', Space: 'space', Escape: 'esc',
  }
  return map[event.code] ?? ''
}
