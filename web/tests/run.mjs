// Node test runner for the web build — the port of the engine build's
// `tests/test_runner.gd`, so the same assertions guard the same behaviour.
//
//     node web/tests/run.mjs
//
// Exits 0 when every check passes, 1 otherwise. No test framework and no
// dependencies: the suite is a list of small functions, each asserting through
// `check()` / `eq()`, so it runs on a bare Node install and in CI next to the
// Python gates.
//
// Coverage (GDD-07 §13 QA list, the parts that exist in this build):
//   palette mirror · string master · save ledger · dice & RNG streams ·
//   shell state machine · bitmap text wrapping · menu layout rects ·
//   the §5.5 Play/Continue pages · the §5.6 options rows and help line ·
//   brand geometry · boot timeline.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { SURFACE, BELOW, REMAP, Palette } from '../js/core/palette.js'
import { ShellData } from '../js/core/data.js'
import { setLoader } from '../js/core/data.js'
import { SaveStore, SAVE_KEY, SLOT_COUNT } from '../js/core/save.js'
import { Dice, RngStreams, Mode } from '../js/core/dice.js'
import { GameState, State, VERSION } from '../js/core/state.js'
import { InputActions } from '../js/core/input.js'
import { Brand } from '../js/core/brand.js'
import { parseBMFont, textWidth } from '../js/ui/bmfont.js'
import { PixelFont } from '../js/ui/font.js'
import { Face, Rect, Ui } from '../js/ui/kit.js'
import { PillGroup, Slider, pillGroupWidth } from '../js/ui/widgets.js'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')

const failures = []
let checks = 0
let current = ''

function run(label, test) {
  current = label
  const before = failures.length
  const result = test()
  if (result instanceof Promise) throw new Error(`${label}: tests must be synchronous`)
  console.log(`  ${failures.length === before ? 'ok  ' : 'FAIL'} ${label}`)
}

function check(condition, message) {
  checks += 1
  if (!condition) failures.push(`[${current}] ${message}`)
}

function eq(actual, expected, message) {
  check(actual === expected, `${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`)
}

// --- the file-system loader the browser gets from fetch() ---------------

const text = (path) => readFileSync(join(WEB, path), 'utf8')
setLoader(async (path) => text(path))

const readJSON = (path) => JSON.parse(text(path))

await ShellData.load()

const fonts = {}
for (const [role, name] of Object.entries(readJSON('data/fonts.json').faces)) {
  fonts[role] = new PixelFont(name, parseBMFont(text(`assets/fonts/${name}.fnt`)))
}
Ui.fonts = fonts // the kit measures with the real faces, as the page does

const timings = ShellData.timings
const screens = timings.screens

// --- tests --------------------------------------------------------------

run('palette', () => {
  eq(SURFACE.length, 32, 'surface ramp holds 32 colours')
  eq(BELOW.length, 8, 'below ramp holds 8 colours')
  eq(REMAP.length, 32, 'every surface colour has a below remap')
  eq(SURFACE[1], '#101418', 'ink-1 is #101418 (GDD-06 §5.3)')
  eq(Palette.bronze, '#B0793A', 'bronze-2 matches the wordmark colour')
  eq(Palette.blood_1, '#8E2F26', 'the blood face uses blood-1 (§5.5)')
  const lut = readJSON('assets/pixel/palette/palette_lut.json')
  eq(lut.remap.length, 32, 'palette_lut.json carries a 32-entry remap')
  for (let index = 0; index < 32; index += 1) {
    eq(Number(lut.remap[index]), REMAP[index], `LUT remap entry ${index} matches palette.js`)
  }
  eq(Palette.mix('#000000', '#FFFFFF', 0.5), '#808080', 'mix blends two ramp colours')
})

run('shell data', () => {
  eq(Object.keys(ShellData.strings.spec).length, 34, '34 strings in the §5.11 master')
  eq(ShellData.t('STR_MENU_PLAY'), 'PLAY', 'PLAY string')
  eq(ShellData.t('STR_BOOT_ANY'), 'Press any button to continue.', 'boot prompt string')
  eq(ShellData.t('STR_MENU_NOSAVE'), 'No contracts signed yet.', 'no-save tooltip')
  const formatted = ShellData.t('STR_LOAD_ERR', ['yard.json'])
  check(formatted.startsWith('The road is washed out.'), 'load error string formats {0}')
  check(formatted.includes('yard.json'), 'load error string carries its argument')
  check(ShellData.t('STR_NOT_A_REAL_ID') === 'STR_NOT_A_REAL_ID', 'unknown ids are returned verbatim, not silently blank')
  eq(ShellData.content.loading_tips.length, 16, '16 loading tips (§5.9)')
  eq(ShellData.menuLayout().item_pitch, 21, 'menu item pitch is 21 px (§5.4)')
  eq(ShellData.stingTiming().total_ms, 4000, 'sting is 4.0 s (§5.2)')
  eq(ShellData.schema.tabs.length, 5, '5 options tabs (§5.6)')
  eq(Object.keys(ShellData.optionRows()).length, 39, '39 schema rows across the five tabs')
  eq(ShellData.optionDefaults().difficulty, 'Balanced', 'difficulty defaults to Balanced (§5.5)')
})

run('string master', () => {
  for (const [id, value] of Object.entries({ ...ShellData.strings.spec, ...ShellData.strings.build })) {
    if (id.startsWith('_')) continue
    check(typeof value === 'string' && value.length > 0, `${id} has body text`)
    check(ShellData.t(id) === value, `${id} resolves through ShellData.t()`)
  }
})

run('save ledger', () => {
  // A clean in-memory store so the suite never touches a real player's ledger.
  const memory = (() => {
    const map = new Map()
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key),
    }
  })()
  SaveStore.storage = memory
  SaveStore.load()

  eq(SaveStore.slots.length, SLOT_COUNT, 'the ledger holds 8 slots (§5.5)')
  check(!SaveStore.hasAnyContract(), 'a fresh ledger has no contract')
  check(SaveStore.createContract(0, { name: 'Testwrit', class: 'Fighter' }), 'slot 0 accepts a contract')
  check(SaveStore.hasAnyContract(), 'CONTINUE lights up once a contract exists')
  eq(SaveStore.latestContract().name, 'Testwrit', 'latest contract is the one just signed')
  eq(SaveStore.firstEmptySlot(), 1, 'first empty slot moves to 1')
  check(!SaveStore.createContract(0, { name: 'Overwrite' }), 'a taken slot refuses a second contract')
  check(SaveStore.slot(0).signed_at !== undefined, 'the contract carries its signing date')

  SaveStore.setSetting('difficulty', 'Tactical')
  SaveStore.flush()
  check(memory.getItem(SAVE_KEY).includes('Tactical'), 'flush writes the document')
  SaveStore.load()
  eq(SaveStore.getSettings().difficulty, 'Tactical', 'settings survive a reload')

  check(SaveStore.deleteContract(0), 'a contract can be broken')
  check(!SaveStore.hasAnyContract(), 'the ledger is empty again')

  memory.setItem(SAVE_KEY, '{oops')
  SaveStore.load()
  check(SaveStore.corrupt, 'a save that will not parse is flagged corrupt (§5.5 scorched card)')
  memory.removeItem(SAVE_KEY)
  SaveStore.load()
  check(!SaveStore.corrupt, 'a missing save is a fresh player, not a corrupt one')
})

run('dice', () => {
  for (let index = 0; index < 200; index += 1) {
    const value = Dice.d20('combat')
    check(value >= 1 && value <= 20, 'every d20 lands inside 1..20')
  }
  const single = Dice.roll('1d8+3', 'combat')
  eq(single.rolls.length, 1, '1d8+3 rolls one die')
  eq(single.total, single.rolls[0] + 3, 'the modifier is added to the roll')
  const pair = Dice.roll('2d6', 'combat')
  eq(pair.rolls.length, 2, '2d6 rolls two dice')
  eq(pair.natural, 0, 'a non-d20 expression has no natural')
  check(Dice.history.length <= Dice.HISTORY_LIMIT, 'the roll history is bounded')
  Dice.roll('not dice', 'combat') // logs and returns a zeroed result

  const checkRoll = Dice.d20Check(5, 15, Mode.STRAIGHT, 'combat', 'Athletics')
  eq(checkRoll.maths, `${checkRoll.kept} + 5 = ${checkRoll.total} vs 15`, 'the maths line is verbatim (R14)')
  eq(checkRoll.dice.length, 1, 'a straight check rolls one die')
  check(checkRoll.success === (checkRoll.total >= 15), 'success follows the total')
  const advantage = Dice.d20Check(0, 10, Mode.ADVANTAGE, 'combat')
  eq(advantage.dice.length, 2, 'advantage rolls two dice')
  eq(advantage.kept, Math.max(...advantage.dice), 'advantage keeps the higher die')
  const disadvantage = Dice.d20Check(0, 10, Mode.DISADVANTAGE, 'combat')
  eq(disadvantage.kept, Math.min(...disadvantage.dice), 'disadvantage keeps the lower die')
  eq(Dice.abilityModifier(16), 3, 'ability modifier is floor((score - 10) / 2) (R4)')
  eq(Dice.passive(3), 13, 'passive score is 10 + modifiers (R4)')
})

run('rng streams', () => {
  RngStreams.reseedAll(7)
  const first = [Dice.d20('combat'), Dice.d20('combat'), Dice.d20('combat')]
  RngStreams.reseedAll(7)
  const second = [Dice.d20('combat'), Dice.d20('combat'), Dice.d20('combat')]
  eq(first.join(','), second.join(','), 'a reseeded stream replays its rolls')
  const world = [Dice.d20('world'), Dice.d20('world')]
  eq(world.length, 2, 'the world stream is independent of combat')
  RngStreams.reseedAll()
  const fx = Dice.d20('fx')
  check(fx >= 1 && fx <= 20, 'an invented stream still rolls in range')
})

run('shell state', () => {
  GameState.state = State.LEGAL
  GameState.transitionTo(State.STING)
  eq(GameState.previousState, State.LEGAL, 'the previous state is remembered')
  eq(GameState.state, State.STING, 'transitionTo moves the shell')
  check(GameState.isBootState(), 'the sting is a boot state')
  GameState.transitionTo(State.MENU, { resume_slot: 2 })
  eq(GameState.payload.resume_slot, 2, 'the payload travels with the transition')
  check(!GameState.isBootState(), 'the menu is not a boot state')
  GameState.applySavedSettings({ difficulty: 'Story' })
  eq(GameState.settings.difficulty, 'Story', 'a saved choice overrides the default')
  eq(GameState.settings.reduced_motion, 'Off', 'unsaved rows keep their schema default')
  check(VERSION.includes('web'), 'the version stamp names this build')
})

run('input actions', () => {
  const bindings = InputActions.applyOverrides({})
  eq(bindings.game_move[0], 'KeyW', 'move defaults to WASD (§5.6)')
  InputActions.applyOverrides({ game_interact_keycode: 'KeyE' })
  eq(InputActions.bindings.game_interact[0], 'KeyE', 'a saved rebind replaces the default')
  InputActions.applyOverrides({})
  const action = InputActions.handleKey({ code: 'KeyF', key: 'f' }, true)
  eq(action, 'game_interact', 'the input map resolves a key to its action')
  check(InputActions.consume('game_interact'), 'the edge is consumed once')
  check(!InputActions.consume('game_interact'), 'and not twice')
})

run('bitmap text', () => {
  const ui = fonts.ui
  const body = fonts.body
  eq(ui.name, 'pixel_ui_5', 'the chrome face is the 5 px face')
  eq(body.lineHeight, 11, 'the 8 px body face sits on an 11 px line (§5.5 note)')
  check(textWidth(ui, 'PLAY') > 0, 'a run has a width')
  eq(textWidth(ui, 'PLAY'), ui.measure('PLAY'), 'the font and the parser agree on width')
  const wrapped = body.wrap(ShellData.schema.tabs.find((tab) => tab.id === 'gameplay').rows.at(-1).help, 384)
  check(wrapped.length >= 2, 'a long help string wraps onto several lines')
  check(wrapped.every((line) => body.measure(line) <= 384), 'no wrapped line exceeds its width')
  eq(ui.wrap('', 100).length, 1, 'an empty string is one empty line')
})

run('menu layout', () => {
  const menu = ShellData.menuLayout()
  const origin = Rect.from(menu.item_rect)
  eq(origin.x, 29, 'menu items start at x 29 (§5.4)')
  eq(origin.y, 92, 'the first menu item sits at y 92')
  eq(menu.item_count, 5, 'five menu items')
  const last = origin.y + menu.item_pitch * (menu.item_count - 1) + origin.h
  check(last <= 270, `the fifth item ends at y ${last}, inside the canvas`)
  const lockup = Rect.from(menu.lockup_rect)
  check(lockup.bottom <= origin.y, 'the lockup clears the first item')
  const disclaimer = Rect.from(menu.disclaimer_rect)
  const stamp = Rect.from(menu.version_stamp_rect)
  check(disclaimer.bottom <= 270 && stamp.bottom <= 270, 'both footer lines are inside the canvas (§5.4 note)')
  check(disclaimer.y >= last, 'the footer sits below the item block')
  const stampText = ShellData.t('STR_VERSION_STAMP', [VERSION, '2026-09-23'])
  check(fonts.ui.measure(stampText) <= stamp.w, 'the version stamp fits its 330 px field')
})

run('first run page', () => {
  const page = screens.first_run
  const panel = Rect.from(page.panel)
  eq(panel.x, 40, 'the contract panel starts at x 40 (§5.5)')
  eq(panel.w, 400, 'the contract panel is 400 px wide')
  const groups = page.group_ys
  eq(groups.join(','), '56,104,152', 'the three groups sit at y 56 / 104 / 152')
  eq(groups[1] - groups[0], 48, 'the group pitch is 48 px')
  const contentX = page.content_x
  const contentW = page.content_w
  eq(contentX + contentW, 432, 'content runs to the panel inner edge')
  const helpOffset = page.help_offset_y
  const lineSpacing = page.help_line_spacing
  const bodyLine = fonts.body.lineHeight + lineSpacing
  const rows = ShellData.optionRows()
  for (const rowId of ['difficulty', 'combat_pacing']) {
    const lines = fonts.body.wrap(rows[rowId].help, contentW)
    const helpTop = groups[rowId === 'difficulty' ? 0 : 1] + helpOffset
    check(helpTop + lines.length * bodyLine <= 224, `${rowId} help clears the footer buttons`)
    check(lines.length <= 3, `${rowId} help stays inside the 48 px group pitch`)
  }
  const subs = fonts.body.wrap(rows.subtitles.help, Rect.from(page.comfort_help_rect).w)
  const comfort = fonts.body.wrap(rows.reduced_motion.help, Rect.from(page.comfort_right_help_rect).w)
  check(Rect.from(page.comfort_help_rect).y + subs.length * bodyLine <= 224, 'the subtitles note clears the footer')
  check(Rect.from(page.comfort_right_help_rect).y + comfort.length * bodyLine <= 224, 'the comfort note clears the footer')
  eq(Rect.from(page.back_rect).eq([56, 224, 148, 18]), true, 'BACK keeps its §5.5 rect')
  eq(Rect.from(page.go_rect).eq([276, 224, 148, 18]), true, 'SIGN & DESCEND keeps its §5.5 rect')

  // The pill rows are laid out from the real face, so a long label still fits.
  const values = rows.combat_pacing.values
  const width = pillGroupWidth(values, Face.UI)
  eq(width, values.reduce((sum, value) => sum + fonts.ui.measure(value) + 6 + 4, 0) - 4, 'pill widths are label + 6 px, 4 px apart')
  check(contentX + width <= 432, 'the widest pill row fits the panel content width')
  eq(Rect.from(screens.new_contract_card.rect).w, 320, 'the overlay card keeps its rect')
})

run('ledger screen', () => {
  const ledger = screens.ledger
  eq(Rect.from(ledger.panel).eq([60, 24, 360, 222]), true, 'the ledger panel is (60,24,360,222) (§5.5)')
  const row = Rect.from(ledger.row_rect)
  const count = ledger.row_count
  eq(count, 8, 'the ledger shows eight rows')
  const lastBottom = row.y + ledger.row_pitch * (count - 1) + row.h
  check(lastBottom <= Rect.from(ledger.panel).bottom, 'the eighth row ends inside the panel')
  const hint = Rect.from(ledger.hint_rect)
  check(hint.y >= lastBottom, 'the hint sits below the rows')
  check(hint.bottom <= 270, 'the hint is inside the canvas')
  check(Rect.from(ledger.back_rect).x + Rect.from(ledger.back_rect).w <= hint.x, 'BACK clears the hint')
  for (const key of ['card_rect', 'scorched_card_rect']) {
    check(Rect.from(ledger[key]).inside(Rect.from(ledger.panel)), `${key} sits inside the ledger panel`)
  }
  for (const key of ['break_rect', 'keep_rect', 'retry_rect', 'skip_rect']) {
    check(Rect.from(ledger[key]).inside(Rect.from(ledger[key === 'break_rect' || key === 'keep_rect' ? 'card_rect' : 'scorched_card_rect'])), `${key} sits inside its card`)
  }
})

run('options screen', () => {
  const options = screens.options
  eq(Rect.from(options.tab_rail).eq([8, 16, 72, 238]), true, 'the tab rail is (8,16,72,238) (§5.6)')
  eq(Rect.from(options.rows_panel).eq([88, 16, 384, 238]), true, 'the rows panel is (88,16,384,238)')
  const tab = Rect.from(options.tab_rect)
  const tabs = ShellData.schema.tabs.length
  check(tab.y + options.tab_pitch * (tabs - 1) + tab.h <= Rect.from(options.tab_rail).bottom, 'all five tabs fit the rail')
  const row = Rect.from(options.row_rect)
  check(row.x + row.w <= Rect.from(options.rows_panel).right, 'rows run inside the panel')
  check(row.y + options.row_pitch * options.visible_rows <= Rect.from(options.help_rect).y, 'ten rows clear the help line')
  const help = Rect.from(options.help_rect)
  const back = Rect.from(options.back_rect)
  check(help.x >= back.x + back.w, 'the help line starts clear of BACK')
  const rows = ShellData.optionRows()
  let longest = []
  for (const definition of Object.values(rows)) {
    const lines = fonts.ui.wrap(definition.help ?? '', help.w)
    if (lines.length > longest.length) longest = lines
  }
  eq(longest.length, 3, 'the longest options help takes three chrome lines (§5.6 note)')
  check(help.y + longest.length * options.help_line_height <= 270, 'the help line stays inside the canvas')
  const scroller = Rect.from(options.scrollbar_rect)
  check(scroller.right <= 480 && scroller.bottom <= 270, 'the scrollbar is inside the canvas')
  const controls = ShellData.schema.tabs.find((entry) => entry.id === 'controls')
  check(controls.rows.length > options.visible_rows, 'the Controls tab overflows, so the page scrolls')
})

run('widgets', () => {
  const group = new PillGroup(Rect.of(0, 0, 100, 16), ['Story', 'Balanced', 'Tactical'], 1)
  eq(group.value, 'Balanced', 'the pill group opens on the given value')
  group.step(1)
  eq(group.value, 'Tactical', 'stepping right selects the next pill')
  group.step(1)
  eq(group.value, 'Story', 'stepping past the end wraps to the first pill')
  group.setValue('Balanced', false)
  eq(group.index, 1, 'setValue selects without notifying')

  const slider = new Slider(Rect.of(0, 0, 95, 20), { min: 0, max: 100, value: 50 })
  eq(slider.litPips(), 5, 'half of ten pips are lit at 50 %')
  slider.setValue(120)
  eq(slider.value, 100, 'the slider clamps to its maximum')
  slider.setValue(-5)
  eq(slider.value, 0, 'the slider clamps to its minimum')
  slider.setValue(50, false)
  eq(slider.litPips(), 5, 'pips follow the value')
})

run('brand geometry', () => {
  eq(Brand.emblemSize().width, 24, 'the emblem is 24 px (§5.1)')
  eq(Brand.wordmarkLetters().join(''), 'DELVE', 'the wordmark spells DELVE')
  eq(Brand.emblemStepRects().length, 3, 'the emblem has three steps')
  eq(Brand.litStepCount(0.2), 1, 'a fifth of the way in lights one step')
  eq(Brand.litStepCount(1), 3, 'a finished load lights all three')
  eq(Brand.stepsLitFor(0, 5), 0, 'a fresh contract shows the plain emblem')
  eq(Brand.stepsLitFor(2, 5), 2, 'two of five beats light two steps')
  eq(Brand.stepsLitFor(5, 5), 3, 'a finished contract lights all three')
  eq(Brand.stampFile(0), 'logo_emblem.png', 'stamp art resolves from brand.json')
  eq(Brand.stampFile(3), 'logo_emblem_steps.png', 'the third stamp is the lit emblem')
})

run('boot timeline', () => {
  const sting = ShellData.stingTiming()
  eq(sting.skippable_after_ms, 1500, 'the sting is skippable after 1.5 s (§5.2)')
  eq(sting.steps_light_ms.length, 3, 'three steps light')
  eq(sting.wordmark_chisel_ms.length, 5, 'five letters chisel in')
  check(sting.bronze_sweep_ms[1] <= sting.total_ms, 'the sweep finishes inside the timeline')
  check(sting.reduced_motion_hold_ms >= sting.reduced_motion_min_ms, 'reduced motion holds for at least its minimum')
  eq(ShellData.bootTiming().legal_blink_ms, 800, 'the legal prompt blinks every 0.8 s')
  eq(timings.screens.fade_ms, 600, 'pages cross-fade in 0.6 s')
})

// --- report -------------------------------------------------------------

console.log('')
if (failures.length === 0) {
  console.log(`${checks} checks passed`)
  process.exit(0)
}
console.log(`${failures.length} of ${checks} checks FAILED:`)
for (const failure of failures) console.log(`  - ${failure}`)
process.exit(1)
