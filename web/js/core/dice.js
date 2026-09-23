// Dice and RngStreams — the single authority for every roll (GDD-06 §6.4/§4.4).
//
// Nothing else may produce a rules outcome from `Math.random()`. Every
// player-facing d20 goes through `d20Check()`, which returns both dice, the kept
// die and the verbatim maths line for the Roll Moment.
//
// Rule references: R1 (the d20), R2 (advantage/disadvantage), R3 (AC & cover),
// R4 (checks vs DC).

export const Mode = { DISADVANTAGE: -1, STRAIGHT: 0, ADVANTAGE: 1 }

export const DEFAULT_ROOT_SEED = 20260923 // the day the pixel build was specced
export const STREAM_NAMES = ['world', 'combat', 'ai', 'fx']

/** mulberry32: 32-bit, seedable, and identical on every browser. */
function mulberry32(seed) {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** String -> 32-bit seed: FNV-1a over `"<root seed>:<stream>"`.
 *
 *  One seed per named stream is what keeps the spec's streams independent
 *  (§4.4): the combat stream cannot be advanced by a menu roll, and re-running a
 *  contract from the same save reproduces the same numbers. */

function hashSeed(text) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const Streams = {
  rootSeed: DEFAULT_ROOT_SEED,
  streams: {},

  reseedAll(seed = DEFAULT_ROOT_SEED) {
    this.rootSeed = seed
    this.streams = {}
    for (const name of STREAM_NAMES) this.stream(name)
  },

  /** The generator for `name`, created on demand if a caller invents a stream. */
  stream(name = 'combat') {
    if (!this.streams[name]) this.streams[name] = mulberry32(hashSeed(`${this.rootSeed}:${name}`))
    return this.streams[name]
  },

  /** Inclusive integer roll on a named stream. */
  intRangeOn(name, from, to) {
    const value = this.stream(name)()
    return from + Math.floor(value * (to - from + 1))
  },
}

// FNV-1a is the mix on purpose: it is short enough to read, stable across
// browsers and languages (a Python or Node replay of a seed gives the same
// bytes), and it never depends on a platform hash seed. What the spec fixes is
// the stream set and their independence (§4.4), and both are exact.

export const Dice = {
  Mode,
  history: [],
  HISTORY_LIMIT: 64,

  /** A single die of `sides`, drawn from a named stream. */
  die(sides = 20, streamName = 'combat') {
    if (sides < 2) {
      console.error(`Dice.die: sides must be >= 2 (got ${sides})`)
      return 1
    }
    return Streams.intRangeOn(streamName, 1, sides)
  },

  d20(streamName = 'combat') {
    return this.die(20, streamName)
  },

  /** Parse and roll `NdM+K` / `NdM-K` / `NdM`. */
  roll(expression, streamName = 'combat') {
    const match = /^(\d*)d(\d+)([+-]\d+)?$/.exec(String(expression).trim().toLowerCase())
    if (!match) {
      console.error(`Dice.roll: cannot parse '${expression}'`)
      return { expr: expression, rolls: [], modifier: 0, total: 0, natural: 0 }
    }
    const count = match[1] === '' ? 1 : Number(match[1])
    const sides = Number(match[2])
    const modifier = match[3] ? Number(match[3]) : 0
    const rolls = []
    let total = modifier
    for (let index = 0; index < count; index += 1) {
      const value = this.die(sides, streamName)
      rolls.push(value)
      total += value
    }
    const result = { expr: expression, rolls, modifier, total, natural: count === 1 && sides === 20 ? rolls[0] : 0 }
    this._record(result)
    return result
  },

  /** A rules check or attack roll: d20 + modifier against a target number. */
  d20Check(modifier, target, mode = Mode.STRAIGHT, streamName = 'combat', label = '') {
    const first = this.d20(streamName)
    const second = mode !== Mode.STRAIGHT ? this.d20(streamName) : 0
    let kept = first
    if (mode === Mode.ADVANTAGE) kept = Math.max(first, second)
    else if (mode === Mode.DISADVANTAGE) kept = Math.min(first, second)
    const total = kept + modifier
    const result = {
      kind: 'check',
      label,
      dice: mode !== Mode.STRAIGHT ? [first, second] : [first],
      kept,
      modifier,
      total,
      target,
      success: total >= target,
      natural: kept,
      critical: kept === 20,
      fumble: kept === 1,
      advantage: mode,
      // Verbatim maths line for the Roll Moment (R14): `14 + 5 = 19 vs 15`.
      maths: `${kept} + ${modifier} = ${total} vs ${target}`,
      verdict: this._verdict(total, target, kept),
    }
    this._record(result)
    return result
  },

  /** Passive score (R4): 10 + modifiers. */
  passive(modifier) {
    return 10 + modifier
  },

  /** Ability modifier from a score (R4): floor((score - 10) / 2). */
  abilityModifier(score) {
    return Math.floor((score - 10) / 2)
  },

  _verdict(total, target, kept) {
    if (kept === 20) return 'critical'
    if (kept === 1) return 'fumble'
    if (total >= target + 5) return 'clean'
    return total >= target ? 'success' : 'miss'
  },

  _record(result) {
    this.history.push(result)
    if (this.history.length > this.HISTORY_LIMIT) this.history.shift()
  },
}

Streams.reseedAll()

export const RngStreams = Streams
