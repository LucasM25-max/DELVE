// Sound — the cue table, the four buses and the browser's gesture gate
// (GDD-07 §5.10, §8).
//
// Every cue in `data/audio_cues.json` is addressable by id from the first frame,
// whether or not its file exists yet: a cue whose file is missing logs once and
// plays nothing, exactly like the spec's "sound lands cue by cue" pipeline. That
// keeps the game silent-but-correct while the audio is still being produced.
//
// Browsers refuse to start audio without a user gesture, so `unlock()` is called
// from the legal screen's "press any button" and anything asked for earlier is
// queued.

import { ShellData } from './data.js'

const BUSES = ['Master', 'Music', 'SFX', 'Voice']
const AUDIO_BASE = 'assets/audio/'

export const Sound = {
  ctx: null,
  gains: {},
  buffers: {},
  current: { music: null, ambience: null },
  _failed: new Set(),
  _queued: [],
  _unlocked: false,
  settings: {},
  muted: false,

  /** Create the audio graph. Safe to call before the gesture; it stays silent. */
  ready() {
    if (this.ctx) return this.ctx
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext
    if (!Ctor) return null
    this.ctx = new Ctor()
    this.gains = {}
    for (const name of BUSES) {
      const gain = this.ctx.createGain()
      gain.gain.value = 1
      gain.connect(name === 'Master' ? this.ctx.destination : this.gains.Master)
      this.gains[name] = gain
    }
    this.applySettings(this.settings)
    return this.ctx
  },

  /** The gesture gate: called by the legal screen, and by any first input. */
  unlock() {
    if (this._unlocked) return
    this._unlocked = true
    const ctx = this.ready()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    const queued = this._queued.slice()
    this._queued = []
    for (const cue of queued) this.play(cue.id, cue.volumeDb)
  },

  isUnlocked() {
    return this._unlocked
  },

  queueAfterUnlock(id) {
    if (this._unlocked) this.play(id)
    else this._queued.push({ id, volumeDb: 0 })
  },

  /** Play a one-shot cue. Unknown or unloaded cues are no-ops. */
  play(id, volumeDb = 0) {
    if (!this._unlocked) {
      this.queueAfterUnlock(id)
      return
    }
    this._play(id, volumeDb, false)
  },

  /** Play (or restart) a looping cue: music and ambience beds. */
  playLoop(id) {
    const cue = ShellData.cues.cues?.[id]
    if (!cue) return
    if (!this._unlocked) {
      this.queueAfterUnlock(id)
      return
    }
    const bus = cue.type === 'music' ? 'music' : 'ambience'
    if (this.current[bus] === id) return
    this.stopBus(bus)
    this.current[bus] = id
    this._play(id, 0, true)
  },

  stopBus(which, fadeSeconds = 0) {
    const node = this.current[`${which}_node`]
    if (node && this.ctx) {
      const end = this.ctx.currentTime + Math.max(fadeSeconds, 0.01)
      node.gain.cancelScheduledValues(this.ctx.currentTime)
      node.gain.setValueAtTime(node.gain.value, this.ctx.currentTime)
      node.gain.linearRampToValueAtTime(0.0001, end)
      node.stop(end + 0.02)
    }
    this.current[`${which}_node`] = null
    this.current[which] = null
  },

  stopMusic(fadeSeconds = 0) {
    this.stopBus('music', fadeSeconds)
  },

  stopAll() {
    this.stopBus('music')
    this.stopBus('ambience')
  },

  /** Volume in 0-100, the unit the options sliders use (§5.6). */
  setBusVolume(busName, value0to100) {
    const gain = this.gains[busName]
    if (!gain) return
    const linear = Math.max(0, Math.min(1, value0to100 / 100))
    gain.gain.value = linear * linear // a little perceptual taper
  },

  /** Apply an options dictionary: volumes, then the focus rule. */
  applySettings(settings = {}) {
    this.settings = { ...this.settings, ...settings }
    if (!this.ctx) return
    const map = {
      volume_master: 'Master',
      volume_music: 'Music',
      volume_sfx: 'SFX',
      volume_voice: 'Voice',
    }
    for (const [row, bus] of Object.entries(map)) {
      const value = this.settings[row]
      if (value !== undefined) this.setBusVolume(bus, Number(value))
    }
  },

  /** §5.6 `Mute when unfocused` (default On). */
  setMuted(muted) {
    this.muted = muted
    if (this.gains.Master) this.gains.Master.gain.value = muted ? 0 : this._masterGain()
  },

  _masterGain() {
    const value = Number(this.settings.volume_master ?? 90) / 100
    return value * value
  },

  // --- internals -------------------------------------------------------

  async _play(id, volumeDb, loop) {
    const cue = ShellData.cues.cues?.[id]
    if (!cue) return
    const ctx = this.ready()
    if (!ctx) return
    const buffer = await this._buffer(id, cue)
    if (!buffer) return
    const bus = this._busFor(cue)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = loop
    const gain = ctx.createGain()
    gain.gain.value = 10 ** (volumeDb / 20)
    source.connect(gain).connect(this.gains[bus] ?? this.gains.Master)
    if (loop) {
      const which = cue.type === 'music' ? 'music' : 'ambience'
      source.start()
      this.current[`${which}_node`] = source
      this.current[which] = id
    } else {
      source.start()
    }
  },

  _busFor(cue) {
    if (cue.type === 'music' || cue.type === 'ambience') return 'Music'
    if (String(cue.id ?? '').startsWith('VO_') || String(cue.type) === 'voice') return 'Voice'
    return 'SFX'
  },

  /** Fetch + decode, cached. A missing file is reported once and remembered. */
  async _buffer(id, cue) {
    if (this.buffers[id]) return this.buffers[id]
    if (this._failed.has(id)) return null
    const ctx = this.ready()
    if (!ctx) return null
    const file = String(cue.file ?? '')
    if (!file) {
      this._failed.add(id)
      return null
    }
    const url = `${AUDIO_BASE}${file.replace(/^res:\/\/assets\/audio\//, '').replace(/^assets\/audio\//, '')}`
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = await response.arrayBuffer()
      const buffer = await ctx.decodeAudioData(bytes)
      this.buffers[id] = buffer
      return buffer
    } catch (error) {
      this._failed.add(id)
      console.info(`[sound] cue '${id}' has no audio file yet (${error.message})`)
      return null
    }
  },
}
