import {
  describeBatch,
  type SheetModel,
  withEffectiveFrom,
} from '@tms/sheet-core'
import { REFUSAL_TEXT } from '../creation/creation'
import type { SheetStore } from '../store/sheetStore'

// Salvar o rascunho de Criação/Editar num lote só, com o rótulo do resumo.
// Um caminho para o "Salvar" do resumo da barra e para o "Salvar e sair" da
// guarda de saída (D-01): o mesmo lote, a mesma conta no aparelho e no
// servidor, as mesmas frases de recusa.

export type SaveOutcome =
  | {
      readonly ok: true
      // "Aparência 1 → 3", o rótulo do lote (e do toast)
      readonly label: string
      // O lote enfileirado; null sem nada a salvar (rascunho vazio)
      readonly batchId: string | null
    }
  | { readonly ok: false; readonly message: string }

export const CONFLICT_TEXT =
  'Alguém mudou um destes campos enquanto você editava. Confira os valores e salve de novo.'

/** Salva o rascunho agora. Recusado, o rascunho fica e a frase diz por quê. */
export function saveDraftNow(
  model: SheetModel,
  store: SheetStore
): SaveOutcome {
  const s = store.getState()
  // O "de" efetivo da ficha salva ("Aparência 1 → 3", T-54), como o resumo
  const label = describeBatch(
    model,
    withEffectiveFrom(model, s.values, s.draftEvents())
  )
  const result = s.saveDraft(label)
  if (!result) return { ok: true, label, batchId: null }
  if (result.ok) return { ok: true, label, batchId: result.batch.clientBatchId }
  const refused = store.getState().creationRefusal
  return {
    ok: false,
    message:
      result.kind === 'conflict'
        ? CONFLICT_TEXT
        : result.kind === 'creation' && refused
          ? REFUSAL_TEXT[refused.code]
          : (result.issues[0]?.message ?? 'Não foi possível salvar.'),
  }
}
