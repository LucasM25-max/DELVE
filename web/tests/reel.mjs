// Record the boot sequence — the fourth Node suite, and the only one you can watch.
//
//     node web/tests/reel.mjs          # frames → web/preview/reel/, then web/preview/reel.gif
//
// The pages in `web/preview/shell-*.png` are stills; this drives the *same*
// booted shell (`web/tests/shoot.mjs` exports it, DOM stub and all) through a
// scripted run of real input — any key on the legal screen, the full sting, the
// menu's hover and tooltip states, the options tabs, the contract page — and
// writes one PNG per frame. `shoot.mjs` proves the pictures are right; the reel
// shows the timings are right.
//
// Assembly uses ImageMagick's `convert` when it is on PATH into a 2x GIF
// (it is not a build dependency: without one the frames are still written and
// the command is printed). Nothing here runs in CI; the fifth gate stays
// `shoot.mjs`.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { canvas, shell, writePNG, OUT } from './shoot.mjs'

const FPS = 20            // frames per second of game time
const DT = 1 / FPS
const FRAMES = join(OUT, 'reel')

/**
 * The scripted run. Each entry is either a beat — `['hold', seconds, note]`,
 * `['key', code, note]`, `['move', x, y, note]`, `['click', x, y, note]` — or a
 * note on the previous one. Coordinates are canvas pixels; the menu rows are at
 * y 92 / 113 / 134 / 155 / 176 (GDD-07 §5.4).
 */
const SCRIPT = [
  ['hold', 1.4, 'legal — fade in, PRESS ANY BUTTON pulsing'],
  ['key', 'Space', 'any input starts the boot sequence'],
  ['hold', 4.2, 'the sting: emblem, three steps, wordmark chisel, sublock, sweep'],
  ['hold', 0.7, 'the menu fades in over white'],
  ['move', 100, 101, 'hover PLAY — bronze underline draws left to right in 0.18 s'],
  ['hold', 0.9],
  ['move', 100, 122, 'CONTINUE is dimmed at 40 % with no contract signed'],
  ['hold', 1.0, 'its tooltip: No contracts signed yet.'],
  ['click', 100, 122, 'CONTINUE refuses with SFX_UI_DENY'],
  ['hold', 0.8],
  ['move', 100, 143, 'hover OPTIONS'],
  ['hold', 0.4],
  ['click', 100, 143, 'options opens on the graphics tab'],
  ['hold', 1.0],
  ['key', 'Tab', 'Tab walks the rail: graphics → audio → accessibility → controls'],
  ['hold', 0.7],
  ['key', 'Tab'],
  ['hold', 0.7],
  ['key', 'Tab'],
  ['hold', 0.7],
  ['key', 'ArrowDown', 'arrows move the focus bar; the list scrolls under it'],
  ['hold', 0.5],
  ['key', 'ArrowDown'],
  ['hold', 0.5],
  ['key', 'Escape', 'BACK returns to the menu, which held its place'],
  ['hold', 0.7],
  ['click', 100, 101, 'PLAY with no contract opens the First Run page'],
  ['hold', 1.8, 'the four groups, their rows and the comfort help'],
  ['key', 'Escape', 'ESC is the only exit from the contract page'],
  ['hold', 0.9, 'menu again — untouched'],
]

rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })

let frame = 0
/** One frame of game time: update, draw, keep the pixels. */
function tick() {
  shell.active?.update(DT)
  shell.render(DT)
  writePNG(join(FRAMES, `frame-${String(frame).padStart(3, '0')}.png`), canvas)
  frame += 1
}

const key = (code) => ({ code, key: code, type: 'keydown' })

for (const [action, a, b, note] of SCRIPT) {
  if (action === 'hold') {
    for (let index = 0; index < Math.round(a * FPS); index += 1) tick()
  } else if (action === 'key') {
    shell.active?.handleKey(key(a))
    tick()
  } else if (action === 'move') {
    shell.active?.handlePointerMove(a, b)
    tick()
  } else if (action === 'click') {
    shell.active?.handlePointerDown(a, b)
    tick()
    shell.active?.handlePointerUp?.(a, b)
  } else {
    throw new Error(`reel: unknown action '${action}'`)
  }
  const label = action === 'hold' ? `${Math.round(a * FPS)} frames` : action
  console.log(`  ${label.padEnd(12)} ${note ?? ''}`.trimEnd())
}

console.log(`\n${frame} frame(s) in web/preview/reel/ (${(frame / FPS).toFixed(1)} s at ${FPS} fps)`)

// --- the GIF ------------------------------------------------------------
//
// Holds repeat the same pixels, so identical neighbours collapse into one frame
// with a longer delay: the 17.6 s above is 116 distinct images, not 352. That is
// not just tidier — ImageMagick's default 512 MiB pixel cache cannot hold 352
// frames at 2x, and 116 it can.

const frames = []
for (const path of readdirSync(FRAMES).filter((name) => name.endsWith('.png')).sort()) {
  const bytes = readFileSync(join(FRAMES, path))
  const last = frames.at(-1)
  if (last && last.bytes.equals(bytes)) last.hold += 1
  else frames.push({ path: join(FRAMES, path), bytes, hold: 1 })
}

const gif = join(OUT, 'reel.gif')
const args = ['-loop', '0']
for (const { path, hold } of frames) args.push('-delay', String(Math.round(hold * 100 / FPS)), path)
// The scale goes *after* the list: ImageMagick applies an operator to the images
// already read, so a `-resize` before each input would re-scale the whole list
// once per frame.
args.push('-filter', 'point', '-resize', '200%', gif)
try {
  execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  console.log(`wrote web/preview/reel.gif — ${frames.length} frames, 2x, ${FPS} fps`)
} catch (error) {
  console.log(`no usable ImageMagick \`convert\` (${error.status}) — frames only. Assemble with:`)
  console.log(`  convert -loop 0 -delay ${Math.round(100 / FPS)} -filter point -resize 200% web/preview/reel/frame-*.png web/preview/reel.gif`)
}
