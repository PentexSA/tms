import {
  type ActiveAlert,
  alertsOf,
  type CreationInput,
  creationInputOf,
  parseCharacterCreation,
  parseSheet,
  type SheetModel,
} from '@tms/sheet-core'

import { whenLabel } from '../../lib/format'
import {
  type CreationProgress,
  creationProgress,
} from '../../sheet/creation/progress'
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

// Quem fez a última alteração (P09-C, T-83), calculado no servidor contra quem
// pede: a resposta não leva id nem nome de quem fez
export interface TableLastChange {
  readonly at: string | Date
  readonly by: 'you' | 'owner' | 'other'
}

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
  // A entrada da conta da criação (P09-D, R-15): as escolhas e a camada da
  // configuração, só no PC em criação por pontos; null no resto. Ausente na
  // API antiga
  readonly creationInput?: {
    readonly choices?: unknown
    readonly config?: unknown
  } | null
  readonly activatedAt?: string | Date | null
  readonly lockedAt?: string | Date | null
  readonly updatedAt: string | Date
  readonly lastChange?: TableLastChange | null
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
  // O progresso da criação por pontos (P09-D, D-10): a mesma conta da barra
  // do jogador; null sem conta (NPC, criação livre, em jogo, API antiga)
  readonly progress: CreationProgress | null
}

/**
 * A entrada da conta a partir do que a Mesa mandou. O que vem da rede é
 * input hostil: o parse do core roda de novo, e escolha ou camada fora do
 * formato vale como ausente. Sem `creationInput` (ou no NPC): null, e o
 * cartão fica sem a linha (fail secure).
 */
export function tableCreationInput(
  row: TableRowData,
  model: SheetModel
): CreationInput | null {
  const raw = row.creationInput
  if (row.kind === 'npc' || !raw || typeof raw !== 'object') return null
  const input = creationInputOf(
    model,
    parseCharacterCreation(model, { choices: raw.choices, config: raw.config })
  )
  return input.config.mode === 'points' ? input : null
}

/**
 * A meta do cartão: quem alterou por último e quando (T-83). O nome do dono
 * aparece uma vez. Sem `lastChange` (ficha sem lote, ou a API antiga) ou com
 * um `by` desconhecido, fica o texto de antes, pelo `updatedAt` e sem autor
 * (fail secure).
 */
export function changeLabel(row: TableRowData, now = new Date()): string {
  const owner = row.owner.username
  const change = row.lastChange
  if (!change) return `${owner} · alterada ${whenLabel(row.updatedAt, now)}`
  const when = whenLabel(change.at, now)
  switch (change.by) {
    case 'you':
      // O NPC é do próprio narrador: o nome dele não diz nada
      return row.kind === 'npc'
        ? `alterada por você ${when}`
        : `${owner} · alterada por você ${when}`
    case 'owner':
      return `alterada por ${owner} ${when}`
    case 'other':
      return `${owner} · alterada ${when}`
    default:
      return `${owner} · alterada ${whenLabel(row.updatedAt, now)}`
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
        creation: tableCreationInput(row, model),
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
    progress: store ? creationProgress(store.getState().check) : null,
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
