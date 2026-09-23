// Smoke test: boot the whole shell in Node against a minimal DOM stub.
//
//     node web/tests/smoke.mjs
//
// There is no browser in CI, so this suite stands in for one: it stubs just
// enough of the DOM (a canvas whose 2D context records calls, an `Image` that
// reads the real PNG headers, `window`, `localStorage`, `fetch`) and then drives
// the actual game code through the whole shell — legal → sting → menu → each
// page, with keyboard and pointer input.
//
// What it proves, per screen: the page builds, draws (the painter receives
// calls), responds to input, and never throws. That is the same ground the
// engine build's `test_runner.gd` covered with "menu screen", "boot screens",
// "first run page", "contract card", "ledger screen" and "options screen".

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- the stubs ----------------------------------------------------------

const drawCalls = { count: 0 }

function context2D(canvas) {
  const ctx = {
    canvas,
    fillStyle: '#000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: false,
    font: '400 10px "Delve Sans"',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    // The shell installs one viewport transform through `Painter.setViewport`;
    // this stub records it so the smoke run also proves the fit is sane (see the
    // 'canvas sizing' step below).
    transform: { scale: 1, x: 0, y: 0 },
    setTransform: (scale, _skewX, _skewY, _scaleY, x, y) => {
      ctx.transform = { scale, x, y }
    },
    fillRect: () => { drawCalls.count += 1 },
    clearRect: () => {},
    drawImage: () => { drawCalls.count += 1 },
    fillText: () => { drawCalls.count += 1 },
    measureText: (string) => ({ width: String(string).length * 5 }),
    save: () => {},
    restore: () => {},
  }
  return ctx
}

function makeCanvas() {
  const canvas = {
    width: 480,
    height: 270,
    style: {},
    getContext: () => (canvas.__ctx ??= context2D(canvas)),
    addEventListener: () => {},
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height }),
  }
  return canvas
}

/** PNG dimensions, straight out of the IHDR chunk — no image decoder needed. */
function pngSize(path) {
  const bytes = readFileSync(path)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

class FakeImage {
  constructor() {
    this.width = 0
    this.height = 0
    this.onload = null
    this.onerror = null
  }

  set src(url) {
    const path = join(WEB, url)
    setTimeout(() => {
      if (!existsSync(path)) {
        this.onerror?.()
        return
      }
      try {
        const size = pngSize(path)
        this.width = size.width
        this.height = size.height
        this.onload?.()
      } catch (error) {
        this.onerror?.(error)
      }
    }, 0)
  }
}

const storage = (() => {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  }
})()

const listeners = {}
globalThis.document = {
  readyState: 'complete',
  createElement: (tag) => (tag === 'canvas' ? makeCanvas() : { style: {}, addEventListener: () => {} }),
  getElementById: (id) => (id === 'screen' ? (globalThis.__canvas ??= makeCanvas()) : null),
  addEventListener: (type, handler) => { listeners[type] = handler },
}
globalThis.window = {
  // A deliberately awkward window: not 16:9, and not a whole multiple of
  // 480x270, so the fit is exercised on every frame of this suite.
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 2,
  addEventListener: (type, handler) => { listeners[type] = handler },
  matchMedia: () => ({ matches: false }),
}
globalThis.location = { search: '' }
globalThis.localStorage = storage
globalThis.Image = FakeImage
globalThis.matchMedia = () => ({ matches: false })
// Node 22 exposes `navigator` as a getter-only global, so patch the method.
if (globalThis.navigator) {
  Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => [], configurable: true })
} else {
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [] }, configurable: true })
}
globalThis.requestAnimationFrame = () => 0
globalThis.cancelAnimationFrame = () => {}
globalThis.performance = globalThis.performance ?? { now: () => Date.now() }
globalThis.fetch = async (url) => {
  const path = join(WEB, String(url).replace(/^\.?\//, ''))
  if (!existsSync(path)) return { ok: false, status: 404, text: async () => '' }
  return { ok: true, status: 200, text: async () => readFileSync(path, 'utf8') }
}

// --- the run ------------------------------------------------------------

const failures = []
let checks = 0
let current = ''

function check(condition, message) {
  checks += 1
  if (!condition) failures.push(`[${current}] ${message}`)
}

function eq(actual, expected, message) {
  check(actual === expected, `${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`)
}

function step(label, body, { draw = true } = {}) {
  current = label
  const before = drawCalls.count
  const beforeFailures = failures.length
  try {
    body()
  } catch (error) {
    failures.push(`[${label}] threw ${error.stack ?? error}`)
  }
  if (draw) check(drawCalls.count > before, 'the page drew something')
  console.log(`  ${failures.length === beforeFailures ? 'ok  ' : 'FAIL'} ${label}`)
}

const { Shell } = await import('../js/shell.js')
const { GameState, State } = await import('../js/core/state.js')
const { SaveStore } = await import('../js/core/save.js')
const { Dice } = await import('../js/core/dice.js')

const canvas = globalThis.document.getElementById('screen')
const shell = new Shell(canvas)
await shell.boot()

step('canvas sizing', () => {
  const { transform } = canvas.getContext('2d')
  const expected = Math.min(canvas.width / 480, canvas.height / 270)
  check(Math.abs(transform.scale - expected) < 1e-9, 'the design is scaled to fit the window')
  check(canvas.width >= window.innerWidth && canvas.height >= window.innerHeight,
    'the canvas fills the window in device pixels')
  check(480 * transform.scale <= canvas.width + 1 && 270 * transform.scale <= canvas.height + 1,
    'the 480x270 design fits inside it')
  eq(transform.x, Math.round((canvas.width - 480 * transform.scale) / 2), 'the remainder is centred horizontally')
  eq(transform.y, Math.round((canvas.height - 270 * transform.scale) / 2), 'the remainder is centred vertically')
  const rect = canvas.getBoundingClientRect()
  const centre = shell.toCanvas({ clientX: rect.width / 2, clientY: rect.height / 2 })
  check(Math.abs(centre.x - 240) <= 1 && Math.abs(centre.y - 135) <= 1,
    `the middle of the window is the middle of the design (${centre.x}, ${centre.y})`)
  const corner = shell.toCanvas({ clientX: 0, clientY: 0 })
  check(corner.x <= 0 && corner.y <= 0, 'the top-left of the window is outside the design, not inside it')
}, { draw: false })

const active = () => shell.active
const key = (code, extra = {}) => ({ type: 'keydown', code, key: '', ...extra })
const frames = (count = 4, delta = 0.1) => {
  for (let index = 0; index < count; index += 1) shell.render(delta)
}
const updates = (count = 20, delta = 0.25) => {
  for (let index = 0; index < count; index += 1) active().update(delta)
}

step('boot lands on the legal page', () => {
  eq(GameState.state, State.LEGAL, 'the first page is the legal screen')
  frames()
})

step('any key continues to the sting', () => {
  active().handleKey(key('KeyF'))
  eq(GameState.state, State.STING, 'the sting follows the legal page')
  active().update(0.016)
  frames()
})

step('the sting runs its timeline and hands over to the menu', () => {
  updates(20, 0.25) // 5 s in 0.25 s steps: past the 4 s timeline
  frames(8, 0.1)
  eq(GameState.state, State.MENU, 'the menu follows the sting')
})

step('the menu draws, moves and opens the First Run page', () => {
  const menu = active()
  menu.handleKey(key('ArrowDown'))
  eq(menu.selected, 1, 'the down arrow moves the menu cursor')
  menu.handleKey(key('ArrowUp'))
  frames(3, 0.1)

  // One lit row at a time. A hover the pointer leaves behind when the keyboard
  // takes over would put two cursors on screen at once — the reel caught it.
  menu.rows[3].setHovered(true)
  menu.handleKey(key('ArrowDown'))
  eq(menu.rows.filter((row) => row.focused || row.hovered).length, 1,
    'exactly one menu row stays lit after a hover and then a keyboard move')
  check(menu.rows[menu.selected].focused, 'the row that stays lit is the selected one')
  menu.rows[3].setHovered(false)
  menu.select(0, false)
  menu.handleKey(key('Enter'))
  eq(GameState.state, State.FIRST_RUN, 'PLAY opens the First Run contract page')
  frames()
})

step('the First Run page signs a contract and returns to the menu', () => {
  const page = active()
  frames(2, 0.1)
  const difficulty = page.groups.difficulty
  difficulty.step(1)
  eq(difficulty.value, 'Tactical', 'the difficulty pill group steps')
  page.groups.combat_pacing.pointerDown(page.groups.combat_pacing.pills[0].rect.x + 2, page.groups.combat_pacing.pills[0].rect.y + 2)
  eq(page.groups.combat_pacing.value, 'Table Mode (turn-based)', 'clicking a pill selects it')
  page.signAndDescend()
  eq(GameState.state, State.MENU, 'SIGN & DESCEND returns to the menu (documented deviation)')
  check(SaveStore.hasAnyContract(), 'the contract was written into the ledger')
  eq(SaveStore.latestContract().name, 'New contract', 'the P1 slot label is applied')
  eq(SaveStore.getSettings().difficulty, 'Tactical', 'the chosen settings are stored')
})

step('PLAY now opens the Begin-a-new-contract card', () => {
  const menu = active()
  menu.select(0, false)
  menu.handleKey(key('Enter'))
  eq(GameState.state, State.MENU, 'the card sits over the menu, not on a new page')
  check(menu.overlayOpen, 'the overlay is open')
  frames(2, 0.1)
  menu.handleKey(key('Escape'))
  check(!menu.overlayOpen, 'ESC closes the card')
})

step('the ledger lists the contract and breaks it', () => {
  const menu = active()
  menu.select(1, false)
  menu.handleKey(key('Enter'))
  eq(GameState.state, State.LEDGER, 'CONTINUE opens the ledger')
  const ledger = active()
  frames(2, 0.1)
  eq(ledger.rowText(0), 'New contract', 'slot 0 shows the signed contract')
  eq(ledger.rowText(1), '— empty —', 'slot 1 is empty')
  ledger.handleKey(key('Delete'))
  check(ledger.card !== null, 'DELETE opens the blood confirm card')
  frames(2, 0.1)
  ledger.onBreakConfirmed()
  eq(ledger.rowText(0), '— empty —', 'BREAK empties the slot')
  check(!SaveStore.hasAnyContract(), 'the ledger is empty again')
  ledger.goBack()
  eq(GameState.state, State.MENU, 'BACK returns to the menu')
})

step('the options page walks its five tabs', () => {
  const menu = active()
  menu.select(2, false)
  menu.handleKey(key('Enter'))
  eq(GameState.state, State.OPTIONS, 'OPTIONS opens the schema page')
  const options = active()
  for (let index = 0; index < 5; index += 1) {
    frames(2, 0.1)
    check(options.body.length > 0, `tab ${index} builds its rows`)
    options.handleKey(key('ArrowDown'))
    options.handleKey(key('ArrowRight'))
    options.showTab((options.tabIndex + 1) % 5)
  }
  options.showTab(3) // Audio: sliders
  frames(2, 0.1)
  const master = options.body.find((row) => row.rowId === 'volume_master')
  check(master !== undefined, 'the Audio tab has the master slider')
  master.setValue(40)
  eq(GameState.settings.volume_master, 40, 'moving a slider stores the value')

  options.showTab(4) // Controls: rebinds
  frames(2, 0.1)
  const interact = options.body.find((row) => row.rowId === 'bind_interact')
  options.startListening(interact)
  check(options.listening === interact, 'the rebind row arms')
  options.handleKey(key('KeyE'))
  eq(GameState.settings.bind_interact, 'E', 'the captured key shows on the rebind pill')
  eq(GameState.settings.bind_interact_keycode, 'KeyE', 'the key code is stored beside it')

  options.onBack()
  eq(GameState.state, State.MENU, 'BACK commits and returns to the menu')
})

step('the codex and credits stub cards open and close', () => {
  const menu = active()
  menu.select(3, false)
  menu.handleKey(key('Enter'))
  eq(GameState.state, State.STUB_CARD, 'CODEX opens its placeholder card')
  frames(2, 0.1)
  active().goBack()
  eq(GameState.state, State.MENU, 'the card closes back to the menu')
  menu.select(4, false)
  menu.handleKey(key('Enter'))
  eq(GameState.state, State.STUB_CARD, 'CREDITS opens its placeholder card')
  active().goBack()
  frames(2, 0.1)
})

step('the pointer drives the menu too', () => {
  const menu = active()
  const row = menu.rows[2]
  menu.handlePointerMove(row.rect.x + 4, row.rect.y + 4)
  eq(menu.selected, 2, 'hovering an item selects it')
  menu.handlePointerDown(row.rect.x + 4, row.rect.y + 4)
  eq(GameState.state, State.OPTIONS, 'clicking an item activates it')
  active().onBack()
  frames(3, 0.1)
})

step('dice keep working from the game instance', () => {
  const roll = Dice.d20Check(4, 12, Dice.Mode.STRAIGHT, 'combat', 'Smoke')
  check(roll.maths.includes(' vs 12'), 'a check produces its maths line')
  check(roll.total >= 5 && roll.total <= 24, 'the total is inside the d20 range plus the modifier')
}, { draw: false })

step('a corrupt save shows the scorched card', () => {
  localStorage.setItem('delve_v2', '{"schema":2,"slots":') // truncated on purpose
  SaveStore.load()
  check(SaveStore.corrupt, 'the corrupt document is detected')
  shell.go_to(State.LEDGER)
  frames(3, 0.1)
  const ledger = active()
  check(ledger.card !== null, 'the ledger opens the scorched card on a corrupt save')
  ledger.onRetry()
  check(ledger.card !== null, 'RETRY keeps the card up while the save is still broken')
  ledger.closeCard()
  SaveStore.deleteContract(0)
  localStorage.removeItem('delve_v2')
  SaveStore.load()
  shell.go_to(State.MENU)
  frames(2, 0.1)
})

console.log('')
if (failures.length === 0) {
  console.log(`${checks} runtime checks passed, ${drawCalls.count} draw calls`)
  process.exit(0)
}
console.log(`${failures.length} of ${checks} checks FAILED:`)
for (const failure of failures) console.log(`  - ${failure}`)
process.exit(1)
