import type { SheetModel } from './compile'
import type { FieldId, SheetData, TemplateAlert } from './contract'
import { canRead, type Roles } from './permissions'
import type { AlertRule } from './registry'
import { type ResolvedField, type ResolvedSheet, resolve } from './resolve'

// Alertas da Mesa (doc/painel-narrador.md §5.3; doc/plano-v3.md, Etapa 8): o
// template diz quando uma linha merece atenção, com uma regra da lista
// fechada; o core calcula a partir da ficha resolvida e o painel só pinta.

export interface ActiveAlert {
  readonly id: string
  // O rótulo do template: o selo e o nome acessível ("Incapacitado")
  readonly label: string
  readonly field: FieldId
}

type Rule = (r: ResolvedField, alert: TemplateAlert) => boolean

// Uma regra por entrada de REGISTRY.alertRules: o build quebra se faltar uma.
// O tipo do campo já foi conferido pelo validateTemplate; aqui só se lê.
const RULES: { readonly [R in AlertRule]: Rule } = {
  'track-at-level': (r, a) => {
    if (r.type !== 'track') return false
    const marked = r.rule === 'boxes' ? r.marked : r.filled
    return marked >= (a.level ?? Number.POSITIVE_INFINITY)
  },
  'resource-at-most': (r, a) =>
    r.type === 'resource' && r.current <= (a.value ?? -1),
  'resource-below-share': (r, a) => {
    if (r.type !== 'resource') return false
    const max = r.max ?? r.shownMax
    return max !== null && max > 0 && r.current < (a.share ?? 0) * max
  },
}

/**
 * Os alertas ativos da ficha, na ordem do template. Um alerta sobre campo que
 * os papéis não leem não existe para eles.
 */
export function alertsOf(
  model: SheetModel,
  sheet: SheetData | ResolvedSheet,
  roles: Roles
): ActiveAlert[] {
  const alerts = model.template.alerts ?? []
  if (!alerts.length) return []
  const resolved = 'get' in sheet ? sheet : resolve(model, sheet)
  const mine = [...roles]
  return alerts.flatMap(a => {
    if (!canRead(model, a.field, mine)) return []
    const r = resolved.get(a.field)
    const rule = RULES[a.rule]
    return r && rule?.(r, a)
      ? [{ id: a.id, label: a.label, field: a.field }]
      : []
  })
}
