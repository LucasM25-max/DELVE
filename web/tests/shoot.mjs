// Rasterise every page — the third Node suite.
//
//     node web/tests/shoot.mjs                 # every screen → web/preview/*.png
//     node web/tests/shoot.mjs menu ledger     # just those two
//
// `run.mjs` checks the data and the maths; `smoke.mjs` checks that each page
// builds, draws and takes input — but its canvas throws every pixel away, so a
// screen that draws the wrong *picture* still passes. This suite closes that
// gap: it boots the real `Shell` against a DOM stub whose canvas keeps its
// pixels (`fillRect`, `drawImage` with source rects, alpha and the `source-in`
// composite the text tinting uses), then writes what it drew to a PNG.
//
// Images are decoded by the same Python reader the art lint uses
// (`tools/lib/png_read.py`), so there is one PNG decoder in the project and no
// dependency here. Output lands in `web/preview/` (git-ignored).
//
// The DOM stub and the shell instance live here and nowhere else: importing this
// module gives `web/tests/reel.mjs` the same booted shell to drive over time
// (`node web/tests/reel.mjs` records the boot sequence as a GIF).

import { execFileSync } from 'node:child_process'
import { deflateSync } from 'node:zlib'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB = join(HERE, '..')
const ROOT = join(WEB, '..')
const OUT = join(WEB, 'preview')

// --- images -------------------------------------------------------------

const imageCache = new Map()

/** Decode a PNG next to the page into `{ width, height, pixels }` (RGBA8). */
function decode(path) {
  if (imageCache.has(path)) return imageCache.get(path)
  const script = [
    'import sys',
    `sys.path.insert(0, ${JSON.stringify(join(ROOT, 'tools'))})`,
    'from lib.png_read import read_png',
    'canvas = read_png(sys.argv[1])',
    'sys.stdout.write("%d %d\\n" % (canvas.width, canvas.height))',
    'sys.stdout.flush()',
    'sys.stdout.buffer.write(bytes(canvas.pixels))',
  ].join('\n')
  const raw = execFileSync('python3', ['-c', script, join(WEB, path)], { maxBuffer: 1 << 28 })
  const newline = raw.indexOf(0x0a)
  const [width, height] = raw.subarray(0, newline).toString().split(' ').map(Number)
  const image = { width, height, pixels: raw.subarray(newline + 1) }
  imageCache.set(path, image)
  return image
}

class StubImage {
  constructor() {
    this.width = 0
    this.height = 0
    this.pixels = null
    this.onload = null
    this.onerror = null
  }

  set src(url) {
    const path = String(url).replace(/^\.?\//, '')
    if (!existsSync(join(WEB, path))) {
      queueMicrotask(() => this.onerror?.())
      return
    }
    const image = decode(path)
    this.width = image.width
    this.height = image.height
    this.pixels = image.pixels
    queueMicrotask(() => this.onload?.())
  }
}

// --- a canvas that keeps its pixels --------------------------------------

function parseColour(value) {
  if (typeof value !== 'string') return [0, 0, 0, 255]
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value)
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map((d) => d + d).join('') : hex[1]
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
      digits.length === 8 ? parseInt(digits.slice(6, 8), 16) : 255,
    ]
  }
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(value)
  if (rgba) {
    const parts = rgba[1].split(',').map((part) => Number(part.trim()))
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, Math.round((parts[3] ?? 1) * 255)]
  }
  return [0, 0, 0, 255]
}

class Surface {
  constructor(width, height) {
    this.__w = width
    this.__h = height
    this.pixels = Buffer.alloc(width * height * 4)
    this.style = {}
  }

  get width() { return this.__w }
  get height() { return this.__h }

  // A real canvas reallocates (and clears) when sized; the tinting path relies on it.
  set width(value) { this.__w = value; this.pixels = Buffer.alloc(value * this.__h * 4) }
  set height(value) { this.__h = value; this.pixels = Buffer.alloc(this.__w * value * 4) }

  getContext() { return this.ctx ??= new Context2D(this) }
  addEventListener() {}
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.__w, height: this.__h } }
}

class Context2D {
  constructor(surface) {
    this.surface = surface
    this.fillStyle = '#000000'
    this.globalAlpha = 1
    this.globalCompositeOperation = 'source-over'
    this.imageSmoothingEnabled = false
  }

  clearRect(x, y, w, h) {
    const { pixels } = this.surface
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(this.surface.height, y + h); py += 1) {
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(this.surface.width, x + w); px += 1) {
        pixels.fill(0, (py * this.surface.width + px) * 4, (py * this.surface.width + px) * 4 + 4)
      }
    }
  }

  fillRect(x, y, w, h) {
    const { pixels, width, height } = this.surface
    const [r, g, b, base] = parseColour(this.fillStyle)
    const alpha = (base / 255) * this.globalAlpha
    const left = Math.round(x)
    const top = Math.round(y)
    const right = Math.min(width, left + Math.round(w))
    const bottom = Math.min(height, top + Math.round(h))
    for (let py = Math.max(0, top); py < bottom; py += 1) {
      for (let px = Math.max(0, left); px < right; px += 1) {
        const offset = (py * width + px) * 4
        if (this.globalCompositeOperation === 'source-in') {
          // Keep the coverage the glyphs left, take the fill's colour.
          pixels[offset] = r
          pixels[offset + 1] = g
          pixels[offset + 2] = b
          pixels[offset + 3] = Math.round((pixels[offset + 3] / 255) * alpha * 255)
          continue
        }
        blend(pixels, offset, r, g, b, alpha)
      }
    }
  }

  /** `(image, dx, dy)` and `(image, sx, sy, sw, sh, dx, dy, dw, dh)`, nearest-neighbour. */
  drawImage(source, ...args) {
    const { pixels, width, height } = this.surface
    let [sx, sy, sw, sh, dx, dy, dw, dh] = [0, 0, source.width, source.height, 0, 0, source.width, source.height]
    if (args.length === 2) [dx, dy] = args
    else if (args.length === 4) [dx, dy, dw, dh] = args
    else if (args.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = args
    const alpha = this.globalAlpha
    const left = Math.round(dx)
    const top = Math.round(dy)
    const scaleX = sw / dw
    const scaleY = sh / dh
    for (let py = 0; py < dh; py += 1) {
      const ty = top + py
      if (ty < 0 || ty >= height) continue
      const sourceY = sy + Math.floor((py + 0.5) * scaleY)
      if (sourceY < 0 || sourceY >= source.height) continue
      for (let px = 0; px < dw; px += 1) {
        const tx = left + px
        if (tx < 0 || tx >= width) continue
        const sourceX = sx + Math.floor((px + 0.5) * scaleX)
        if (sourceX < 0 || sourceX >= source.width) continue
        const sourceOffset = (sourceY * source.width + sourceX) * 4
        const sourceAlpha = (source.pixels[sourceOffset + 3] / 255) * alpha
        if (sourceAlpha <= 0) continue
        blend(pixels, (ty * width + tx) * 4,
          source.pixels[sourceOffset], source.pixels[sourceOffset + 1], source.pixels[sourceOffset + 2], sourceAlpha)
      }
    }
  }
}

/** Source-over blend of one pixel, straight alpha. */
function blend(pixels, offset, r, g, b, alpha) {
  const inverse = 1 - alpha
  pixels[offset] = Math.round(r * alpha + pixels[offset] * inverse)
  pixels[offset + 1] = Math.round(g * alpha + pixels[offset + 1] * inverse)
  pixels[offset + 2] = Math.round(b * alpha + pixels[offset + 2] * inverse)
  pixels[offset + 3] = Math.round(alpha * 255 + (pixels[offset + 3] / 255) * inverse * 255)
}

// --- PNG output ---------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function writePNG(path, surface) {
  const { width, height, pixels } = surface
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour + alpha
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(path, png)
  return png.length
}

// --- the DOM the shell needs --------------------------------------------

const canvas = new Surface(480, 270)
const store = new Map()

globalThis.performance ??= { now: () => Date.now() }
globalThis.document = {
  readyState: 'complete',
  createElement: (tag) => (tag === 'canvas' ? new Surface(1, 1) : { style: {}, addEventListener() {} }),
  getElementById: (id) => (id === 'screen' ? canvas : null),
  addEventListener() {},
}
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  matchMedia: () => ({ matches: false }),
  Delve: {},
}
globalThis.Image = StubImage
// The shell reads `?screen=` for deep links; the harness uses the normal entry.
globalThis.location = { search: '' }
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}
// Node 22 defines `navigator` as a getter, so the shape is patched in place.
Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => [], configurable: true })
globalThis.requestAnimationFrame = () => 0
globalThis.fetch = async (url) => {
  const path = String(url).replace(/^\.?\//, '')
  const file = join(WEB, path)
  if (!existsSync(file)) return { ok: false, status: 404, text: async () => '' }
  return { ok: true, status: 200, text: async () => readFileSync(file, 'utf8') }
}

// --- drive the shell ----------------------------------------------------

const { Shell } = await import('../js/shell.js')
const { GameState, State } = await import('../js/core/state.js')
const { SaveStore } = await import('../js/core/save.js')
const { Ui, Face } = await import('../js/ui/kit.js')
const { Palette } = await import('../js/core/palette.js')

const shell = new Shell(canvas)
await shell.boot()
mkdirSync(OUT, { recursive: true })

/** Run enough frames for the entry fade (600 ms) to finish. */
function settle(frames = 8, delta = 0.1) {
  for (let index = 0; index < frames; index += 1) shell.render(delta)
}

const key = (code) => ({ code, key: code, type: 'keydown' })
const contract = () => SaveStore.createContract(0, {
  name: 'Testwrit', class: 'Fighter', level: 3, chapter: 'Prologue', beats: ['T0', 'T1'],
})

const shots = {
  legal: () => {},
  sting: () => {
    shell.go_to(State.STING)
    // Mid-sequence: emitter drawn, two steps lit, wordmark mid-chisel.
    const sting = shell.active
    sting.elapsed = 2.5
    sting.update(0.001)
  },
  menu: () => shell.go_to(State.MENU),
  'menu-hover': () => {
    shell.go_to(State.MENU)
    shell.active.handlePointerMove(80, 140)
  },
  'menu-tooltip': () => {
    shell.go_to(State.MENU)
    // CONTINUE is dimmed with no ledger entry, so hovering it shows the tooltip.
    shell.active.handlePointerMove(80, 113)
  },
  'menu-new-contract': () => {
    contract()
    shell.go_to(State.MENU)
    shell.active.onKey(key('Enter'))
  },
  // The page dims whatever is behind it (first_run.draw() opens with Ui.dim(0.6)),
  // so the shot has to arrive the way the game does — from the menu — or it
  // photographs a backdrop no player ever sees.
  'first-run': () => {
    shell.go_to(State.MENU)
    settle()
    shell.go_to(State.FIRST_RUN)
  },
  ledger: () => {
    shell.go_to(State.LEDGER)
  },
  'ledger-confirm': () => {
    shell.go_to(State.LEDGER)
    const ledger = shell.active
    ledger.onKey(key('Delete'))
  },
  'ledger-corrupt': () => {
    localStorage.setItem('delve_v2', '{oops')
    SaveStore.load()
    shell.go_to(State.LEDGER)
  },
  'options-graphics': () => shell.go_to(State.OPTIONS),
  'options-audio': () => {
    shell.go_to(State.OPTIONS)
    shell.active.showTab(3)
  },
  'options-controls': () => {
    shell.go_to(State.OPTIONS)
    shell.active.showTab(4)
    shell.active.scrollBy(2)
  },
  'options-rebind': () => {
    shell.go_to(State.OPTIONS)
    const options = shell.active
    options.showTab(4)
    options.startListening(options.body[2])
  },
  'options-accessibility': () => {
    shell.go_to(State.OPTIONS)
    shell.active.showTab(2)
  },
  'sting-end': () => {
    shell.go_to(State.STING)
    const sting = shell.active
    sting.elapsed = 3.9
    sting.update(0.001)
  },
  codex: () => shell.go_to(State.STUB_CARD, { stub: 'codex' }),
  credits: () => shell.go_to(State.STUB_CARD, { stub: 'credits' }),
  // A measuring stick rather than a page: the three faces side by side, so a
  // font or metric regression is visible in the images.
  faces: () => () => {
    Ui.ground('#FFFFFF')
    Ui.label('PLAYA Sg1 jam', 8, 6, { face: Face.DISPLAY, colour: Palette.ink })
    Ui.label('The quick brown fox jumps over it.', 8, 30, { face: Face.BODY, colour: Palette.ink })
    Ui.label('PRESS ANY BUTTON TO CONTINUE.', 8, 48, { face: Face.UI, colour: Palette.ink })
    Ui.label('0123456789 · 480×270 · 16 px', 8, 64, { face: Face.BODY, colour: Palette.stone_1 })
    Ui.panel('panel_parchment', { x: 8, y: 90, w: 180, h: 60 })
    Ui.panel('panel_ink', { x: 200, y: 90, w: 180, h: 60 })
    Ui.patch('button', { x: 8, y: 160, w: 120, h: 18 }, { state: 'normal' })
    Ui.patch('pill', { x: 140, y: 160, w: 90, h: 16 }, { state: 'selected' })
    Ui.sprite('wax_seal', 250, 158)
    Ui.sprite('item_cursor', 300, 160)
  },
}

export { canvas, shell, settle, writePNG, OUT }

// Importing the module is how the reel gets a booted shell; only a direct run
// writes the page images.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
const names = process.argv.slice(2).filter((name) => !name.startsWith('-'))
const wanted = names.length ? names : Object.keys(shots)
for (const name of wanted) {
  if (!shots[name]) {
    console.error(`  no such shot: ${name}`)
    process.exit(2)
  }
  // Each shot starts from a clean ledger unless it is the one that tests a full one.
  if (!['menu-new-contract', 'ledger', 'ledger-confirm'].includes(name)) {
    localStorage.removeItem('delve_v2')
    for (let slot = 0; slot < 8; slot += 1) SaveStore.deleteContract(slot)
    SaveStore.flush()
  }
  // A shot may return a painter callback, run *after* the frames are settled, so
  // a diagnostic surface is not drawn over by the page underneath it.
  const overlay = shots[name]()
  settle()
  if (typeof overlay === 'function') overlay()
  const bytes = writePNG(join(OUT, `shell-${name}.png`), canvas)
  console.log(`  wrote web/preview/shell-${name}.png (${(bytes / 1024).toFixed(1)} KB)`)
}

console.log(`\n${wanted.length} page image(s) in web/preview/`)
checkTextInk()
}
void GameState

/**
 * Tinted text must ink the whole glyph box.
 *
 * `info size` in an `.fnt` is the nominal em, not the ink: the display face says
 * 10 px and its glyphs are 14 px tall. A tint that fills only `font.px` rows
 * leaves the bottom of every glyph white — invisible on the white menu ground,
 * where `PLAY` drew as a stem, a box and a Y. Each face is measured here instead,
 * which is how that was found (PIXEL_MENU_BUILD_NOTES §3.1, defect 4).
 */
function checkTextInk() {
  const failures = []
  Ui.ground('#FFFFFF')
  ;[Face.DISPLAY, Face.BODY, Face.UI].forEach((face, row) => {
    const font = Ui.font(face)
    // The two glyphs that reach highest and lowest, so the probe spans the face's
    // whole box; the expected rows come from the same descriptor the painter uses.
    const box = { top: Infinity, bottom: -Infinity, characters: [] }
    for (const [code, glyph] of font.chars) {
      if (glyph.w <= 0) continue
      if (glyph.offsetY < box.top) { box.top = glyph.offsetY; box.characters[0] = String.fromCharCode(code) }
      if (glyph.offsetY + glyph.h > box.bottom) { box.bottom = glyph.offsetY + glyph.h; box.characters[1] = String.fromCharCode(code) }
    }
    const probe = box.characters.join('')
    const top = 8 + row * 80
    Ui.label(probe, 8, top, { face, colour: Palette.ink })
    let first = null
    let last = null
    for (let y = top; y < top + 40; y += 1) {
      for (let x = 8; x < 8 + font.measure(probe); x += 1) {
        const offset = (y * canvas.width + x) * 4
        const ink = canvas.pixels[offset] !== 255 || canvas.pixels[offset + 1] !== 255 || canvas.pixels[offset + 2] !== 255
        if (!ink) continue
        if (first === null) first = y
        last = y
      }
    }
    const expected = box.bottom - box.top
    const height = first === null ? 0 : last - first + 1
    if (height !== expected || (first !== null && first - top !== box.top)) {
      failures.push(`${face}: tinted text inks rows ${first === null ? 'none' : `${first - top}..${last - top}`}, the face measures ${box.top}..${box.bottom - 1}`)
    }
  })
  if (failures.length > 0) {
    for (const line of failures) console.error(`  ! ${line}`)
    console.error('  tinted text is clipped — see tintedRun() in web/js/ui/font.js')
    process.exitCode = 1
    return
  }
  console.log('  tinted text inks its full glyph box on all three faces')
}
