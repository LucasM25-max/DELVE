// Legal — screen 1 of boot: the legal / attribution page (GDD-07 §5.2 step 1).
//
// Full-bleed ink, parchment text, laid out against the spec's anchors:
//
//   y 20   the 24 px emblem, centred
//   y 56   fan-work disclaimer (384 px wide, centred, 8 px)
//   y 116  SRD 5.2.1 CC-BY-4.0 attribution block
//   y 168  shipping line
//   y 180  font credits
//   y 250  "Press any button to continue." pulsing every 0.8 s
//
// The disclaimer and the SRD block are prose: how many lines they take depends
// on the face and the wrapping, so each block sits at its spec anchor when it
// fits there and flows down only when the block above it would collide. The
// spec's layout is what ships, and a longer string can never overprint the line
// below it.
//
// Any input continues to the logo sting *and* is the audio gesture gate: the
// browser only starts audio from a user gesture, so `Sound.unlock()` is called
// here before the sting queues its first cue.

import { ShellData } from '../core/data.js'
import { Palette } from '../core/palette.js'
import { Sound } from '../core/sound.js'
import { Face, Ui, UI_DIR } from '../ui/kit.js'
import { ShellScreen } from './screen.js'

const CONTENT_WIDTH = 384
const CONTENT_X = (480 - CONTENT_WIDTH) / 2 // 48: the spec's centred block
const BLOCK_GAP = 8
const BODY_SPACING = -2 // tightens the 8 px face so 3-4 line blocks fit

// Spec anchors (GDD-07 §5.2 step 1).
const ANCHOR = { disclaimer: 56, srd: 116, engine: 168, font: 180, pulse: 250 }

export class LegalScreen extends ShellScreen {
  constructor(shell) {
    super(shell)
    this.blink = true
    this.elapsed = 0
    this.contentBottom = 0
  }

  enter() {
    this.inputLocked = false
    this.blink = true
    this.elapsed = 0
    Sound.queueAfterUnlock('MUS_MENU_THEME')
  }

  update(delta) {
    this.elapsed += delta * 1000
    // 0.8 s blink (§5.2): a hard on/off, never a fade — pixels do not fade.
    const blinkMs = Number(ShellData.bootTiming().legal_blink_ms ?? 800)
    this.blink = Math.floor(this.elapsed / (blinkMs / 2)) % 2 === 0
  }

  draw() {
    Ui.ground(Palette.ink)
    Ui.image(`${UI_DIR}logo_emblem.png`, 228, 20)

    let cursor = 0
    const blocks = [
      [this.t('STR_DISCLAIMER_FULL'), ANCHOR.disclaimer, Palette.parchment],
      [this.t('STR_SRD_ATTRIBUTION'), ANCHOR.srd, Palette.parchment_1],
      [this.t('STR_ENGINE_LINE'), ANCHOR.engine, Palette.parchment_1],
      [this.t('STR_FONT_LINE'), ANCHOR.font, Palette.parchment_1],
    ]
    for (const [text, anchor, colour] of blocks) {
      const height = Ui.measure(text, CONTENT_WIDTH, Face.BODY, BODY_SPACING)
      const y = Math.max(anchor, cursor)
      Ui.label(text, CONTENT_X, y, {
        face: Face.BODY, colour, width: CONTENT_WIDTH, align: 'center', lineSpacing: BODY_SPACING,
      })
      cursor = y + height + BLOCK_GAP
    }
    this.contentBottom = cursor - BLOCK_GAP

    if (this.blink) {
      Ui.label(this.t('STR_BOOT_ANY'), 0, ANCHOR.pulse, {
        face: Face.UI, colour: Palette.bronze_3, width: 480, align: 'center',
      })
    }
  }

  /** Any input: keyboard, mouse, touch or pad — and the audio gesture gate. */
  onKey(event) {
    if (event.type === 'keyup') return false
    this._advance()
    return true
  }

  handlePointerDown() {
    this._advance()
    return true
  }

  _advance() {
    if (this.inputLocked) return
    this.inputLocked = true
    Sound.unlock()
    Sound.play('SFX_UI_CONFIRM')
    this.go_to('sting')
  }
}
