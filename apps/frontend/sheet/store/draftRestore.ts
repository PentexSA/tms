import {
  applyBatch,
  canWrite,
  jsonEqual,
  parsePath,
  type RoleName,
  type SheetData,
  type SheetEvent,
  type SheetModel,
  xpLedgerFields,
} from '@tms/sheet-core'
import type { DraftRecord } from '../sync/draftStore'
import { valueAt } from './sheetStore'

// A recuperação do rascunho guardado no aparelho (T-03). O registro veio do
// disco: cada alteração é revalidada com os papéis e a ficha de agora antes de
// voltar ao rascunho. O servidor confere tudo de novo no "Salvar".

export interface RestorePlan {
  // O que volta ao rascunho. Nos conflitos, o `from` é o antigo: o "Salvar"
  // fica recusado até a pessoa escolher
  readonly events: readonly SheetEvent[]
  // Caminhos que mudaram desde o rascunho (valor atual ≠ de e ≠ para)
  readonly conflicts: readonly string[]
  // Já salvos (em outro aparelho, ou antes da queda): saem em silêncio
  readonly applied: number
  // Campo que não existe, que o papel não escreve, derivado, do extrato de XP
  // ou que não passa na validação: sai, e a tela diz quantos
  readonly dropped: number
}

export function planDraftRestore(
  model: SheetModel,
  values: SheetData,
  roles: readonly RoleName[],
  record: DraftRecord
): RestorePlan {
  const ledger = new Set<string>(xpLedgerFields(model))
  let applied = 0
  let dropped = 0
  const candidates: {
    readonly path: string
    readonly from: unknown
    readonly to: unknown
    readonly current: unknown
  }[] = []
  for (const edit of record.edits) {
    const p = parsePath(edit.path)
    const field = p ? model.fields.get(p.fieldId) : undefined
    if (
      !p ||
      !field ||
      field.readOnly ||
      ledger.has(p.fieldId) ||
      !canWrite(model, p.fieldId, roles)
    ) {
      dropped++
      continue
    }
    const current = valueAt(values, edit.path)
    if (jsonEqual(current, edit.to)) {
      applied++
      continue
    }
    candidates.push({ path: edit.path, from: edit.from, to: edit.to, current })
  }
  // Forma, permissão e validação da ficha, como um lote sobre o valor de
  // agora. Juntas primeiro (há regras entre campos); se não passarem, uma a
  // uma, e o que sobrar junto de novo
  const passes = (list: typeof candidates) =>
    applyBatch(
      model,
      values,
      {
        events: list.map(c => ({ path: c.path, from: c.current, to: c.to })),
      },
      roles
    ).ok
  let kept = candidates
  if (kept.length && !passes(kept)) {
    kept = kept.filter(c => passes([c]))
    if (kept.length && !passes(kept)) kept = []
  }
  dropped += candidates.length - kept.length
  return {
    events: kept.map(c => ({ path: c.path, from: c.from, to: c.to })),
    conflicts: kept.filter(c => !jsonEqual(c.current, c.from)).map(c => c.path),
    applied,
    dropped,
  }
}
