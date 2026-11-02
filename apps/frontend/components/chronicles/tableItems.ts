import {
  type ActiveAlert,
  alertsOf,
  parseSheet,
  type SheetModel,
} from '@tms/sheet-core'

import { deadLabel } from '../../sheet/policy'
import { createSheetStore, type SheetStore } from '../../sheet/store/sheetStore'
import {
  type CharacterState,
  characterState,
  npcVisibilityText,
} from './characterState'

// O que cada linha da Mesa mostra, calculado uma vez por ficha (doc/plano-v3.md,
// Etapa 9). Puro: o mesmo item enquanto a linha e o modelo não mudam, para
// que filtrar e ordenar não redesenhem as linhas que continuam na tela.

export interface TableRowData {
  readonly id: string
  readonly name: string
  readonly owner: { readonly id: string; readonly username: string }
  readonly systemCode: string
  readonly templateVersion: string
  readonly sheetVersion: number
  readonly kind?: 'pc' | 'npc'
  readonly status?: string
  // O estado da criação (P04-D): o modo e os marcadores, sem o motivo
  readonly creationMode?: 'free' | 'points' | null
  readonly returned?: boolean
  readonly adjust?: boolean
  readonly ready?: boolean
  readonly activatedAt?: string | Date | null
  readonly lockedAt?: string | Date | null
  readonly updatedAt: string | Date
  readonly sheet: unknown
  // A visibilidade do NPC (T-52): a Mesa separa os NPCs (pelo `kind`) e
  // mostra o selo dela. A API já manda os dois
  readonly visibility?: string
}

export interface TableItem {
  readonly row: TableRowData
  // undefined: o template ainda carrega; null: esta versão do app não o entende
  readonly model: SheetModel | null | undefined
  // Store só de leitura (sem fila) para desenhar o dock com o registry
  readonly store: SheetStore | null
  readonly alerts: readonly ActiveAlert[]
  // O estado da ficha (D-02): "Em criação · livre", "Aguardando aprovação",
  // "Avisou que terminou", "Concluída em dd/mm", "Travada"...
  readonly state: CharacterState | null
  // O selo de visibilidade do NPC ("Oculto", "Identidade revelada", "Ficha
  // revelada"); null no PC (T-52). Não passa pelo characterState
  readonly visibility: string | null
}

export function buildItem(
  row: TableRowData,
  model: SheetModel | null | undefined
): TableItem {
  let store: SheetStore | null = null
  if (model) {
    // O que vem da rede é input hostil: ficha que não valida não é desenhada
    const parsed = parseSheet(model, row.sheet)
    if (parsed.ok)
      store = createSheetStore({
        characterId: row.id,
        model,
        sheet: parsed.value,
        sheetVersion: row.sheetVersion,
        roles: ['storyteller'],
      })
  }
  return {
    row,
    model,
    store,
    alerts:
      model && store
        ? alertsOf(model, store.getState().resolved, ['storyteller'])
        : [],
    // A Mesa é só do narrador
    state: characterState(
      { ...row, locked: Boolean(row.lockedAt) },
      { narrating: true, deadLabel: model ? deadLabel(model) : undefined }
    ),
    visibility: row.kind === 'npc' ? npcVisibilityText(row.visibility) : null,
  }
}

/**
 * PCs e NPCs em seções (T-52, plano v5 §1.2), cada uma na ordem da tela. A
 * ordem que a navegação da Mesa lembra é a da tela: PCs e depois NPCs.
 */
export function bySection(items: readonly TableItem[]): {
  readonly pcs: readonly TableItem[]
  readonly npcs: readonly TableItem[]
} {
  const pcs: TableItem[] = []
  const npcs: TableItem[] = []
  for (const item of items) (item.row.kind === 'npc' ? npcs : pcs).push(item)
  return { pcs, npcs }
}

export type TableSort = 'name' | 'updated'

const byName = new Intl.Collator('pt-BR', { sensitivity: 'base' })

/** A ordem e o filtro da tela, sem copiar os itens. */
export function arrange(
  items: readonly TableItem[],
  options: { readonly sort: TableSort; readonly onlyAlerts: boolean }
): TableItem[] {
  const shown = options.onlyAlerts
    ? items.filter(i => i.alerts.length > 0)
    : [...items]
  return shown.sort((a, b) =>
    options.sort === 'name'
      ? byName.compare(a.row.name, b.row.name)
      : new Date(b.row.updatedAt).getTime() -
        new Date(a.row.updatedAt).getTime()
  )
}
