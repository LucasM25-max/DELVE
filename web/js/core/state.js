// GameState — the shell's screen state machine (GDD-07 §5).
//
// One page is on stage at a time. Screens never reach into each other: they ask
// the state machine to move, and `shell.js` swaps the page. The state list is
// exactly the §5 journey — including the two pages that are not built yet
// (LOADING, YARD), which is how the menu knows where a Play button leads even
// while that destination is a stub.

import { ShellData } from './data.js'

export const State = {
  LEGAL: 'legal', // attribution screen; any input continues and unlocks audio
  STING: 'sting', // 4.0 s logo sting, skippable after 1.5 s
  MENU: 'menu', // the main menu (§5.4)
  STUB_CARD: 'stub', // placeholder page behind Codex / Credits
  FIRST_RUN: 'first_run', // the First Run contract page (§5.5)
  LEDGER: 'ledger', // the contract ledger (§5.5)
  OPTIONS: 'options', // schema-driven options page (§5.6)
  LOADING: 'loading', // loading screen (§5.9) — reserved, not built yet
  YARD: 'yard', // zone YRD (§6) — reserved, not built yet
}

/** Shell build version, mirrored into the menu version stamp. */
export const VERSION = '0.5.0-web'

export const GameState = {
  state: State.LEGAL,
  previousState: State.LEGAL,
  payload: {},
  activeMenuIndex: 0,
  /** Live options values; the schema defaults are layered in at boot. */
  settings: {},
  _listeners: [],

  onChange(listener) {
    this._listeners.push(listener)
  },

  transitionTo(next, payload = {}) {
    if (next === this.state) {
      // Still deliver the payload: `menu` uses it for the resume hand-off.
      this.payload = payload
      return
    }
    this.previousState = this.state
    this.state = next
    this.payload = payload
    for (const listener of this._listeners) listener(this.previousState, next)
  },

  isBootState() {
    return this.state === State.LEGAL || this.state === State.STING
  },

  /** Fold the save's choices over the schema defaults (called once at boot). */
  applySavedSettings(saved) {
    this.settings = { ...ShellData.optionDefaults(), ...saved }
    return this.settings
  },

  setSetting(rowId, value) {
    this.settings[rowId] = value
  },
}
