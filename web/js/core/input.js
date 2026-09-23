// InputActions — the shell's input map (GDD-07 §5.4/§5.6).
//
// Keyboard, mouse and gamepad are read every frame and folded into named
// actions (`menu_up`, `menu_accept`, `ui_left`, …). Screens only ever ask for an
// action, never for a key code, which is what makes the Controls tab's rebinding
// a data change rather than a code change.
//
// The twelve yard rows of §5.6 are registered with the spec's default keys so a
// rebind has something to overwrite before the yard exists; `applyOverrides()`
// re-applies the player's saved choices at boot.

const KEY_ALIASES = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'enter', NumpadEnter: 'enter', Escape: 'esc', Space: 'space', Tab: 'tab',
  ShiftLeft: 'shift', ShiftRight: 'shift', Delete: 'delete', Backspace: 'backspace',
}

/** Action -> default keys, in the spec's order (§5.6 Controls). */
export const YARD_BINDINGS = {
  game_move: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'up', 'left', 'down', 'right'],
  game_sprint: ['shift'],
  game_interact: ['KeyF'],
  game_end_turn: ['space'],
  game_pause: ['esc'],
  grid_overlay: ['KeyG'],
  folio: ['tab'],
  journal: ['KeyJ'],
  codex: ['KeyC'],
  hide: ['KeyH'],
  zoom_view: ['KeyV'],
  pad_layout: ['KeyB'],
}

const CODE_LABELS = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F', KeyG: 'G', KeyH: 'H',
  KeyJ: 'J', KeyC: 'C', KeyV: 'V', KeyB: 'B', KeyQ: 'Q', KeyE: 'E', KeyR: 'R',
  KeyT: 'T', KeyY: 'Y', KeyU: 'U', KeyI: 'I', KeyO: 'O', KeyK: 'K', KeyL: 'L',
  KeyM: 'M', KeyN: 'N', KeyP: 'P', KeyX: 'X', KeyZ: 'Z',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', enter: 'Enter',
  esc: 'Esc', space: 'Space', tab: 'Tab', shift: 'Shift', delete: 'Delete',
  backspace: 'Backspace',
}

/** A KeyboardEvent -> the code string the input map stores. */
export function eventCode(event) {
  if (!event) return ''
  if (KEY_ALIASES[event.code]) return KEY_ALIASES[event.code]
  if (KEY_ALIASES[event.key]) return KEY_ALIASES[event.key]
  if (/^[a-z]$/i.test(event.key ?? '')) return `Key${event.key.toUpperCase()}`
  if (/^[0-9]$/.test(event.key ?? '')) return `Digit${event.key}`
  return event.code ?? event.key ?? ''
}

/** A code string -> the label a rebind pill shows ("W", "Space", "Esc"). */
export function codeLabel(code) {
  if (CODE_LABELS[code]) return CODE_LABELS[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`
  if (/^F\d+$/.test(code)) return code
  return code.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export const InputActions = {
  bindings: { ...YARD_BINDINGS },
  _events: [],
  /** Held state per action, plus the edge state the shell asks about. */
  held: {},
  pressed: {},

  /**
   * Re-register every action with the player's saved rebinds. Called once at
   * boot; safe to call again after a rebind.
   */
  applyOverrides(settings = {}) {
    this.bindings = { ...YARD_BINDINGS }
    for (const row of Object.keys(YARD_BINDINGS)) {
      const saved = settings[`${row}_keycode`]
      if (saved) this.bindings[row] = [saved]
    }
    return this.bindings
  },

  /** Replace one action's binding (the rebind flow §5.6). */
  bind(rowId, code) {
    this.bindings[rowId] = [code]
  },

  /** Fold a key event into the action table. Returns the action, if any. */
  handleKey(event, down) {
    const code = eventCode(event)
    const action = Object.keys(this.bindings).find((key) => this.bindings[key].includes(code))
    if (!action) return ''
    if (down && !this.held[action]) this.pressed[action] = true
    this.held[action] = down
    return action
  },

  /** True once per physical press; screens call this from their key handler. */
  consume(action) {
    if (!this.pressed[action]) return false
    this.pressed[action] = false
    return true
  },

  clearEdges() {
    this.pressed = {}
  },
}

/** The shell-level action names the pages listen for, with their defaults. */
export const SHELL_ACTIONS = {
  menu_up: ['up', 'KeyW'],
  menu_down: ['down', 'KeyS'],
  menu_accept: ['enter', 'space', 'KeyF'],
  menu_back: ['esc'],
  ui_left: ['left', 'KeyA'],
  ui_right: ['right', 'KeyD'],
}
