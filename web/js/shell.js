// Shell — the static-site equivalent of the engine's autoloads and main scene.
//
// It owns the canvas, the screen swap, the frame clock and the input routing.
// There is no engine here: `index.html` loads this module, Vercel serves the
// files, and everything else — data, fonts, art, sound — is fetched over HTTP or
// sits in `localStorage`.
//
// Responsibilities, in order of the boot sequence:
//   1. size the canvas to the window and fit the 480×270 design space to it;
//   2. load `data/*.json`, the three text faces and the art the kit needs;
//   3. fold the save's settings over the schema defaults, apply the key rebinds;
//   4. show the legal screen, and from there the boot sequence runs itself.

import { ShellData, setLoader } from './core/data.js'
import { GameState, State } from './core/state.js'
import { InputActions, SHELL_ACTIONS } from './core/input.js'
import { SaveStore } from './core/save.js'
import { Sound } from './core/sound.js'
import { Palette } from './core/palette.js'
import { Painter, WIDTH, HEIGHT, fitViewport, preloadImages } from './ui/render.js'
import { loadFonts } from './ui/font.js'
import { Face, Rect, Ui, UI_DIR } from './ui/kit.js'
import { LegalScreen } from './screens/legal.js'
import { StingScreen } from './screens/sting.js'
import { MenuScreen } from './screens/menu.js'
import { StubScreen } from './screens/stub.js'
import { FirstRunScreen } from './screens/first_run.js'
import { LedgerScreen } from './screens/ledger.js'
import { OptionsScreen } from './screens/options.js'

/** Every image the shell may draw, so the first frame is never half-loaded. */
const SPRITES = [
  `${UI_DIR}logo_emblem.png`,
  `${UI_DIR}logo_menu.png`,
  `${UI_DIR}logo_emblem_steps.png`,
  `${UI_DIR}logo_emblem_step1.png`,
  `${UI_DIR}logo_emblem_step2.png`,
  `${UI_DIR}logo_wordmark_strip.png`,
  `${UI_DIR}wax_seal.png`,
  `${UI_DIR}item_cursor.png`,
]

const PATCHES = [
  'panel_parchment', 'panel_ink', 'panel_oak',
  'button_normal', 'button_hover', 'button_pressed', 'button_disabled',
  'button_blood_normal', 'button_blood_hover', 'button_blood_pressed', 'button_blood_disabled',
  'pill_normal', 'pill_selected', 'pill_hover',
  'tab_normal', 'tab_selected', 'tab_hover',
  'scrollbar_track', 'scrollbar_thumb',
  'tooltip_box',
]

export class Shell {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.painter = new Painter(this.ctx)
    this.screens = {}
    this.active = null
    this.fade = null
    this.pointer = { x: -1, y: -1, inside: false }
    this.scale = 1
    this.lastFrame = 0
    this.gamepadPrev = {}
    this.running = false
  }

  // --- boot -------------------------------------------------------------

  async boot() {
    ShellData.setLoader = setLoader // exported function, kept for clarity
    setLoader(this.loader.bind(this))
    await ShellData.load()
    const fonts = await loadFonts(this.loader.bind(this))
    await Ui.install(this.painter, fonts)
    await preloadImages([...SPRITES, ...PATCHES.map((name) => `${UI_DIR}${name}.png`)])

    // Settings: schema defaults, then whatever the save holds, then the rebinds.
    SaveStore.load()
    GameState.applySavedSettings(SaveStore.getSettings())
    InputActions.applyOverrides(GameState.settings)
    Sound.applySettings(GameState.settings)
    Sound.setMuted(String(GameState.settings.mute_when_unfocused ?? 'On') === 'On')

    this.buildScreens()
    this.resize()
    window.addEventListener('resize', () => this.resize())
    this.bindInput()
    this.installDebugHooks()
    this.enterInitialState()
  }

  /** `fetch` in the browser; the tests pass a file-system loader instead. */
  async loader(path) {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`)
    return response.text()
  }

  buildScreens() {
    this.screens = {
      legal: new LegalScreen(this),
      sting: new StingScreen(this),
      menu: new MenuScreen(this),
      stub: new StubScreen(this),
      first_run: new FirstRunScreen(this),
      ledger: new LedgerScreen(this),
      options: new OptionsScreen(this),
    }
    for (const screen of Object.values(this.screens)) screen.build()
    // Deep links are for the previews and for debugging: `?screen=options`.
    const requested = new URLSearchParams(location.search).get('screen')
    if (requested && this.screens[requested]) {
      GameState.state = requested
      localStorage.setItem('delve_debug_screen', requested)
    }
  }

  enterInitialState() {
    this.swap(GameState.state, {}, false)
  }

  // --- screen flow ------------------------------------------------------

  /**
   * Move to a screen. Screens call this through `ShellScreen.go_to()`; the shell
   * exits the old page, fades the new one in and never keeps two pages live.
   */
  go_to(state, payload = {}) {
    if (!this.screens[state]) {
      console.warn(`Shell: no screen registered for '${state}'`)
      return
    }
    GameState.transitionTo(state, payload)
    this.swap(state, payload)
  }

  swap(state, payload, animate = true) {
    const next = this.screens[state]
    if (!next) return
    if (this.active && this.active !== next) this.active.exit()
    GameState.payload = payload
    next.visible = true
    next.enter(payload)
    this.active = next
    if (animate) {
      const isMenu = !GameState.isBootState() && state !== 'sting'
      this.fade = {
        elapsed: 0,
        duration: (isMenu ? Number(ShellData.bootTiming().menu_fade_in_ms ?? 600) : Number(ShellData.screenTiming().fade_ms ?? 600)) / 1000,
        colour: isMenu ? '#FFFFFF' : Palette.ink,
      }
    }
  }

  // --- frame loop -------------------------------------------------------

  start() {
    this.running = true
    this.lastFrame = performance.now()
    const frame = (now) => {
      if (!this.running) return
      const delta = Math.min(0.1, (now - this.lastFrame) / 1000)
      this.lastFrame = now
      this.pollGamepad()
      this.active?.update(delta)
      this.render(delta)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  render(delta) {
    if (!this.active) return
    this.ctx.imageSmoothingEnabled = false
    this.active.draw()
    if (this.fade) {
      this.fade.elapsed += delta
      const progress = Math.min(1, this.fade.elapsed / Math.max(0.001, this.fade.duration))
      const alpha = 1 - progress
      if (alpha > 0) {
        this.painter.withAlpha(alpha, () => this.painter.rect(0, 0, WIDTH, HEIGHT, this.fade.colour))
      } else {
        this.fade = null
      }
    }
  }

  // --- sizing -----------------------------------------------------------

  /**
   * Fill the window.
   *
   * The canvas *is* the viewport: its backing store is the window in device
   * pixels (bounded — the shell repaints every frame), and `fitViewport` maps
   * the 480×270 design space onto it with one uniform scale, so the game reaches
   * two edges whichever way the window is shaped and keeps its proportions. What
   * the scale leaves over is split between the other two sides and painted by
   * the screen's own ground (`Painter.fillViewport`), so there is never a bar.
   */
  resize() {
    const cssW = Math.max(1, window.innerWidth)
    const cssH = Math.max(1, window.innerHeight)
    // Retina gets its extra pixels, up to a budget: 2.6 Mpx is more than the art
    // and the type need and it keeps a full repaint every frame cheap. Never
    // below 1 — a big window renders 1:1 rather than blurring the type.
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2,
      Math.sqrt(2_600_000 / (cssW * cssH))))
    const width = Math.max(WIDTH, Math.round(cssW * dpr))
    const height = Math.max(HEIGHT, Math.round(cssH * dpr))
    this.canvas.width = width
    this.canvas.height = height
    const viewport = fitViewport(width, height)
    this.scale = viewport.scale
    this.painter.setViewport(viewport)
    this.bounds = this.canvas.getBoundingClientRect()
    return viewport.scale
  }

  /** Window coordinates -> design pixels, integer-snapped. */
  toCanvas(event) {
    const rect = this.bounds ?? this.canvas.getBoundingClientRect()
    const toDevice = this.canvas.width / (rect.width || 1)
    const { scale, x, y } = this.painter.viewport
    return {
      x: Math.floor(((event.clientX - rect.left) * toDevice - x) / scale),
      y: Math.floor(((event.clientY - rect.top) * toDevice - y) / scale),
    }
  }

  // --- input ------------------------------------------------------------

  bindInput() {
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code)) event.preventDefault()
      InputActions.handleKey(event, true)
      this.active?.handleKey({ ...event, type: 'keydown' })
      // Any first input unlocks the audio graph, whatever screen is up.
      if (!Sound.isUnlocked()) Sound.unlock()
    })
    window.addEventListener('keyup', (event) => {
      InputActions.handleKey(event, false)
      this.active?.handleKey({ ...event, type: 'keyup' })
    })
    window.addEventListener('blur', () => InputActions.clearEdges())

    this.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return
      const point = this.toCanvas(event)
      this.pointer = { ...point, inside: true }
      this.active?.handlePointerMove(point.x, point.y)
    })
    this.canvas.addEventListener('pointerdown', (event) => {
      Sound.unlock()
      const point = this.toCanvas(event)
      this.canvas.setPointerCapture?.(event.pointerId)
      this.active?.handlePointerMove(point.x, point.y)
      this.active?.handlePointerDown(point.x, point.y)
    })
    this.canvas.addEventListener('pointerup', (event) => {
      const point = this.toCanvas(event)
      this.active?.handlePointerUp(point.x, point.y)
    })
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault()
      this.active?.handleWheel?.(Math.sign(event.deltaY))
    }, { passive: false })
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault())

    // §5.6: the pad drives the same actions as the keyboard.
    window.addEventListener('gamepadconnected', () => this.note('gamepad connected'))
  }

  /** Poll the first pad and translate its stick and buttons into the same actions. */
  pollGamepad() {
    const pads = navigator.getGamepads?.() ?? []
    const pad = Array.from(pads).find((candidate) => candidate && candidate.connected)
    if (!pad) return
    const axisY = pad.axes[1] ?? 0
    const axisX = pad.axes[0] ?? 0
    const presses = {
      up: axisY < -0.5 || pad.buttons[12]?.pressed,
      down: axisY > 0.5 || pad.buttons[13]?.pressed,
      left: axisX < -0.5 || pad.buttons[14]?.pressed,
      right: axisX > 0.5 || pad.buttons[15]?.pressed,
      enter: pad.buttons[0]?.pressed,
      esc: pad.buttons[1]?.pressed,
    }
    for (const [action, pressed] of Object.entries(presses)) {
      if (pressed && !this.gamepadPrev[action]) {
        Sound.unlock()
        this.active?.handleKey({ type: 'keydown', code: gamepadCode(action), key: '' })
      }
      this.gamepadPrev[action] = pressed
    }
  }

  // --- debugging hooks --------------------------------------------------

  /** `window.Delve` — the handles the smoke tests and the console use. */
  installDebugHooks() {
    window.Delve = {
      shell: this,
      screens: this.screens,
      state: () => GameState.state,
      go: (state, payload) => this.go_to(state, payload),
      data: ShellData,
      save: SaveStore,
      sound: Sound,
      dice: null,
      version: () => ShellData.strings,
      show: {
        menu: () => this.go_to(State.MENU),
        options: () => this.go_to(State.OPTIONS),
        ledger: () => this.go_to(State.LEDGER),
        firstRun: () => this.go_to(State.FIRST_RUN),
        legal: () => this.go_to(State.LEGAL),
        sting: () => this.go_to(State.STING),
        stub: (id) => this.go_to(State.STUB_CARD, { stub: id }),
      },
    }
  }

  note(message) {
    console.info(`[shell] ${message}`)
  }
}

function gamepadCode(action) {
  return { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', enter: 'Enter', esc: 'Escape' }[action] ?? ''
}

export { Face, Rect }
