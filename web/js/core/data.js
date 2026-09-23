// ShellData — every string, timing, rect and schema the game draws, loaded once.
//
// The data files under `web/data/` are the single source of truth for the build:
// no screen hard-codes a label, a rect or a delay. `tools/check_project.py`
// validates the files' contents against GDD-07, and `tools/preview_screen.py`
// renders the same files offline, so a change here is visible three ways.

/** Node tests inject a file-system loader; the browser uses fetch(). */
let loader = async (path) => {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`)
  return response.text()
}

export function setLoader(next) {
  loader = next
}

export async function loadJSON(path) {
  return JSON.parse(await loader(path))
}

const DATA_DIR = 'data/'

export const ShellData = {
  strings: { spec: {}, build: {} },
  timings: {},
  content: {},
  schema: {},
  brand: {},
  cues: {},

  async load() {
    const [strings, timings, content, schema, brand, cues] = await Promise.all([
      loadJSON(`${DATA_DIR}strings.json`),
      loadJSON(`${DATA_DIR}shell_timings.json`),
      loadJSON(`${DATA_DIR}shell_content.json`),
      loadJSON(`${DATA_DIR}options_schema.json`),
      loadJSON(`${DATA_DIR}brand.json`),
      loadJSON(`${DATA_DIR}audio_cues.json`),
    ])
    this.strings = strings
    this.timings = timings
    this.content = content
    this.schema = schema
    this.brand = brand
    this.cues = cues
    return this
  },

  /** A string by id: the GDD's verbatim text first, this build's additions second. */
  t(id, args = []) {
    const raw = this.strings.spec?.[id] ?? this.strings.build?.[id]
    if (raw === undefined) {
      console.warn(`ShellData: missing string ${id}`)
      return id
    }
    return args.reduce((text, value, index) => text.split(`{${index}}`).join(String(value)), raw)
  },

  bootTiming() {
    return this.timings.boot ?? {}
  },

  stingTiming() {
    return this.timings.boot?.sting ?? {}
  },

  menuLayout() {
    return this.timings.menu ?? {}
  },

  screenTiming() {
    return this.timings.screens ?? {}
  },

  /** Every options row, flattened, keyed by id. */
  optionRows() {
    const rows = {}
    for (const tab of this.schema.tabs ?? []) {
      for (const row of tab.rows ?? []) rows[row.id] = row
    }
    return rows
  },

  /** Schema default per row id (§5.6). */
  optionDefaults() {
    const defaults = {}
    for (const [id, row] of Object.entries(this.optionRows())) defaults[id] = row.default
    return defaults
  },
}
