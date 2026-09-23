// Menu — screen 3 of boot: the main menu (GDD-07 §5.4).
//
// Exact 480×270 layout, straight from the spec table and `shell_timings.json`:
//
//   (29, 22, 96, 24)  lockup: emblem + wordmark
//   (29, 92, 140, 18) PLAY        + 21 px pitch per row
//   (29, 113 …)       CONTINUE
//   (29, 134 …)       OPTIONS
//   (29, 155 …)       CODEX
//   (29, 176 …)       CREDITS
//   (29, y+14, w, 2)  hover underline, bronze, drawn left to right in 0.18 s
//   (10, 254, 348, 8) abridged fan-work disclaimer, 5 px, 60 % alpha
//   right-aligned to (470, 262)  version stamp
//
// Footer note: §5.4 puts both footer lines on one row at y 259, but at the
// shipped 5 px face the disclaimer measures 360 px and the stamp 252 px — 612 of
// 480 — so one row would overprint. They are stacked instead (both verbatim,
// both anchored, both inside the canvas); the reasoning and the spec's original
// numbers live in `data/shell_timings.json` -> `menu._footer_note`/`spec_rects`.
//
// NAVIGATION: arrows / W-S / stick / mouse hover; ESC does nothing on the menu —
// the menu is the root of the shell, so there is no back-exit.
//
// CONTINUE is dimmed to 40 % with no signed contract, shows the
// `No contracts signed yet.` tooltip on hover, and refuses with SFX_UI_DENY.
//
// ROUTING (§5.5/§5.6): PLAY opens the First Run contract page, or the
// `Begin a new contract?` overlay card when a contract already exists; CONTINUE
// opens the ledger; OPTIONS opens the schema-driven options page; CODEX and
// CREDITS open their placeholder cards. The overlay card is drawn over the menu
// rather than being a shell state, because §5.5 draws it over the menu: the menu
// stays visible behind it and comes back untouched when the card closes.

import { ShellData } from '../core/data.js'
import { Palette } from '../core/palette.js'
import { SaveStore } from '../core/save.js'
import { Sound } from '../core/sound.js'
import { VERSION } from '../core/state.js'
import { Face, Rect, Ui, UI_DIR } from '../ui/kit.js'
import { Button, Card, ListRow, Tooltip } from '../ui/widgets.js'
import { ShellScreen } from './screen.js'

const ITEMS = [
  { id: 'play', string: 'STR_MENU_PLAY' },
  { id: 'continue', string: 'STR_MENU_CONTINUE' },
  { id: 'options', string: 'STR_MENU_OPTIONS' },
  { id: 'codex', string: 'STR_MENU_CODEX' },
  { id: 'credits', string: 'STR_MENU_CREDITS' },
]

const TOOLTIP_SIZE = { w: 164, h: 12 }

export class MenuScreen extends ShellScreen {
  constructor(shell) {
    super(shell)
    this.rows = []
    this.selected = 0
    this.underlineProgress = 1
    this.underlineActive = false
    this.emblemLit = false
    this.flickerUntil = 0
    this.overlayOpen = false
    this.overlayWidgets = []
  }

  build() {
    this.layout = ShellData.menuLayout()
    this.footerColour = Palette.ink // ink on white; the parchment treatment lands with §5.3 art

    const origin = this.rect('item_rect', [29, 92, 140, 18])
    ITEMS.forEach((item, index) => {
      const row = new ListRow(Rect.of(origin.x, origin.y + this.pitch * index, origin.w, origin.h), this.t(item.string), {
        id: item.id,
        face: Face.DISPLAY,
        colour: Palette.ink,
        disabledColour: Palette.stone_1,
        disabledDim: Number(this.layout.disabled_dim ?? 0.4),
        underline: {
          colour: Palette.bronze_2,
          offsetY: Number(this.layout.underline_offset_y ?? 14),
          height: Number(this.layout.underline_height ?? 2),
          progress: 1,
        },
      })
      row.onHover = () => this.select(index, true)
      row.onActivate = () => this.activate(index)
      this.add(row)
      this.rows.push(row)
    })

    this.tooltip = this.add(new Tooltip(Rect.of(0, 0, TOOLTIP_SIZE.w, TOOLTIP_SIZE.h), this.t('STR_MENU_NOSAVE')))
  }

  get pitch() {
    return Number(this.layout.item_pitch ?? 21)
  }

  enter(payload = {}) {
    this.inputLocked = false
    this.overlayWidgets = []
    this.overlayOpen = false
    this.emblemLit = false
    this.refreshContinue()
    this.select(this.selected, false)
    Sound.playLoop('MUS_MENU_THEME')
    Sound.playLoop('AMB_YRD_DAWN_MENU')
    void payload
  }

  exit() {
    this.showTooltip(false)
  }

  update(delta) {
    if (this.underlineActive) {
      const drawMs = Number(this.layout.underline_draw_ms ?? 180)
      this.underlineProgress = Math.min(1, this.underlineProgress + (delta * 1000) / drawMs)
      const row = this.rows[this.selected]
      if (row) row.underline.progress = this.underlineProgress
    }
    if (this.flickerUntil > 0) {
      this.flickerUntil -= delta
      if (this.flickerUntil <= 0) {
        this.emblemLit = false
        this.flickerUntil = 0
      }
    }
  }

  // --- state ------------------------------------------------------------

  /** CONTINUE is dimmed 40 % until a contract exists (§5.4). */
  refreshContinue() {
    const hasContract = SaveStore.hasAnyContract()
    const row = this.rows.find((candidate) => candidate.id === 'continue')
    if (row) row.enabled = hasContract
  }

  select(index, playSound = true) {
    const changed = index !== this.selected
    this.selected = Math.max(0, Math.min(this.rows.length - 1, index))
    this.rows.forEach((row, rowIndex) => row.setFocus(rowIndex === this.selected))
    this.underlineProgress = 0
    this.underlineActive = true
    if (changed && playSound) Sound.play('SFX_UI_MOVE')
    this.showTooltip(false)
    const row = this.rows[this.selected]
    if (row.id === 'continue' && !row.enabled) this.showTooltip(true, row)
  }

  activate(index) {
    this.select(index, false)
    const row = this.rows[index]
    if (!row.enabled) {
      Sound.play('SFX_UI_DENY')
      this.showTooltip(true, row)
      return
    }
    Sound.play('SFX_UI_CONFIRM')
    this.flickerEmblem()
    if (row.id === 'play') this.onPlay()
    else if (row.id === 'continue') this.go_to('ledger')
    else if (row.id === 'options') this.go_to('options')
    else this.go_to('stub', { stub: row.id })
  }

  /** §5.5 PLAY: no save -> First Run page; a save exists -> the overlay card. */
  onPlay() {
    if (!SaveStore.hasAnyContract()) {
      this.go_to('first_run')
      return
    }
    this.openNewContractCard()
  }

  // --- "Begin a new contract?" overlay (§5.5) ---------------------------

  openNewContractCard() {
    if (this.overlayOpen) return
    this.overlayOpen = true
    const layout = ShellData.screenTiming().new_contract_card ?? {}
    const card = new Card(Rect.from(layout.rect, [80, 60, 320, 150]), { style: 'panel_parchment', dim: 0.55 })
    const seal = Rect.from(layout.seal_rect, [88, 68, 24, 24])
    const title = Rect.from(layout.title_rect, [120, 72, 272, 12])
    const body = Rect.from(layout.body_rect, [96, 100, 288, 60])
    const begin = new Button(Rect.from(layout.begin_rect, [96, 172, 148, 18]), this.t('STR_NEW_BEGIN'), { id: 'begin' })
    const back = new Button(Rect.from(layout.back_rect, [252, 172, 148, 18]), this.t('STR_BACK'), { id: 'back' })
    begin.onActivate = () => this.beginNew()
    back.onActivate = () => this.closeOverlay()

    this.overlay = { card, seal, title, body, begin, back }
    this.overlayWidgets = [begin, back]
    this.focusWidget(back)
  }

  /** The body string verbatim, naming the contract that already exists. */
  overlayBody() {
    const latest = SaveStore.latestContract()
    return this.t('STR_NEW_BODY', [
      latest.name ?? '—', latest.class ?? '—', Number(latest.level ?? 1), latest.chapter ?? '—',
    ])
  }

  /** `BEGIN NEW` -> First Run with the first empty slot (§5.5). */
  beginNew() {
    if (SaveStore.firstEmptySlot() < 0) {
      // Unreachable from PLAY, but a full ledger must never be overwritten.
      Sound.play('SFX_UI_DENY')
      return
    }
    this.closeOverlay()
    this.go_to('first_run')
  }

  closeOverlay() {
    if (!this.overlayOpen) return
    this.overlayOpen = false
    this.overlayWidgets = []
    this.overlay = null
    Sound.play('SFX_UI_BACK')
  }

  // --- drawing ----------------------------------------------------------

  draw() {
    Ui.white()

    const lockup = this.rect('lockup_rect', [29, 22, 96, 24])
    Ui.image(`${UI_DIR}logo_menu.png`, lockup.x, lockup.y)
    if (this.emblemLit) {
      // The lit-steps overlay sits exactly on the emblem inside the lockup, so
      // the selection flicker only ever changes the steps.
      const emblem = ShellData.brand.emblem?.size ?? [24, 24]
      Ui.image(`${UI_DIR}logo_emblem_steps.png`, lockup.x, lockup.y, {
        region: { x: 0, y: 0, w: emblem[0], h: emblem[1] },
      })
    }

    for (const row of this.rows) row.draw()
    this.tooltip.draw()
    this.drawFooter()

    if (this.overlayOpen) this.drawOverlay()
  }

  drawFooter() {
    const alpha = Number(this.layout.disclaimer_alpha ?? 0.6)
    const disclaimer = this.rect('disclaimer_rect', [10, 254, 348, 8])
    Ui.label(this.t('STR_DISCLAIMER_ABRIDGED'), disclaimer.x, disclaimer.y, {
      face: Face.UI, colour: this.footerColour, alpha,
    })

    const stampRect = this.rect('version_stamp_rect', [140, 262, 330, 8])
    const stamp = this.t('STR_VERSION_STAMP', [VERSION, todayStamp()])
    Ui.label(stamp, stampRect.x, stampRect.y, {
      face: Face.UI, colour: this.footerColour, alpha, width: stampRect.w, align: 'right',
    })
  }

  drawOverlay() {
    const { card, seal, title, body, begin, back } = this.overlay
    card.draw()
    Ui.image(`${UI_DIR}wax_seal.png`, seal.x, seal.y)
    Ui.label(this.t('STR_NEW_TITLE'), title.x, title.y, { face: Face.UI, colour: Palette.ink })
    Ui.label(this.overlayBody(), body.x, body.y, {
      face: Face.BODY, colour: Palette.ink, width: body.w, lineSpacing: -2,
    })
    begin.draw()
    back.draw()
  }

  // --- tooltip ----------------------------------------------------------

  showTooltip(visible, row = null) {
    this.tooltip.visible = visible
    if (!visible || !row) return
    this.tooltip.setText(this.t('STR_MENU_NOSAVE'))
    this.tooltip.rect = Rect.of(
      row.rect.right + 8,
      Math.round(row.rect.y + (row.rect.h - TOOLTIP_SIZE.h) / 2),
      TOOLTIP_SIZE.w,
      TOOLTIP_SIZE.h,
    )
  }

  flickerEmblem() {
    this.emblemLit = true
    this.flickerUntil = Number(this.layout.emblem_flicker_ms ?? 200) / 1000
  }

  // --- input ------------------------------------------------------------

  /** ESC deliberately does nothing here: the menu is the shell's root (§5.4). */
  onKey(event) {
    if (event.type === 'keyup') return false
    const code = keyCode(event)
    if (this.overlayOpen) {
      if (code === 'esc') {
        this.closeOverlay()
        return true
      }
      if (code === 'up' || code === 'down' || code === 'tab') {
        this.focusWidget(this.focused() === this.overlay.begin ? this.overlay.back : this.overlay.begin)
        return true
      }
      if (code === 'enter' || code === 'space') {
        const target = this.focused() ?? this.overlay.back
        target.activate()
        return true
      }
      return false
    }
    if (code === 'up') {
      this.select((this.selected - 1 + this.rows.length) % this.rows.length)
      return true
    }
    if (code === 'down') {
      this.select((this.selected + 1) % this.rows.length)
      return true
    }
    if (code === 'enter' || code === 'space') {
      this.activate(this.selected)
      return true
    }
    if (code === 'esc') return true // swallowed on purpose: no back-exit from the menu
    return false
  }

  /** The overlay owns the pointer while it is up; the menu must not move. */
  handlePointerMove(x, y) {
    if (this.overlayOpen) {
      for (const widget of this.overlayWidgets) widget.setHovered(widget.hit(x, y))
      const hit = this.overlayWidgets.find((widget) => widget.hit(x, y))
      if (hit) this.focusWidget(hit)
      return Boolean(hit)
    }
    return super.handlePointerMove(x, y)
  }

  handlePointerDown(x, y) {
    if (this.overlayOpen) {
      const hit = this.overlayWidgets.find((widget) => widget.hit(x, y))
      return hit ? hit.activate() : false
    }
    return super.handlePointerDown(x, y)
  }
}

/** `2026-09-23` — the stamp's second argument. */
function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

/** The shell's key vocabulary: arrows, WASD, Enter/Space, Esc. */
function keyCode(event) {
  const map = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', Enter: 'enter', NumpadEnter: 'enter', Space: 'space',
    Escape: 'esc', Tab: 'tab',
  }
  return map[event.code] ?? ''
}
