// bmfont — parse the AngelCode `.fnt` files `tools/build_fonts.py` writes.
//
// The build bakes each face into a PNG atlas plus a `.fnt` descriptor; the
// descriptor is the authority on glyph rects and advances, and
// `tools/check_project.py` measures the page layouts with the same numbers. This
// parser is deliberately the same shape as the Python one (`parse_fnt`), so a
// width the checker computes and a width the game draws are the same integer.

const ATTRIBUTE = /(\w+)=("[^"]*"|\S+)/g

/** Parse the text of a `.fnt`. Returns `{ page, lineHeight, size, scaleW, scaleH, chars }`. */
export function parseBMFont(text) {
  const out = {
    page: '',
    lineHeight: 0,
    size: 0,
    scaleW: 0,
    scaleH: 0,
    chars: new Map(),
  }
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue
    const [tag, ...rest] = line.trim().split(/\s+/)
    const body = rest.join(' ')
    const fields = {}
    for (const match of body.matchAll(ATTRIBUTE)) fields[match[1]] = match[2].replace(/"/g, '')
    if (tag === 'char') {
      out.chars.set(Number(fields.id), {
        x: Number(fields.x),
        y: Number(fields.y),
        w: Number(fields.width),
        h: Number(fields.height),
        advance: Number(fields.xadvance),
        offsetX: Number(fields.xoffset ?? 0),
        offsetY: Number(fields.yoffset ?? 0),
      })
    } else if (tag === 'common') {
      out.lineHeight = Number(fields.lineHeight)
    } else if (tag === 'page') {
      out.page = fields.file
    } else if (tag === 'info') {
      out.size = Number(fields.size)
    }
    if (fields.scaleW) out.scaleW = Number(fields.scaleW)
    if (fields.scaleH) out.scaleH = Number(fields.scaleH)
  }
  return out
}

/** Character -> advance map, exactly as `tools/check_project.py:_font_advances`. */
export function advanceMap(font) {
  const map = {}
  for (const [code, glyph] of font.chars) map[code] = glyph.advance
  return map
}

/** The width of a run, in pixels: the sum of the glyph advances. */
export function textWidth(font, text) {
  let width = 0
  for (const character of String(text)) {
    const glyph = font.chars.get(character.charCodeAt(0))
    width += glyph ? glyph.advance : 0
  }
  return width
}
