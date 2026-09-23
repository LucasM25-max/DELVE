// SaveStore — the contract ledger, the options and the tutorial flags (GDD-07 §5.5).
//
// One JSON document in `localStorage`, schema 2, written atomically as far as the
// platform allows: the payload is only replaced once `JSON.stringify` has
// succeeded, so a failed write can never leave half a document behind. Eight
// slots, exactly as §5.5 draws them.
//
// Corrupt-save handling is a first-class path, not an afterthought: a document
// that will not parse sets `hasCorruptSave()`, and the ledger shows the §5.5
// "The ledger is scorched." card with RETRY / CONTINUE WITHOUT SAVING.

export const SAVE_KEY = 'delve_v2'
export const SCHEMA = 2
export const SLOT_COUNT = 8

/** localStorage in the browser; tests inject a Map-backed stand-in. */
const memory = () => {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
}

export const SaveStore = {
  storage: typeof localStorage === 'undefined' ? memory() : localStorage,
  slots: new Array(SLOT_COUNT).fill(null),
  tutorial: {},
  codexUnlocks: [],
  combatStats: {},
  settings: {},
  corrupt: false,
  _listeners: [],

  onChange(listener) {
    this._listeners.push(listener)
  },

  _emit() {
    for (const listener of this._listeners) listener()
  },

  /** Read the document. A missing key is a fresh player; a broken one is corrupt. */
  load() {
    this.slots = new Array(SLOT_COUNT).fill(null)
    this.tutorial = {}
    this.codexUnlocks = []
    this.combatStats = {}
    this.settings = {}
    const raw = this.storage.getItem(SAVE_KEY)
    if (raw === null || raw === '') {
      this.corrupt = false
      this._emit()
      return
    }
    let doc
    try {
      doc = JSON.parse(raw)
      if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) throw new Error('not an object')
    } catch (error) {
      console.warn(`SaveStore: ${SAVE_KEY} is corrupt (${error.message})`)
      this.corrupt = true
      this._emit()
      return
    }
    this.corrupt = false
    if (doc.schema !== undefined && Number(doc.schema) !== SCHEMA) {
      console.warn(`SaveStore: unexpected schema ${doc.schema} (expected ${SCHEMA}); loading anyway`)
    }
    const slots = Array.isArray(doc.slots) ? doc.slots : []
    for (let index = 0; index < Math.min(slots.length, SLOT_COUNT); index += 1) {
      const entry = slots[index]
      this.slots[index] = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : null
    }
    this.tutorial = doc.tutorial ?? {}
    this.codexUnlocks = doc.codex_unlocks ?? []
    this.combatStats = doc.combat_stats ?? {}
    this.settings = doc.settings ?? {}
    this._emit()
  },

  /** The slot dictionary at `index`, or {} when the slot is free. */
  slot(index) {
    const entry = this.slots[index]
    return entry && typeof entry === 'object' ? entry : {}
  },

  isSlotUsed(index) {
    return Object.keys(this.slot(index)).length > 0
  },

  hasAnyContract() {
    return this.slots.some((entry) => entry && Object.keys(entry).length > 0)
  },

  /** The most recently signed contract — the PLAY overlay names this one (§5.5). */
  latestContract() {
    let best = {}
    for (const entry of this.slots) {
      if (!entry || typeof entry !== 'object') continue
      if (!Object.keys(entry).length) continue
      if (!best.name || String(entry.signed_at ?? '') > String(best.signed_at ?? '')) best = entry
    }
    return best
  },

  firstEmptySlot() {
    return this.slots.findIndex((entry) => !entry || !Object.keys(entry).length)
  },

  /** Create a contract in `index`; false if the slot is taken or invalid. */
  createContract(index, fields = {}) {
    if (index < 0 || index >= SLOT_COUNT || this.isSlotUsed(index)) return false
    this.slots[index] = {
      name: fields.name ?? 'New contract',
      class: fields.class ?? '—',
      level: Number(fields.level ?? 1),
      chapter: fields.chapter ?? 'Prologue',
      signed_at: new Date().toISOString(),
      beats: fields.beats ?? [],
    }
    this.flush()
    this._emit()
    return true
  },

  deleteContract(index) {
    if (!this.isSlotUsed(index)) return false
    this.slots[index] = null
    this.flush()
    this._emit()
    return true
  },

  completedBeats() {
    return this.tutorial.completed_beats ?? []
  },

  markBeatComplete(id) {
    const beats = this.completedBeats()
    if (!beats.includes(id)) beats.push(id)
    this.tutorial.completed_beats = beats
    this.flush()
  },

  getSettings() {
    return { ...this.settings }
  },

  setSetting(rowId, value) {
    this.settings[rowId] = value
    this.flush()
  },

  /** Write the document. Called by every mutator that has to survive a reload. */
  flush() {
    const doc = {
      schema: SCHEMA,
      slots: this.slots,
      tutorial: this.tutorial,
      codex_unlocks: this.codexUnlocks,
      combat_stats: this.combatStats,
      settings: this.settings,
    }
    let text
    try {
      text = JSON.stringify(doc)
    } catch (error) {
      console.error(`SaveStore: cannot serialise the ledger (${error.message})`)
      return
    }
    try {
      this.storage.setItem(SAVE_KEY, text)
      this.corrupt = false
    } catch (error) {
      // Safari private mode and a full quota both land here. Losing the write is
      // survivable; losing the session is not, so the in-memory state stays.
      console.error(`SaveStore: cannot write (${error.message})`)
    }
  },
}
