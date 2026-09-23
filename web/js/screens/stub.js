// Stub — the placeholder page behind a menu item (GDD-07 §5.7/§5.8).
//
// **This screen is scaffolding, not spec.** GDD-07 §5.5 defines the real pages
// (First Run contract, ledger, options, codex, credits and the loading screen);
// this build ships the menu, the boot sequence, the First Run contract page, the
// ledger and the options page, so activating CODEX or CREDITS opens a small
// parchment card instead of a half-built page.
//
// Replacing it is deliberately a one-liner in `menu.js`, and each stub's
// title/body already lives in `data/strings.json` under `build`
// (`STR_STUB_<ID>_TITLE` / `STR_STUB_<ID>_BODY`), so the wires are already in
// place for the real screens.

import { ShellData } from '../core/data.js'
import { Palette } from '../core/palette.js'
import { Sound } from '../core/sound.js'
import { Face, Rect, Ui } from '../ui/kit.js'
import { Button, Card } from '../ui/widgets.js'
import { ShellScreen } from './screen.js'

export class StubScreen extends ShellScreen {
  constructor(shell) {
    super(shell)
    this.stubId = 'play'
  }

  build() {
    this.layout = ShellData.screenTiming()
  }

  enter(payload = {}) {
    this.inputLocked = false
    this.stubId = String(payload.stub ?? 'play')
    const rect = this.rect('stub_card_rect', [100, 66, 280, 130])
    this.card = new Card(rect, { style: 'panel_parchment', dim: 0.5 })
    this.title = Rect.of(rect.x + 12, rect.y + 10, rect.w - 24, 18)
    this.body = Rect.of(rect.x + 20, rect.y + 38, rect.w - 40, 46)
    this.hint = Rect.of(rect.x + 20, rect.y + 82, rect.w - 40, 16)
    this.back = new Button(
      Rect.of(rect.x + Math.round((rect.w - 88) / 2), rect.bottom - 30, 88, 18),
      this.t('STR_BACK'),
      { id: 'back' },
    )
    this.back.onActivate = () => this.goBack()
    this.widgets = [this.back]
    this.focusWidget(this.back)
    this.note(`'${this.stubId}' selected — placeholder page (this page is not built yet)`)
  }

  exit() {}

  draw() {
    Ui.white()
    this.card.draw()
    const key = this.stubId.toUpperCase()
    Ui.label(this.t(`STR_STUB_${key}_TITLE`), this.title.x, this.title.y, {
      face: Face.DISPLAY, colour: Palette.ink, width: this.title.w, align: 'center',
    })
    Ui.label(this.t(`STR_STUB_${key}_BODY`), this.body.x, this.body.y, {
      face: Face.BODY, colour: Palette.ink, width: this.body.w, lineSpacing: -2,
    })
    Ui.label(this.t('STR_STUB_CARD_HINT'), this.hint.x, this.hint.y, {
      face: Face.UI, colour: Palette.ink, width: this.hint.w, alpha: 0.7,
    })
    this.back.draw()
  }

  goBack() {
    Sound.play('SFX_UI_BACK')
    this.go_to('menu')
  }

  onKey(event) {
    if (event.type === 'keyup') return false
    if (event.code === 'Escape' || event.key === 'Escape' || event.code === 'Enter' || event.code === 'Space') {
      this.goBack()
      return true
    }
    return false
  }
}
