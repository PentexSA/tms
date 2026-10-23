import {
  type ChangeClass,
  canWrite,
  editClass,
  type FieldId,
  isEditableIn,
  type SheetMode,
  type SheetModel,
} from '@tms/sheet-core'
import { useCallback } from 'react'
import { useSheet, useSheetSelector, useSheetStore } from '../context'
import { blockedBy, blockedNote, useLifecycle } from '../policy'
import type { CommitResult } from '../store/sheetStore'

// O que os editores de Evoluir leem e escrevem. O modo é UX: quem decide se
// a escrita vale é o applyBatch (aqui, no rascunho) e o servidor.

/** O campo vira editor agora? (Evoluir, não derivado e o papel escreve) */
export function canEditIn(
  model: SheetModel,
  roles: ReadonlySet<string>,
  id: FieldId,
  mode: SheetMode
): boolean {
  const field = model.fields.get(id)
  return Boolean(
    field && isEditableIn(field, mode) && canWrite(model, id, roles)
  )
}

/** Algum campo que estes papéis escrevem: oferece o seletor de modo. */
export function canEditSomething(
  model: SheetModel,
  roles: ReadonlySet<string>
): boolean {
  return [...model.fields.keys()].some(
    id => !model.fields.get(id)?.readOnly && canWrite(model, id, roles)
  )
}

/**
 * Por que o editor do campo está desabilitado pela política, ou null: em
 * `active`, subir um traço pede o narrador ("Peça ao narrador"), e o texto e
 * a especialização continuam editáveis. O servidor confere de novo.
 */
export function useBlockedNote(id: FieldId): string | null {
  const { model } = useSheet()
  const field = model.fields.get(id)
  return useClassNote(field ? editClass(field) : 'advance')
}

/** O mesmo, por classe: o editor de recurso mexe no permanente e no atual. */
export function useClassNote(cls: ChangeClass): string | null {
  const { roles } = useSheet()
  const code = blockedBy(roles, useLifecycle(), cls)
  return code ? blockedNote(code) : null
}

/** A mensagem do servidor (422) para o campo, se houver. */
export const useFieldIssue = (id: FieldId): string | undefined =>
  useSheetSelector(s => s.fieldIssues.get(id))

/** "N alterações" do rascunho. */
export const useDraftCount = (): number =>
  useSheetSelector(s => s.draft?.size ?? 0)

/** Escreve um caminho no rascunho; devolve a mensagem se o core recusar. */
export function useSetDraft() {
  const store = useSheetStore()
  return useCallback(
    (path: string, to: unknown): string | null => {
      const result: CommitResult | null = store
        .getState()
        .setDraftValue(path, to)
      if (!result || result.ok) return null
      return result.issues[0]?.message ?? 'valor inválido'
    },
    [store]
  )
}

/** O modo atual e se este campo está editável nele. */
export function useEditable(id: FieldId): boolean {
  const { model, roles, mode } = useSheet()
  return canEditIn(model, roles, id, mode)
}
