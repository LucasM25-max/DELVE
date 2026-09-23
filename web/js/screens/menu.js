// Menu — screen 3 of boot: the main menu (GDD-07 §5.4, composed in the third
// pass; the full rationale is in `docs/PIXEL_MENU_BUILD_NOTES.md` §2.14).
//
// The spec's skeleton is kept — column x 29, items on a 21 px pitch, one footer
// row — and the screen is built around it:
//
//   header    the emblem at 2x (48 px) with the typed wordmark and the two brand
//             lines beside it, closed by a bronze rule
//   items     (29, 92, 140, 18) PLAY, then CONTINUE / OPTIONS / CODEX / CREDITS
//             at 21 px pitch, 15 px display type, 4 px of tracking, the focused
//             row carrying the kit's cursor and the §5.4 underline (drawn left to
//             right in 0.18 s, now measured to the word rather than the column)
//   panel     (196, 96, 255, 132) the latest contract — or the reason CONTINUE
//             is dimmed — in the same parchment card the ledger uses
//   footer    the key hint bottom-left, then the bronze rule, then the §5.4
//             disclaimer and version stamp on one row
//
// Footer note: §5.4 puts both footer lines on one row at y 259. The shipped 9 px
// face measures the disclaimer 249 px and the stamp 195 px — 444 of 480 — so the
// spec's single row ships; it sits at y 258 because the row's line box is 12 px
// and the spec's 259 would cut the descender row. See
// `data/shell_timings.json` -> `menu._footer_note`/`spec_rects`.
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

import { Brand } from '../core/brand.js'
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

const TOOLTIP_SIZE = { w: 164, h: 14 }

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
        tracking: Number(this.layout.item_tracking ?? 4),
        idleDim: Number(this.layout.item_idle_dim ?? 0.78),
        disabledColour: Palette.stone_2,
        disabledDim: Number(this.layout.disabled_dim ?? 0.8),
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
    // The rows are one exclusive group: only the selected row may be lit, so a
    // hover that the pointer left behind when the keyboard took over is cleared
    // here. Without this, moving with ↑↓ after a hover leaves two cursors up
    // (found by watching `web/tests/reel.mjs`, not by the stills).
    this.rows.forEach((row, rowIndex) => {
      row.setFocus(rowIndex === this.selected)
      if (rowIndex !== this.selected) row.setHovered(false)
    })
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
    this.drawHeader()
    for (const row of this.rows) row.draw()
    this.drawKeysHint() // the hint line doubles as the §5.4 tooltip slot
    this.drawContractPanel()
    this.drawFooter()

    if (this.overlayOpen) this.drawOverlay()
  }

  /** Emblem at 2x, the typed wordmark and the brand lines, closed by a rule. */
  drawHeader() {
    const layout = this.layout.header ?? {}
    const mark = Rect.from(layout.mark_rect, [29, 16, 48, 48])
    const markFile = ShellData.brand.emblem?.variants?.mark_2x ?? 'logo_emblem_2x.png'
    Ui.image(`${UI_DIR}${markFile}`, mark.x, mark.y)
    if (this.emblemLit) {
      // §5.4's 0.2 s flicker: the same mark with its three steps lit. Whole
      // numbers only — the 24 px steps art would land in the wrong pixels here,
      // so `build_brand.py` ships the mark's 2x lit variant as well.
      const litFile = ShellData.brand.emblem?.variants?.mark_2x_steps ?? 'logo_emblem_steps_2x.png'
      Ui.image(`${UI_DIR}${litFile}`, mark.x, mark.y)
    }

    const wordmark = Rect.from(layout.wordmark_rect, [87, 14, 320, 28])
    Ui.label(ShellData.brand.wordmark?.text ?? 'DELVE', wordmark.x, wordmark.y, {
      face: Face.WORDMARK, colour: Palette.ink,
    })

    const sublock = Rect.from(layout.sublock_rect, [87, 42, 360, 12])
    const sublock2 = Rect.from(layout.sublock2_rect, [87, 54, 360, 12])
    Ui.label(this.t('STR_SUBLOCK_1'), sublock.x, sublock.y, {
      face: Face.UI, colour: Palette.bronze_1, tracking: 2,
    })
    Ui.label(this.t('STR_SUBLOCK_2'), sublock2.x, sublock2.y, {
      face: Face.UI, colour: Palette.bronze_1, alpha: 0.75, tracking: 2,
    })

    const rule = Rect.from(layout.rule_rect, [29, 76, 422, 1])
    Ui.rect(rule, Palette.bronze_2, 0.6)
  }

  /**
   * The foot of the item column: the keyboard hint, or — while the pointer is on
   * a disabled CONTINUE — §5.4's `No contracts signed yet.` tooltip, which takes
   * the same line. Anchoring it here rather than beside the row keeps it clear of
   * the contract card the third pass added to the right-hand half.
   */
  drawKeysHint() {
    const rect = Rect.from(this.layout.keys_rect, [29, 206, 164, 14])
    if (this.tooltip.visible) {
      const box = this.tooltip.rect
      Ui.patch('tooltip', box, { state: 'normal' })
      Ui.label(this.tooltip.text, box.x + 4, box.y + 1, { face: Face.UI, colour: Palette.ink })
      return
    }
    Ui.label(this.t('STR_MENU_KEYS'), rect.x, rect.y, {
      face: Face.UI, colour: Palette.stone_2,
    })
  }

  /**
   * The right-hand card: the latest contract, or why CONTINUE is dimmed.
   *
   * It reads `SaveStore` on every frame — the ledger, the First Run page and the
   * overlay all change the save — so the card and the menu can never disagree
   * about whether a contract exists. `refreshContinue()` runs on `enter()`,
   * which is the path every one of those screens returns through, so the row's
   * enabled state and the card move together.
   */
  drawContractPanel() {
    const layout = this.layout.contract_panel ?? {}
    const panel = Rect.from(layout.rect, [196, 92, 255, 148])
    Ui.panel('panel_parchment', panel)

    const entry = SaveStore.latestContract()
    const hasContract = Boolean(entry?.name)
    const stamp = Rect.from(layout.stamp_rect, [212, 110, 24, 24])
    const title = Rect.from(layout.title_rect, [244, 116, 191, 12])
    const name = Rect.from(layout.name_rect, [212, 142, 223, 20])
    const detail = Rect.from(layout.detail_rect, [212, 166, 223, 12])
    const rule = Rect.from(layout.rule_rect, [212, 186, 223, 1])
    const hint = Rect.from(layout.hint_rect, [212, 196, 223, 24])

    const beats = ShellData.content.tutorial_beats?.p1 ?? []
    const done = hasContract ? (entry.beats ?? []).length : 0
    Ui.image(`${UI_DIR}${Brand.stampFile(Brand.stepsLitFor(done, beats.length))}`, stamp.x, stamp.y)

    Ui.label(this.t(hasContract ? 'STR_MENU_PANEL_TITLE' : 'STR_MENU_PANEL_EMPTY_TITLE'), title.x, title.y, {
      face: Face.UI, colour: Palette.bronze_1, tracking: 2,
    })
    if (hasContract) {
      Ui.label(String(entry.name), name.x, name.y, {
        face: Face.DISPLAY, colour: Palette.ink, width: name.w,
      })
      Ui.label(this.t('STR_MENU_PANEL_DETAIL', [entry.class ?? '—', Number(entry.level ?? 1), entry.chapter ?? '—']),
        detail.x, detail.y, { face: Face.UI, colour: Palette.ink, alpha: 0.7, width: detail.w })
    } else {
      // The empty state is prose, not a headline: the card should read as a
      // quiet note beside the menu, not as a second title.
      Ui.label(this.t('STR_MENU_PANEL_EMPTY_BODY'), name.x, name.y + 8, {
        face: Face.BODY, colour: Palette.ink, alpha: 0.85, width: name.w,
      })
    }
    Ui.rect(rule, Palette.bronze_2, 0.45)
    Ui.label(hasContract
      ? this.t('STR_MENU_PANEL_STATUS', [done, beats.length])
      : this.t('STR_MENU_PANEL_EMPTY_HINT'),
    hint.x, hint.y, { face: Face.UI, colour: Palette.ink, alpha: 0.62, width: hint.w })
  }

  drawFooter() {
    const rule = Rect.from(this.layout.footer_rule_rect, [29, 250, 422, 1])
    Ui.rect(rule, Palette.bronze_2, 0.5)

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

  /**
   * §5.4: CONTINUE with no saves shows its tooltip on hover. The box is parked at
   * the foot of the item column (see `drawKeysHint`), so it never lands on the
   * contract card; the row it belongs to is still passed for the highlight and
   * for anything that wants the anchor later.
   */
  showTooltip(visible, row = null) {
    this.tooltip.visible = visible
    if (!visible || !row) return
    this.tooltip.setText(this.t('STR_MENU_NOSAVE'))
    const keys = Rect.from(this.layout.keys_rect, [29, 206, 164, 14])
    this.tooltip.rect = Rect.of(keys.x, keys.y, TOOLTIP_SIZE.w, TOOLTIP_SIZE.h)
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
