// Sting — screen 2 of boot: the logo sting (GDD-07 §5.2 step 2).
//
// A single 4.0 s timeline driven by one clock and quantised to whole-pixel steps
// so every element snaps rather than slides:
//
//   0.0-0.8  emblem outline draws, row by row        SFX_BOOT_STONE
//   0.8-2.0  the three steps light top -> bottom     SFX_BOOT_EMBERS  ×3
//   2.0-3.0  the wordmark chisels, letter by letter  SFX_BOOT_CHISEL  ×5
//   3.0-3.6  sublock fades in + bronze sweep         MUS_BOOT_STING
//   3.6-4.0  hold, then a 0.6 s cross-fade to menu
//
// Skippable by any input after 1.5 s. Reduced motion cuts to the end frame and
// still holds for a reduced minimum. Every number comes from
// `data/shell_timings.json` -> `boot.sting`, so the timeline can be retimed
// without touching this file.

import { Brand } from '../core/brand.js'
import { ShellData } from '../core/data.js'
import { GameState } from '../core/state.js'
import { Palette } from '../core/palette.js'
import { Sound } from '../core/sound.js'
import { Face, Rect, Ui, UI_DIR } from '../ui/kit.js'
import { ShellScreen } from './screen.js'

const EMBLEM_POS = { x: 228, y: 40 }
const WORDMARK_POS = { x: 205, y: 84 }
const SUBLOCK_Y = 120
const REVEAL_STEPS = 8 // outline-draw quantisation: 24 px of emblem in 8 steps

export class StingScreen extends ShellScreen {
  constructor(shell) {
    super(shell)
    this.timing = {}
    this.elapsed = 0
    this.reduced = false
    this.started = false
    this.finished = false
    this.litSteps = 0
    this.chiselled = 0
    this.sublockAlpha = 0
    this.sweepWidth = 0
    this.doneAt = 4
  }

  enter() {
    this.inputLocked = false
    this.timing = ShellData.stingTiming()
    this.reduced = GameState.settings?.reduced_motion === 'On' || prefersReducedMotion()
    this.elapsed = 0
    this.finished = false
    this.started = true
    this.doneAt = Number(this.timing.total_ms ?? 4000) / 1000
    this.litSteps = 0
    this.chiselled = 0
    Sound.play('SFX_BOOT_STONE')
    if (this.reduced) {
      // Cut straight to the end frame, then hold for the reduced minimum (§5.2).
      this.applyEndFrame()
      this.doneAt = Number(this.timing.reduced_motion_hold_ms ?? 1200) / 1000
    }
  }

  exit() {
    this.started = false
  }

  update(delta) {
    if (!this.started || this.finished) return
    this.elapsed += delta
    if (!this.reduced) this.updateTimeline(this.elapsed)
    if (this.elapsed >= this.doneAt) this.finish()
  }

  /** The whole animation as a function of time — used by the tests too. */
  updateTimeline(time) {
    const ms = time * 1000
    this.drawProgress = this.reduced ? 1
      : Math.min(1, time / Math.max(0.001, Number(this.timing.emblem_draw_ms ?? 800) / 1000))

    // 0.8-2.0 — the three steps light, top to bottom, each with its ember cue.
    let lit = 0
    for (const mark of this.timing.steps_light_ms ?? []) if (ms >= Number(mark)) lit += 1
    if (lit > this.litSteps) {
      for (let index = this.litSteps; index < lit; index += 1) Sound.play('SFX_BOOT_EMBERS')
      this.litSteps = lit
    }

    // 2.0-3.0 — the wordmark chisels in, letter by letter.
    let chiselled = 0
    for (const mark of this.timing.wordmark_chisel_ms ?? []) if (ms >= Number(mark)) chiselled += 1
    if (chiselled > this.chiselled) {
      for (let index = this.chiselled; index < chiselled; index += 1) Sound.play('SFX_BOOT_CHISEL')
      this.chiselled = chiselled
    }

    // 3.0-3.6 — sublock fade and the bronze sweep under it.
    const fadeStart = Number(this.timing.sublock_fade_ms ?? 3000)
    const sweep = this.timing.bronze_sweep_ms ?? [fadeStart, fadeStart + 600]
    const sweepStart = Number(sweep[0])
    const sweepEnd = Number(sweep[1])
    const crossfade = Number(this.timing.crossfade_ms ?? 600)
    const fadeSeconds = Math.max(0.001, (sweepEnd - fadeStart) / 1000)
    this.sublockAlpha = clamp01((ms - fadeStart) / (fadeSeconds * 1000))
    this.sweepWidth = Math.round(240 * clamp01((ms - sweepStart) / Math.max(1, sweepEnd - sweepStart)))
    if (this.sublockAlpha > 0 && !this._stingPlayed) {
      this._stingPlayed = true
      Sound.play('MUS_BOOT_STING')
    }
    void crossfade
  }

  applyEndFrame() {
    this.drawProgress = 1
    this.litSteps = (this.timing.steps_light_ms ?? []).length || 3
    this.chiselled = (this.timing.wordmark_chisel_ms ?? []).length || 5
    this.sublockAlpha = 1
    this.sweepWidth = 240
    this._stingPlayed = true
  }

  finish() {
    this.finished = true
    this.started = false
    this.go_to('menu')
  }

  draw() {
    Ui.ground(Palette.ink)
    const emblem = Brand.emblemSize()
    const rows = Math.round((this.drawProgress ?? 0) * REVEAL_STEPS) / REVEAL_STEPS * emblem.height
    if (rows > 0) {
      Ui.image(`${UI_DIR}logo_emblem.png`, EMBLEM_POS.x, EMBLEM_POS.y, {
        region: { x: 0, y: 0, w: emblem.width, h: Math.round(rows) },
      })
    }

    // The three steps, lit in mint as the sting counts them.
    Brand.emblemStepRects().forEach((step, index) => {
      if (index < this.litSteps) {
        Ui.rect(Rect.of(EMBLEM_POS.x + step.x, EMBLEM_POS.y + step.y, step.w, step.h), Palette.mint)
      }
    })

    // The wordmark, one cell per letter, in chisel order.
    if (this.chiselled > 0) {
      const cell = Brand.wordmarkCellWidth()
      const size = Brand.wordmarkSize()
      for (let index = 0; index < Math.min(this.chiselled, Brand.wordmarkLetters().length); index += 1) {
        Ui.image(`${UI_DIR}logo_wordmark_strip.png`, WORDMARK_POS.x + index * cell, WORDMARK_POS.y, {
          region: { x: index * cell, y: 0, w: cell, h: size.height },
        })
      }
    }

    // Sublock: two 5 px lines, 4 px apart, centred on the canvas.
    if (this.sublockAlpha > 0) {
      Ui.label(this.t('STR_SUBLOCK_1'), 0, SUBLOCK_Y, {
        face: Face.UI, colour: Palette.bronze_3, width: 480, align: 'center', alpha: this.sublockAlpha,
      })
      Ui.label(this.t('STR_SUBLOCK_2'), 0, SUBLOCK_Y + 12, {
        face: Face.UI, colour: Palette.bronze_3, width: 480, align: 'center', alpha: this.sublockAlpha,
      })
      if (this.sweepWidth > 0) {
        Ui.rect(Rect.of(120, SUBLOCK_Y + 26, this.sweepWidth, 1), Palette.bronze, this.sublockAlpha)
      }
    }
  }

  onKey() {
    if (this.reduced || this.elapsed * 1000 < Number(this.timing.skippable_after_ms ?? 1500)) return true
    // Skip: cut to the end frame and hold for the cross-fade, as the spec allows.
    this.applyEndFrame()
    this.elapsed = Math.max(this.elapsed, (this.doneAt || 4) - Number(this.timing.crossfade_ms ?? 600) / 1000)
    return true
  }

  handlePointerDown() {
    return this.onKey({})
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
