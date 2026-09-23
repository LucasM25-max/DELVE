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

// --- the offline text atlas ---------------------------------------------
//
// The page draws its text with a webfont; a Node process has no font
// rasteriser, so the previews draw the same strings from the 1:1 coverage atlas
// `tools/build_text_faces.py` bakes next to it. Faces are keyed by the CSS font
// string the pages set (`600 15px "Delve Sans"`), so text lands where the page
// puts it.

const atlas = JSON.parse(readFileSync(join(ROOT, 'tools', 'atlas', 'glyph_atlas.json'), 'utf8'))
const metrics = JSON.parse(readFileSync(join(WEB, 'assets', 'fonts', 'font_metrics.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(WEB, 'data', 'fonts.json'), 'utf8'))
const atlasImages = new Map()

function atlasFaceFor(font) {
  const match = /^(\d+)\s+([\d.]+)px\s+"([^"]+)"/.exec(String(font))
  if (!match) return null
  const [, weight, size, family] = match
  if (family !== manifest.family) return null
  for (const [role, face] of Object.entries(atlas.faces)) {
    const source = manifest.faces[role]
    if (Number(weight) === Number(face.weight) && Number(size) === Number(source.size)) return face
  }
  return null
}

function atlasOk(face) { return Boolean(face && face.file) }

/** Advance in whole pixels: the same rounding the page and the Python gate use. */
function advanceOf(face, character) {
  const source = metrics.sources[face.source]
  const units = source.advances[character.charCodeAt(0)]
  if (units === undefined) return Math.max(1, Math.round(face.size * 0.5))
  return Math.max(1, Math.round((units * face.size) / source.unitsPerEm))
}

function atlasPixels(file) {
  // `decode()` resolves against `web/`; the atlas lives in `tools/atlas/`.
  const path = join('..', 'tools', 'atlas', file)
  if (!atlasImages.has(path)) atlasImages.set(path, decode(path))
  return atlasImages.get(path)
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
    this.canvas = surface
    this.fillStyle = '#000000'
    this.globalAlpha = 1
    this.globalCompositeOperation = 'source-over'
    this.imageSmoothingEnabled = false
    this.font = '400 10px "Delve Sans"'
    this.textAlign = 'left'
    this.textBaseline = 'alphabetic'
    this.transform = { scale: 1, x: 0, y: 0 }
    this.stack = []
  }

  /**
   * The shell's viewport transform.
   *
   * These previews are renders of the 480×270 design space at 1:1 — that is what
   * makes them comparable frame to frame — so the harness keeps the window at
   * the design size and the only transform it ever sees is the identity one. The
   * full-screen mapping is `fitViewport()` in `web/js/ui/render.js`, unit-tested
   * in `run.mjs`; a shot that resizes the window has to teach this stub how to
   * scale first, and this refuses rather than drawing something wrong.
   */
  setTransform(scale, _skewX, _skewY, _scaleY, x, y) {
    if (scale === 1 && x === 0 && y === 0) {
      this.transform = { scale: 1, x: 0, y: 0 }
      return
    }
    throw new Error(`shoot stub: unsupported viewport transform (scale ${scale}, ${x}, ${y})`)
  }

  save() {
    this.stack.push({
      fillStyle: this.fillStyle,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      font: this.font,
    })
  }

  restore() {
    const state = this.stack.pop()
    if (state) Object.assign(this, state)
  }

  /** Text, drawn glyph by glyph from the offline atlas (`tools/atlas/`). */
  fillText(string, x, y) {
    const face = atlasFaceFor(this.font)
    if (!face || !face.file) return
    const pixels = atlasPixels(face.file)
    const [r, g, b, base] = parseColour(this.fillStyle)
    const alpha = (base / 255) * this.globalAlpha
    let pen = Math.round(x)
    const top = Math.round(y) - face.ascent
    for (const character of String(string)) {
      const rect = face.glyphs[character.charCodeAt(0)]
      if (rect) {
        const [sx, sy, sw, sh, offsetX, offsetY] = rect
        for (let row = 0; row < sh; row += 1) {
          for (let column = 0; column < sw; column += 1) {
            const source = ((sy + row) * pixels.width + sx + column) * 4
            const coverage = pixels.pixels[source + 3] / 255
            if (coverage <= 0) continue
            const dx = pen + offsetX + column
            const dy = top + offsetY + row
            if (dx < 0 || dy < 0 || dx >= this.surface.width || dy >= this.surface.height) continue
            blend(this.surface.pixels, (dy * this.surface.width + dx) * 4, r, g, b, coverage * alpha)
          }
        }
      }
      pen += advanceOf(face, character)
    }
  }

  /** The metrics table is the authority on widths, exactly as in the page. */
  measureText(string) {
    const face = atlasFaceFor(this.font)
    let width = 0
    for (const character of String(string)) width += face ? advanceOf(face, character) : 0
    return { width }
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
  // The design space: these previews are 1:1 renders of it (see Context2D.setTransform).
  innerWidth: 480,
  innerHeight: 270,
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

for (const face of Object.values(atlas.faces)) atlasPixels(face.file)

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
  // The menu with a contract in the ledger: the right-hand card carries it.
  'menu-contract': () => {
    contract()
    shell.go_to(State.MENU)
  },
  // The §5.4 flicker: the emblem's steps lit for 0.2 s after a selection.
  'menu-flicker': () => {
    shell.go_to(State.MENU)
    shell.active.select(0, false)
    // The state `flickerEmblem()` leaves behind, without the navigation a real
    // confirmation would trigger (the menu holds no save in this run).
    shell.active.emblemLit = true
    shell.active.flickerUntil = 0.2
  },
  // The same menu with the new-contract card open over it (§5.5). The selection
  // is set explicitly: shots share one shell, and a hover from an earlier shot
  // would otherwise leave ENTER aimed at whichever row that shot touched.
  'menu-new-contract': () => {
    contract()
    shell.go_to(State.MENU)
    shell.active.select(0, false)
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
  // A measuring stick rather than a page: every shipped face side by side, so a
  // font or metric regression is visible in the images.
  faces: () => () => {
    Ui.ground('#FFFFFF')
    Ui.label('PLAYA Sg1 jam', 8, 6, { face: Face.DISPLAY, colour: Palette.ink })
    Ui.label('DELVE', 8, 24, { face: Face.WORDMARK, colour: Palette.ink })
    Ui.label('The quick brown fox jumps over it.', 8, 54, { face: Face.BODY, colour: Palette.ink })
    Ui.label('PRESS ANY BUTTON TO CONTINUE.', 8, 72, { face: Face.UI, colour: Palette.ink })
    Ui.label('0123456789 · 480×270 · 16 px', 8, 88, { face: Face.BODY, colour: Palette.stone_1 })
    Ui.panel('panel_parchment', { x: 8, y: 110, w: 180, h: 60 })
    Ui.panel('panel_ink', { x: 200, y: 110, w: 180, h: 60 })
    Ui.patch('button', { x: 8, y: 180, w: 120, h: 18 }, { state: 'normal' })
    Ui.patch('pill', { x: 140, y: 180, w: 90, h: 16 }, { state: 'selected' })
    Ui.sprite('wax_seal', 250, 178)
    Ui.sprite('item_cursor', 300, 180)
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
 * Text must ink the whole glyph box, on every face.
 *
 * The faces are drawn from the same coverage atlas the offline renderer blits,
 * so the honest question is whether a string lands where the metrics say it
 * will: the two characters that reach highest and lowest in the face are drawn
 * as one probe, and the ink has to fill those rows exactly — top row to bottom
 * row, no clipped ascender, no descender left outside the line box. This is the
 * check that caught the 4 px short ink box of the bitmap build (see
 * `docs/PIXEL_MENU_BUILD_NOTES.md` §3.1) and it still catches a face whose
 * ascent/descent no longer hold its glyphs.
 */
function checkTextInk() {
  const failures = []
  Ui.ground('#FFFFFF')
  ;[Face.DISPLAY, Face.WORDMARK, Face.BODY, Face.UI].forEach((face, row) => {
    const definition = manifest.faces[face]
    const cell = atlasFaceFor(`${atlas.faces[face].weight} ${definition.size}px "${manifest.family}"`)
    if (!cell) {
      failures.push(`${face}: no offline atlas cell for ${definition.size}px`)
      return
    }
    let top = Infinity
    let bottom = -Infinity
    const characters = []
    for (const [code, rect] of Object.entries(cell.glyphs)) {
      const [, , width, height, , offsetY] = rect
      if (width <= 0 || height <= 0) continue
      if (offsetY < top) { top = offsetY; characters[0] = String.fromCharCode(code) }
      if (offsetY + height > bottom) { bottom = offsetY + height; characters[1] = String.fromCharCode(code) }
    }
    const probe = characters.join('')
    // Four faces on one 270 px canvas: 64 px rows, the probe drawn in the top 60.
    const originY = 8 + row * 64
    Ui.label(probe, 8, originY, { face, colour: Palette.ink })
    let first = null
    let last = null
    for (let y = originY; y < originY + 60; y += 1) {
      for (let x = 8; x < 8 + 60; x += 1) {
        const offset = (y * canvas.width + x) * 4
        const ink = canvas.pixels[offset] !== 255 || canvas.pixels[offset + 1] !== 255 || canvas.pixels[offset + 2] !== 255
        if (!ink) continue
        if (first === null) first = y
        last = y
      }
    }
    if (first === null) {
      failures.push(`${face}: '${probe}' drew nothing`)
      return
    }
    if (first - originY !== top || last - originY !== bottom - 1) {
      failures.push(`${face}: '${probe}' inks rows ${first - originY}..${last - originY}, the atlas measures ${top}..${bottom - 1}`)
    }
  })
  if (failures.length > 0) {
    for (const line of failures) console.error(`  ! ${line}`)
    console.error('  text does not fill its line box — see tools/build_text_faces.py')
    process.exitCode = 1
    return
  }
  console.log(`  text inks its full line box on all ${[Face.DISPLAY, Face.WORDMARK, Face.BODY, Face.UI].length} faces`)
}

