// Screenshots of the real JavaScript renderer, without a browser.
//
//     node web/tests/shoot.mjs            # every screen → web/preview/shell-*.png
//     node web/tests/shoot.mjs menu       # one screen
//
// `smoke.mjs` proves the pages build, draw and take input; it cannot prove they
// *look* right, because its canvas stub throws every pixel away. This script
// swaps in a canvas that keeps them: `fillRect`, `drawImage` (with source
// rectangles, alpha and the one composite mode the text tint uses) and
// `clearRect` are rasterised into an RGBA buffer, which is then written as a PNG.
//
// That makes the browser the *second* renderer of any layout rather than the
// first: the Python previewer checks the data, this checks the JS, and the live
// site is what the player sees.

import { deflateSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB = join(HERE, '..')
const ROOT = join(WEB, '..')
const OUT = join(WEB, 'preview')
mkdirSync(OUT, { recursive: true })

// --- PNG decode, via the tools' own reader ------------------------------
//
// The art is palette-locked PNG; rather than re-implement PNG parsing here, the
// Python reader that the art lint already trusts decodes a file into raw RGBA.

const decodeCache = new Map()
function decodePNG(relPath) {
  if (decodeCache.has(relPath)) return decodeCache.get(relPath)
  const script = [
    'import sys, json',
    `sys.path.insert(0, ${JSON.stringify(join(ROOT, 'tools'))})`,
    'from lib.png_read import read_png',
    'canvas = read_png(sys.argv[1])',
    'sys.stdout.write(json.dumps({"w": canvas.width, "h": canvas.height,',
    '                                   "px": list(canvas.pixels)}))',
  ].join('\n')
  const raw = execFileSync('python3', ['-c', script, join(WEB, relPath)], { maxBuffer: 1 << 28 })
  const parsed = JSON.parse(raw.toString())
  const image = { width: parsed.w, height: parsed.h, data: Uint8ClampedArray.from(parsed.px) }
  decodeCache.set(relPath, image)
  return image
}

// --- a canvas that keeps its pixels -------------------------------------

function surface(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) }
}

function parseColour(value) {
  if (typeof value !== 'string') return [0, 0, 0, 1]
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
    ]
  }
  const rgba = /rgba?\(([^)]+)\)/.exec(value)
  if (rgba) {
    const parts = rgba[1].split(',').map((part) => Number(part.trim()))
    return [parts[0], parts[1], parts[2], parts[3] ?? 1]
  }
  return [0, 0, 0, 1]
}

function blend(target, alpha, r, g, b, a) {
  const inv = 1 - a
  target[0] = Math.round(r * a + target[0] * inv)
  target[1] = Math.round(g * a + target[1] * inv)
  target[2] = Math.round(b * a + target[2] * inv)
  target[3] = Math.max(target[3], Math.round(255 * a))
  void alpha
}

function makeContext(canvas) {
  const ctx = {
    canvas,
    fillStyle: '#000000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: false,
    save() {},
    restore() {},
    clearRect(x, y, w, h) {
      for (let py = Math.max(0, y); py < Math.min(canvas.height, y + h); py += 1) {
        for (let px = Math.max(0, x); px < Math.min(canvas.width, x + w); px += 1) {
          const offset = (py * canvas.width + px) * 4
          canvas.data.fill(0, offset, offset + 4)
        }
      }
    },
    fillRect(x, y, w, h) {
      const [r, g, b, base] = parseColour(ctx.fillStyle)
      const alpha = base * ctx.globalAlpha
      const left = Math.round(x)
      const top = Math.round(y)
      for (let py = Math.max(0, top); py < Math.min(canvas.height, top + Math.round(h)); py += 1) {
        for (let px = Math.max(0, left); px < Math.min(canvas.width, left + Math.round(w)); px += 1) {
          const offset = (py * canvas.width + px) * 4
          if (ctx.globalCompositeOperation === 'source-in') {
            // The text tint: keep the run's coverage, take the fill's colour.
            const coverage = canvas.data[offset + 3] / 255
            const value = alpha * coverage
            canvas.data[offset] = r
            canvas.data[offset + 1] = g
            canvas.data[offset + 2] = b
            canvas.data[offset + 3] = Math.round(255 * value)
            continue
          }
          blend(canvas.data.subarray(offset, offset + 4), alpha, r, g, b, alpha)
        }
      }
    },
    drawImage(source, ...args) {
      let sx = 0
      let sy = 0
      let sw = source.width
      let sh = source.height
      let dx = 0
      let dy = 0
      let dw = source.width
      let dh = source.height
      if (args.length === 2) {
        [dx, dy] = args
      } else if (args.length === 4) {
        [dx, dy, dw, dh] = args
      } else if (args.length === 8) {
        [sx, sy, sw, sh, dx, dy, dw, dh] = args
      }
      const alpha = ctx.globalAlpha
      for (let py = 0; py < dh; py += 1) {
        const ty = Math.round(dy) + py
        if (ty < 0 || ty >= canvas.height) continue
        const sourceY = sy + Math.floor((py * sh) / dh)
        for (let px = 0; px < dw; px += 1) {
          const tx = Math.round(dx) + px
          if (tx < 0 || tx >= canvas.width) continue
          const sourceX = sx + Math.floor((px * sw) / dw)
          const sOffset = (sourceY * source.width + sourceX) * 4
          const sAlpha = (source.data[sOffset + 3] / 255) * alpha
          if (sAlpha <= 0) continue
          const tOffset = (ty * canvas.width + tx) * 4
          blend(
            canvas.data.subarray(tOffset, tOffset + 4),
            sAlpha,
            source.data[sOffset],
            source.data[sOffset + 1],
            source.data[sOffset + 2],
            sAlpha,
          )
        }
      }
    },
    // The shell sets `imageSmoothingEnabled` and reads it back nowhere else.
    getImageData: (x, y, w, h) => ({ data: canvas.data, width: w, height: h, x, y }),
  }
  return ctx
}

function makeCanvas(width = 480, height = 270) {
  const canvas = surface(width, height)
  // A real canvas reallocates when its width/height is assigned; the text
  // tinting path relies on that, so the stub must behave the same way.
  Object.defineProperty(canvas, 'width', {
    get: () => canvas.__w,
    set: (value) => { canvas.__w = value; canvas.data = new Uint8ClampedArray(value * canvas.__h * 4) },
    configurable: true,
  })
  Object.defineProperty(canvas, 'height', {
    get: () => canvas.__h,
    set: (value) => { canvas.__h = value; canvas.data = new Uint8ClampedArray(canvas.__w * value * 4) },
    configurable: true,
  })
  canvas.__w = width
  canvas.__h = height
  canvas.style = {}
  canvas.getContext = () => makeContext(canvas)
  canvas.addEventListener = () => {}
  canvas.setPointerCapture = () => {}
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height })
  return canvas
}

// --- the DOM the shell needs --------------------------------------------

class StubImage {
  constructor() {
    this.width = 0
    this.height = 0
    this.data = new Uint8ClampedArray(0)
    this.onload = null
    this.onerror = null
  }

  set src(url) {
    setTimeout(() => {
      const path = String(url).replace(/^\.?\//, '')
      if (!existsSync(join(WEB, path)) || !path.endsWith('.png')) {
        this.onerror?.()
        return
      }
      try {
        const image = decodePNG(path)
        this.width = image.width
        this.height = image.height
        this.data = image.data
        this.onload?.()
      } catch (error) {
        this.onerror?.(error)
      }
    }, 0)
  }
}

globalThis.document = {
  readyState: 'complete',
  createElement: (tag) => (tag === 'canvas' ? makeCanvas(1, 1) : { style: {}, addEventListener: () => {} }),
  getElementById: () => (globalThis.__canvas ??= makeCanvas()),
  addEventListener: () => {},
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener: () => {}, matchMedia: () => ({ matches: false }) }
globalThis.location = { search: '' }
globalThis.localStorage = (() => {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
})()
globalThis.Image = StubImage
globalThis.matchMedia = () => ({ matches: false })
if (globalThis.navigator) Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => [], configurable: true })
globalThis.requestAnimationFrame = () => 0
globalThis.fetch = async (url) => {
  const path = join(WEB, String(url).replace(/^\.?\//, ''))
  if (!existsSync(path)) return { ok: false, status: 404, text: async () => '' }
  return { ok: true, status: 200, text: async () => readFileSync(path, 'utf8') }
}

// --- PNG encode ---------------------------------------------------------

function crc32(buffer) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let index = 0; index < 256; index += 1) {
      let value = index
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
      table[index] = value
    }
  }
  let crc = -1
  for (const byte of buffer) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff]
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

function writePNG(path, canvas) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(canvas.width, 0)
  header.writeUInt32BE(canvas.height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour with alpha
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height)
  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (canvas.width * 4 + 1)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < canvas.width * 4; x += 1) {
      raw[rowStart + 1 + x] = canvas.data[y * canvas.width * 4 + x]
    }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(path, png)
  return png.length
}

// --- drive the shell ----------------------------------------------------

const { Shell } = await import('../js/shell.js')
const { GameState, State } = await import('../js/core/state.js')
const { SaveStore } = await import('../js/core/save.js')

const canvas = globalThis.document.getElementById('screen')
const shell = new Shell(canvas)
await shell.boot()

const key = (code) => ({ type: 'keydown', code, key: '' })
const frames = (count = 6, delta = 0.1) => {
  for (let index = 0; index < count; index += 1) shell.render(delta)
}

const { Ui, Face } = await import('../js/ui/kit.js')

const wanted = process.argv.slice(2)
const shots = {
  legal: () => {},
  sting: () => {
    shell.go_to(State.STING)
    active().elapsed = 3.2
    active().update(0.001)
  },
  menu: () => shell.go_to(State.MENU),
  'menu-tooltip': () => {
    shell.go_to(State.MENU)
    const menu = active()
    menu.select(1, false)
  },
  'menu-new-contract': () => {
    SaveStore.load()
    SaveStore.createContract(0, { name: 'Testwrit', class: 'Fighter', level: 3, chapter: 'Prologue' })
    shell.go_to(State.MENU)
    active().openNewContractCard()
  },
  'first-run': () => shell.go_to(State.FIRST_RUN),
  ledger: () => {
    SaveStore.load()
    SaveStore.createContract(0, { name: 'Testwrit', class: 'Fighter', level: 3, chapter: 'Prologue', beats: ['T0', 'T1'] })
    shell.go_to(State.LEDGER)
  },
  'ledger-confirm': () => {
    shots.ledger()
    active().onDeleteRequested(0)
  },
  'ledger-scorched': () => {
    localStorage.setItem('delve_v2', '{oops')
    SaveStore.load()
    shell.go_to(State.LEDGER)
  },
  'options-graphics': () => {
    localStorage.removeItem('delve_v2')
    SaveStore.load()
    shell.go_to(State.OPTIONS)
  },
  'options-audio': () => {
    shell.go_to(State.OPTIONS)
    active().showTab(3)
  },
  'options-controls': () => {
    shell.go_to(State.OPTIONS)
    active().showTab(4)
    active().scrollBy(2)
  },
  'options-rebind': () => {
    shell.go_to(State.OPTIONS)
    const options = active()
    options.showTab(4)
    options.startListening(options.body.find((row) => row.rowId === 'bind_interact'))
  },
  options: () => {
    shell.go_to(State.OPTIONS)
    active().showTab(2)
  },
  stub: () => shell.go_to(State.STUB_CARD, { stub: 'codex' }),
  // A measuring stick, not a page: the three faces, side by side, so a glyph
  // atlas or a metrics change can be seen rather than guessed at.
  font: () => () => {
    shell.fade = null
    Ui.ground('#FFFFFF')
    Ui.label('PLAYA Sg1', 8, 8, { face: Face.DISPLAY, colour: '#101418' })
    Ui.label('PLAYA Sg1', 8, 40, { face: Face.BODY, colour: '#101418' })
    Ui.label('PLAYA Sg1', 8, 60, { face: Face.UI, colour: '#101418' })
  },
}

function active() {
  return shell.active
}

const names = wanted.length ? wanted : Object.keys(shots)
for (const name of names) {
  if (!shots[name]) {
    console.error(`no such shot: ${name}`)
    process.exit(2)
  }
  const overlay = shots[name]()
  frames()
  // A shot may return a painter callback to draw *over* the shell's frame —
  // the font ruler does this, because the shell would otherwise fade it out.
  if (typeof overlay === 'function') overlay()
  const bytes = writePNG(join(OUT, `shell-${name}.png`), canvas)
  console.log(`  wrote web/preview/shell-${name}.png (${(bytes / 1024).toFixed(1)} KB)`)
}
console.log(`\n${names.length} screenshot(s) from the JS renderer`)
