import type { ResolvedStacking } from '@tms/sheet-core'
import type { Box } from '@tms/ui'

/**
 * As caixas da trilha `wod-stacking`, do dano mais grave para o menos grave
 * (o app guarda contagens por tipo e desenha em ordem). O tipo mais grave
 * fica cheio; os outros, só com o glifo.
 */
export function stackingBoxes(r: ResolvedStacking): Box[] {
  const types = r.field.def.types ?? []
  const boxes: Box[] = []
  types.forEach((t, i) => {
    for (let n = 0; n < (r.counts[t.id] ?? 0); n++)
      boxes.push({ glyph: t.glyph, tone: i === 0 ? 'severe' : 'filled' })
  })
  while (boxes.length < r.levels) boxes.push({ tone: 'empty' })
  return boxes.slice(0, r.levels)
}
