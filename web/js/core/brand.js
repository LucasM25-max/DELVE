// Brand — the DELVE lockup geometry (GDD-07 §5.1).
//
// `data/brand.json` is written by `tools/build_brand.py` alongside the brand
// PNGs, so the sting, the menu, the ledger stamps and the loading seal all read
// one set of numbers instead of four copies of the same constant.

import { ShellData } from './data.js'

export const Brand = {
  /** The 24×24 emblem, in canvas pixels. */
  emblemSize() {
    const size = ShellData.brand.emblem?.size ?? [24, 24]
    return { width: size[0], height: size[1] }
  },

  wordmarkSize() {
    const size = ShellData.brand.wordmark?.size ?? [72, 22]
    return { width: size[0], height: size[1] }
  },

  lockupSize() {
    const size = ShellData.brand.lockup?.size ?? [96, 24]
    return { width: size[0], height: size[1] }
  },

  wordmarkCellWidth() {
    return ShellData.brand.wordmark?.cell_width ?? 14
  },

  wordmarkLetters() {
    return ShellData.brand.wordmark?.letters ?? ['D', 'E', 'L', 'V', 'E']
  },

  /** The emblem's three descending step rects, in emblem-local pixels. */
  emblemStepRects() {
    return (ShellData.brand.emblem?.steps ?? []).map((step) => ({ ...step }))
  },

  /** How many steps are lit for a 0-1 load progress (§5.2/§5.9). */
  litStepCount(progress) {
    if (progress <= 0) return 0
    return Math.max(1, Math.min(3, Math.ceil(progress * 3)))
  },

  /** Save-stamp art for a contract: `stepsLit` of the three steps lit (§5.5). */
  stampFile(stepsLit) {
    const variants = ShellData.brand.emblem?.variants ?? {}
    const key = `stamp_${Math.max(0, Math.min(3, stepsLit))}`
    return variants[key] ?? variants.stamp_0 ?? 'logo_emblem.png'
  },

  /**
   * How many steps a contract has earned: one per third of the P1 beat list
   * completed, rounded up, so the first finished beat already shows a light.
   */
  stepsLitFor(completed, total) {
    if (completed <= 0 || total <= 0) return 0
    return Math.max(1, Math.min(3, Math.ceil((completed / total) * 3)))
  },
}
