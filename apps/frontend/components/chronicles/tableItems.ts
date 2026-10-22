import {
  type ActiveAlert,
  alertsOf,
  parseSheet,
  type SheetModel,
} from '@tms/sheet-core'

import { deadLabel } from '../../sheet/policy'
import { createSheetStore, type SheetStore } from '../../sheet/store/sheetStore'

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
  readonly status?: string
  readonly lockedAt?: string | Date | null
  readonly updatedAt: string | Date
  readonly sheet: unknown
}

export interface TableItem {
  readonly row: TableRowData
  // undefined: o template ainda carrega; null: esta versão do app não o entende
  readonly model: SheetModel | null | undefined
  // Store só de leitura (sem fila) para desenhar o dock com o registry
  readonly store: SheetStore | null
  readonly alerts: readonly ActiveAlert[]
  // O estado quando ele importa: "Em criação", "Travada", "Arquivada"...
  readonly state: string | null
}

/** O rótulo do estado da ficha na Mesa; null em `active` sem trava. */
export function stateLabel(
  model: SheetModel | null | undefined,
  status: string | undefined,
  locked: boolean
): string | null {
  switch (status) {
    case 'creating':
      return 'Em criação'
    case 'active':
      return locked ? 'Travada' : null
    case 'archived':
      return 'Arquivada'
    case 'dead':
      return model ? deadLabel(model) : 'Fora de jogo'
    default:
      return null
  }
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
    state: stateLabel(model, row.status, Boolean(row.lockedAt)),
  }
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
