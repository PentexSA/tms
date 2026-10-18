import {
  type ActionPlan,
  canWrite,
  type FieldId,
  isEditableIn,
  type SheetData,
  type SheetEvent,
} from '@tms/sheet-core'
import { useSheet } from '../context'

// O que a tela de Jogo pode mexer num campo. O modo é UX (doc/arquitetura
// §6.5): a permissão vem do canWrite e o servidor confere de novo.

export interface Editability {
  readonly editable: boolean
  // Por que não dá para mexer (a nota do detalhe).
  readonly reason: string | null
}

export const PERMANENT_NOTE = 'Traço permanente: muda só em Evoluir.'

export function useEditable(id: FieldId): Editability {
  const { model, roles, mode } = useSheet()
  const field = model.fields.get(id)
  if (!field) return { editable: false, reason: null }
  if (field.readOnly)
    return { editable: false, reason: 'Calculado pela ficha.' }
  if (!canWrite(model, id, roles))
    return { editable: false, reason: 'Você não pode alterar este campo.' }
  if (mode === 'read')
    return { editable: false, reason: 'Somente leitura neste modo.' }
  if (!isEditableIn(field, mode))
    return { editable: false, reason: PERMANENT_NOTE }
  return { editable: true, reason: null }
}

/** O evento que leva o campo ao valor `to`, com o `from` guardado de agora. */
export function eventTo(
  values: SheetData,
  id: FieldId,
  to: unknown
): SheetEvent {
  return {
    path: `values.${id}`,
    from: Object.hasOwn(values.values, id) ? values.values[id] : null,
    to,
  }
}

/**
 * O texto do aviso: com um evento só, o "de → para" ("Sangue 10 → 9"); com
 * vários (Curar mexe na Vitalidade e no Sangue) ou num tipo sem "de → para"
 * (espaços de magia), o rótulo da ação ("Usou 1 espaço de 1º nível").
 */
export function planLabel(plan: Extract<ActionPlan, { ok: true }>): string {
  // A prévia do core já tem o "de" efetivo (Sangue cheio no padrão: 10 → 9)
  const [only] = plan.preview
  if (plan.events.length !== 1 || !only) return plan.label
  return only.change === 'alterado'
    ? plan.label
    : `${only.label} ${only.change}`
}
