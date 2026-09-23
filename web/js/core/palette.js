// DELVE pixel palette — the locked 32 + 8 ramp and the "below" LUT (GDD-06 §5.3).
//
// Generated from tools/build_palette.py; tools/check_project.py asserts the two
// agree, so edit the builder and re-run it rather than hand-editing this file.
//
// The ramps are the only place a hex literal lives: everything else in the game
// names a colour through `Palette`, which is what keeps the art locked.

export const SURFACE = [
  "#0A0C10", // ink_0
  "#101418", // ink_1
  "#1A2126", // ink_2
  "#263038", // ink_3
  "#2C3238", // stone_0
  "#474F55", // stone_1
  "#6C757B", // stone_2
  "#9AA3A8", // stone_3
  "#B9A67F", // parchment_0
  "#D6C6A3", // parchment_1
  "#E9DFC8", // parchment_2
  "#F6EFDD", // parchment_3
  "#5E3D19", // bronze_0
  "#8A5A26", // bronze_1
  "#B0793A", // bronze_2
  "#D9A463", // bronze_3
  "#F0CD8E", // bronze_4
  "#3F2410", // oak_0
  "#5A3418", // oak_1
  "#7A4B2A", // oak_2
  "#A06A3C", // oak_3
  "#5C1C17", // blood_0
  "#8E2F26", // blood_1
  "#B4553F", // blood_2
  "#3C4823", // moss_0
  "#5B6B34", // moss_1
  "#7F8F4A", // moss_2
  "#8A5636", // skin_0
  "#C08356", // skin_1
  "#E8B58C", // skin_2
  "#E0A06A", // dawn_sky_0
  "#F2C98A", // dawn_sky_1
]

export const BELOW = [
  "#16343A", // teal_0
  "#1C4F52", // teal_1
  "#2F8F7A", // teal_2
  "#74E0B4", // mint
  "#2E2140", // violet_0
  "#4B2E6B", // violet_1
  "#8A4FD0", // violet_2
  "#C9C2A8", // bone
]

// Surface index -> below index (palette_lut.json): stone <-> teal, ink <-> violet,
// parchment <-> bone, bronze <-> mint; the remaining families key by luminance.
export const REMAP = [4, 5, 5, 6, 0, 1, 2, 2, 7, 7, 7, 7, 3, 3, 3, 3, 3, 0, 1, 1, 2, 4, 5, 6, 0, 1, 2, 7, 7, 7, 1, 2]

const S = (index) => SURFACE[index]
const B = (index) => BELOW[index]

/** The ramp by entry name: `Palette.parchment_2`, `Palette.bronze_3`, … */
export const Palette = {
  ink_0: S(0),
  ink_1: S(1),
  ink_2: S(2),
  ink_3: S(3),
  stone_0: S(4),
  stone_1: S(5),
  stone_2: S(6),
  stone_3: S(7),
  parchment_0: S(8),
  parchment_1: S(9),
  parchment_2: S(10),
  parchment_3: S(11),
  bronze_0: S(12),
  bronze_1: S(13),
  bronze_2: S(14),
  bronze_3: S(15),
  bronze_4: S(16),
  oak_0: S(17),
  oak_1: S(18),
  oak_2: S(19),
  oak_3: S(20),
  blood_0: S(21),
  blood_1: S(22),
  blood_2: S(23),
  moss_0: S(24),
  moss_1: S(25),
  moss_2: S(26),
  skin_0: S(27),
  skin_1: S(28),
  skin_2: S(29),
  dawn_sky_0: S(30),
  dawn_sky_1: S(31),
  below_teal_0: B(0),
  below_teal_1: B(1),
  below_teal_2: B(2),
  below_mint: B(3),
  below_violet_0: B(4),
  below_violet_1: B(5),
  below_violet_2: B(6),
  below_bone: B(7),
}

/**
 * The semantic names the kit and the screens use, with the ramp entry each one
 * means (`ink` is ink-1, `bronze` is bronze-2, and so on). Keeping the mapping
 * here rather than in the screens is what makes a ramp change a one-line edit.
 */
export const Alias = {
  ink: 'ink_1',
  ink_0: 'ink_0',
  ink_2: 'ink_2',
  ink_3: 'ink_3',
  stone_0: 'stone_0',
  stone_1: 'stone_1',
  stone_2: 'stone_2',
  stone_3: 'stone_3',
  parchment: 'parchment_2',
  parchment_0: 'parchment_0',
  parchment_1: 'parchment_1',
  parchment_3: 'parchment_3',
  bronze: 'bronze_2',
  bronze_0: 'bronze_0',
  bronze_1: 'bronze_1',
  bronze_2: 'bronze_2',
  bronze_3: 'bronze_3',
  bronze_4: 'bronze_4',
  oak_0: 'oak_0',
  oak_1: 'oak_1',
  oak_2: 'oak_2',
  oak_3: 'oak_3',
  blood: 'blood_1',
  blood_0: 'blood_0',
  blood_1: 'blood_1',
  blood_2: 'blood_2',
  moss_0: 'moss_0',
  moss_1: 'moss_1',
  moss_2: 'moss_2',
  skin_0: 'skin_0',
  skin_1: 'skin_1',
  skin_2: 'skin_2',
  dawn_sky_0: 'dawn_sky_0',
  dawn_sky_1: 'dawn_sky_1',
  mint: "below_mint",
}

for (const [alias, entry] of Object.entries(Alias)) {
  if (entry.startsWith("below_")) Palette[alias] = Palette[`below_${entry.slice(6)}`]
  else Palette[alias] = Palette[entry]
}

/** The "below" ramp, for the obelisk-teal effects in later chapters. */
Palette.below = BELOW

/** Hex string -> `rgba()` string, for canvas compositing. */
Palette.rgba = function rgba(hex, alpha = 1) {
  const value = hex.replace("#", "")
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Blend two ramp colours (`t` is the weight of `a`), in whole channels. */
Palette.mix = function mix(a, b, t) {
  const parse = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16))
  const channel = (x, y) => Math.round(x * t + y * (1 - t))
  const hex = (v) => v.toString(16).padStart(2, "0")
  const [r1, g1, b1] = parse(a)
  const [r2, g2, b2] = parse(b)
  return `#${hex(channel(r1, r2))}${hex(channel(g1, g2))}${hex(channel(b1, b2))}`
}

export default Palette
