import {
  type ApplyFailure,
  applyBatch,
  type CreationCheck,
  type CreationInput,
  type CreationRefusal,
  checkCreation,
  checkCreationBatch,
  type FieldId,
  fieldOrder,
  type Issue,
  invert,
  jsonEqual,
  MAX_EVENTS_PER_BATCH,
  parsePath,
  parseSheet,
  type ResolvedField,
  type ResolvedSheet,
  type RoleName,
  resolve,
  type SheetData,
  type SheetEvent,
  type SheetMode,
  type SheetModel,
} from '@tms/sheet-core'
import { randomUUID } from 'expo-crypto'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { type CreationPhase, draftRefusal } from '../creation/creation'
import {
  batchBytes,
  checkLimits,
  MAX_BATCH_BYTES,
  OutboxLimitError,
  type QueuedBatch,
} from '../sync/outbox'
import type { RestorePlan } from './draftRestore'

// Um store por ficha aberta (doc/arquitetura §6.5):
//
//   values = applyAll(snapshot, pending)
//            │          └─ lotes ainda no outbox (otimista)
//            └─ última versão confirmada pelo servidor
//
// Em Evoluir, as alterações vão para um rascunho que vira um lote só ao
// salvar. A tela mostra `values` (ou o rascunho por cima deles). O modo é UX:
// quem decide se pode gravar é o applyBatch, aqui e no servidor.

/** O que um campo precisa para se desenhar. Só muda quando o campo muda. */
export interface FieldEntry {
  readonly resolved: ResolvedField
  readonly specialty: string | undefined
  // O resolve() de onde a entrada saiu. Consistente para o próprio campo;
  // uma view que lê outro campo assina esse campo pelo hook dele.
  readonly sheet: ResolvedSheet
}

/** Uma alteração do rascunho: `from` é o que a pessoa viu ao começar. */
export interface DraftEdit {
  readonly from: unknown
  readonly to: unknown
}

export type Draft = ReadonlyMap<string, DraftEdit>

/**
 * De onde vêm os campos em conflito do rascunho: `draft`, o "Salvar" de
 * Criação/Editar recusado com 409 (T-31), que volta inteiro ao rascunho;
 * `recovery`, o rascunho recuperado do aparelho com campos que mudaram desde
 * então (T-03). As entradas em conflito ficam no rascunho com o `from`
 * antigo, e o "Salvar" é recusado até a pessoa escolher campo a campo.
 */
export type DraftConflictOrigin = 'draft' | 'recovery'

/**
 * Quem mudou o campo, relativo a quem pediu (o 409 da API): `self`, a mesma
 * conta noutro aparelho; `owner`, o jogador; `storyteller`, o narrador; null
 * quando não se sabe (ou quando dizer revelaria uma rolagem oculta).
 */
export type ChangedBy = 'self' | 'owner' | 'storyteller' | null

/** O que o 409 disse, já validado (sync.ts, parseConflictBody). */
export interface ConflictDetail {
  // Só os caminhos em conflito, todos do próprio lote
  readonly paths: readonly string[]
  readonly changedBy?: Readonly<Record<string, ChangedBy>>
}

/**
 * O conflito tem duas partes, que não se misturam: os lotes do Jogo (voltam
 * inteiros, "Reaplicar tudo", ou não voltam: uma ação mexe em campos
 * ligados) e os campos do rascunho (resolvidos um a um). Um 409 de um lado
 * nunca apaga o que o outro guarda.
 */
export interface SheetConflict {
  readonly play: {
    readonly batches: readonly QueuedBatch[]
    readonly paths: readonly string[]
  } | null
  readonly draft: {
    readonly paths: readonly string[]
    readonly origin: DraftConflictOrigin
  } | null
  // Por caminho; ausente: em outro lugar
  readonly changedBy?: Readonly<Record<string, ChangedBy>>
}

/** Junta as partes; sem nenhuma, não há conflito. */
const conflictOf = (
  play: SheetConflict['play'],
  draft: SheetConflict['draft'],
  changedBy: SheetConflict['changedBy']
): SheetConflict | null =>
  play || draft ? { play, draft, ...(changedBy ? { changedBy } : {}) } : null

/**
 * Como o último rascunho saiu: salvo (a Promise diz se o lote entrou no
 * outbox) ou descartado. O rascunho persistido só some depois disso (T-03).
 */
export type DraftExit =
  | { readonly kind: 'saved'; readonly queued: Promise<boolean> }
  | { readonly kind: 'discarded' }

// `creation`: a avaliação parcial da criação por pontos recusou o lote
// (doc/plano-v4.md §3.1); ele nem entra na fila
export type CommitFailure = ApplyFailure | 'limit' | 'readonly' | 'creation'

export type CommitResult =
  | {
      readonly ok: true
      readonly batch: QueuedBatch
      // O lote entrou no outbox do aparelho (false: não pôde ser guardado)
      readonly queued?: Promise<boolean>
    }
  | {
      readonly ok: false
      readonly kind: CommitFailure
      readonly issues: readonly Issue[]
    }

/** Para onde vão os lotes confirmados no aparelho (o SyncProvider). */
export interface SheetSync {
  enqueue(characterId: string, batch: QueuedBatch): void | Promise<void>
}

export interface SheetStoreInit {
  readonly characterId: string
  readonly model: SheetModel
  readonly sheet: SheetData
  readonly sheetVersion: number
  readonly roles: readonly RoleName[]
  readonly mode?: SheetMode
  // Sem sync, a ficha é só de leitura (prévia, testes de renderização).
  readonly sync?: SheetSync
  readonly uuid?: () => string
  // A conta da criação por pontos, quando ela vale (creating/pending, modo
  // por pontos): os contadores e a avaliação parcial antes de enfileirar
  readonly creation?: CreationInput | null
  // A política deixa editar; sem ela, o padrão é sim (prévia, testes)
  readonly editable?: boolean
}

export interface SheetState {
  readonly characterId: string
  readonly model: SheetModel
  readonly roles: readonly RoleName[]
  readonly snapshot: SheetData
  readonly sheetVersion: number
  readonly pending: readonly QueuedBatch[]
  readonly values: SheetData
  readonly resolved: ResolvedSheet
  readonly entries: ReadonlyMap<FieldId, FieldEntry>
  readonly mode: SheetMode
  readonly draft: Draft | null
  readonly draftExit: DraftExit | null
  readonly undoStack: readonly QueuedBatch[]
  readonly conflict: SheetConflict | null
  // O que o servidor recusou (422), por campo: o editor mostra a mensagem.
  readonly fieldIssues: ReadonlyMap<FieldId, string>
  readonly creation: CreationInput | null
  // A conta do que a tela mostra (com o rascunho), ou null sem criação
  readonly check: CreationCheck | null
  // A última recusa da avaliação parcial, para a tela explicar por grupo
  readonly creationRefusal: CreationRefusal | null
  // Na criação, o que a distribuição gasta agora: básicos ou bônus
  readonly creationPhase: CreationPhase
  // A política deixa editar (não travada, arquivada nem de quem saiu). Sem
  // ela, nada entra em Criação/Editar: o rascunho fica guardado no aparelho
  readonly editable: boolean
}

export interface SheetActions {
  /** Aplica no aparelho e enfileira. Lote inválido nem sai daqui. */
  commit(
    events: readonly SheetEvent[],
    label: string,
    options?: { readonly undoable?: boolean; readonly draft?: boolean }
  ): CommitResult
  /** Desfaz um lote (o último, sem id): é só mais um lote, o inverso. */
  undo(clientBatchId?: string): CommitResult | null
  /** O servidor confirmou: a resposta dele vira o snapshot. */
  confirmed(clientBatchId: string, body: unknown): void
  /**
   * 400, 403, 404, 422: sai da fila e o otimista volta atrás. Com as issues
   * do 422, marca os campos; em Evoluir, o rascunho volta para corrigir.
   */
  rejected(
    clientBatchId: string,
    issues?: readonly Issue[]
  ): QueuedBatch | undefined
  /**
   * 409: sai da fila. O lote do "Salvar" volta ao rascunho, com só os campos
   * do 409 marcados; o do Jogo fica guardado para "Reaplicar tudo". Devolve
   * false quando o lote do "Salvar" não pôde voltar (a política não deixa
   * editar): quem chamou guarda o rascunho no aparelho.
   */
  conflicted(clientBatchId: string, detail?: ConflictDetail): boolean
  /** A ficha rebuscada do servidor (foco, reconexão, depois de um 409). */
  received(sheet: unknown, sheetVersion: number): boolean
  /** Lotes que já estavam no outbox (a ficha reaberta antes de sincronizar). */
  hydrate(pending: readonly QueuedBatch[]): void
  /** Reaplica os lotes do Jogo em conflito sobre os valores atuais. */
  reapply(): CommitResult | null
  /** Mantém a ficha como está: os lotes do Jogo em conflito saem. */
  dismissConflict(): void
  /**
   * Um campo em conflito do rascunho: `mine` fica com o seu valor sobre o de
   * agora; `theirs` tira a entrada do rascunho.
   */
  resolveConflict(path: string, choice: 'mine' | 'theirs'): void
  setMode(mode: SheetMode): void
  startDraft(): void
  /** Altera o rascunho de Evoluir (validado como um lote). */
  editDraft(events: readonly SheetEvent[]): CommitResult | null
  /** Um caminho do rascunho; o `from` é o valor que a tela mostra agora. */
  setDraftValue(path: string, to: unknown): CommitResult | null
  /** O lote que o rascunho viraria (o resumo de "Concluir"). */
  draftEvents(): SheetEvent[]
  saveDraft(label: string): CommitResult | null
  discardDraft(): void
  /**
   * O rascunho recuperado do aparelho (T-03), já revalidado por
   * planDraftRestore. Entra no modo pedido (o do registro), se ele ainda
   * vale, senão em Criação ou Editar; os campos que mudaram desde então
   * ficam marcados como conflito. Sem permissão de edição, não entra: devolve
   * false e o registro fica.
   */
  restoreDraft(plan: RestorePlan, mode?: 'create' | 'evolve'): boolean
  /** A política mudou (travou, arquivou, liberou). */
  setEditable(editable: boolean): void
  /** A conta da criação mudou (escolhas, orçamento, estado). */
  setCreation(creation: CreationInput | null): void
  /** Básicos (o grupo cheio trava) ou Bônus (passar do grupo usa o saldo). */
  setCreationPhase(phase: CreationPhase): void
}

export type SheetStore = StoreApi<SheetState & SheetActions>

export const MAX_UNDO = 20

const failure = (
  kind: CommitFailure,
  message: string,
  path = ''
): CommitResult => ({ ok: false, kind, issues: [{ path, message }] })

/** Mesma saída na tela: mesma entrada no Map, e o campo não re-renderiza. */
function sameField(a: ResolvedField, b: ResolvedField): boolean {
  if (a.field !== b.field || a.type !== b.type) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every(
    k =>
      k === 'field' ||
      jsonEqual(
        (a as unknown as Record<string, unknown>)[k],
        (b as unknown as Record<string, unknown>)[k]
      )
  )
}

function share(
  previous: ReadonlyMap<FieldId, FieldEntry> | undefined,
  resolved: ResolvedSheet
): ReadonlyMap<FieldId, FieldEntry> {
  const next = new Map<FieldId, FieldEntry>()
  for (const r of resolved.fields) {
    const specialty = resolved.specialty(r.id)
    const old = previous?.get(r.id)
    next.set(
      r.id,
      old && old.specialty === specialty && sameField(old.resolved, r)
        ? old
        : { resolved: r, specialty, sheet: resolved }
    )
  }
  return next
}

/** O campo de um caminho de issue ("values.strength", "/values/x/0/value"). */
export function fieldOfIssuePath(path: string): FieldId | null {
  const dotted = path.replace(/^\//, '').replace(/\//g, '.')
  const m = /^(?:values|specialties)\.([^.]+)/.exec(dotted)
  return m?.[1] ? (m[1] as FieldId) : null
}

function issuesByField(
  model: SheetModel,
  issues: readonly Issue[]
): ReadonlyMap<FieldId, string> {
  const out = new Map<FieldId, string>()
  for (const issue of issues) {
    const id = fieldOfIssuePath(issue.path)
    if (id && model.fields.has(id) && !out.has(id)) out.set(id, issue.message)
  }
  return out
}

const NO_ISSUES: ReadonlyMap<FieldId, string> = new Map()

const NO_BATCH = '00000000-0000-4000-8000-000000000000'

/** Por que o rascunho não cabe num lote (50 eventos, 64 KiB), ou null. */
export function draftLimit(draft: Draft): string | null {
  if (draft.size > MAX_EVENTS_PER_BATCH)
    return `Até ${MAX_EVENTS_PER_BATCH} alterações por vez: salve antes de continuar.`
  const events = [...draft].map(([path, e]) => ({
    path,
    from: e.from,
    to: e.to,
  }))
  if (batchBytes({ clientBatchId: NO_BATCH, events }) > MAX_BATCH_BYTES)
    return 'As alterações ficaram grandes demais para um envio: salve antes de continuar.'
  return null
}

export const valueAt = (sheet: SheetData, path: string): unknown => {
  const p = parsePath(path)
  if (!p) return null
  const bucket: Readonly<Record<string, unknown>> =
    (p.scope === 'values' ? sheet.values : sheet.specialties) ?? {}
  return Object.hasOwn(bucket, p.fieldId) ? bucket[p.fieldId] : null
}

export function createSheetStore(init: SheetStoreInit): SheetStore {
  const { model, roles, sync, characterId } = init
  const uuid = init.uuid ?? randomUUID

  const applyAll = (snapshot: SheetData, pending: readonly QueuedBatch[]) =>
    pending.reduce<SheetData>((sheet, batch) => {
      // Lote que não aplica mais (o servidor já o aplicou ou vai recusar):
      // fica na fila e a resposta do servidor decide
      const r = applyBatch(model, sheet, batch, roles)
      return r.ok ? r.sheet : sheet
    }, snapshot)

  // Ordem da ficha (seções e grupos do template; valores, depois
  // especializações): o resumo de "Salvar"/"Concluir" e o lote saem nela, não
  // na ordem das chaves do jsonb (T-54). O servidor não depende da ordem: os
  // caminhos são distintos e cada `from` é conferido no seu caminho.
  const order = new Map<string, number>()
  for (const scope of ['values', 'specialties'])
    for (const id of fieldOrder(model)) order.set(`${scope}.${id}`, order.size)
  const draftToEvents = (draft: Draft): SheetEvent[] =>
    [...draft]
      .sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      .map(([path, e]) => ({ path, from: e.from, to: e.to }))

  // O que a tela mostra: os valores, ou o rascunho de Evoluir por cima deles
  // (o que outra pessoa mudou noutros campos continua aparecendo). Se alguém
  // mudou um campo do rascunho, a tela mostra o do rascunho; o conflito
  // aparece ao salvar.
  const shown = (values: SheetData, draft: Draft | null): SheetData => {
    if (!draft?.size) return values
    const events = draftToEvents(draft)
    const r = applyBatch(model, values, { events }, roles)
    if (r.ok) return r.sheet
    const rebased = events.map(e => ({ ...e, from: valueAt(values, e.path) }))
    const again = applyBatch(model, values, { events: rebased }, roles)
    return again.ok ? again.sheet : values
  }

  type Derived = Pick<SheetState, 'values' | 'resolved' | 'entries' | 'check'>
  const derive = (
    state: Pick<SheetState, 'snapshot' | 'pending' | 'draft'> &
      Partial<Pick<SheetState, 'entries' | 'creation'>>,
    values = applyAll(state.snapshot, state.pending)
  ): Derived => {
    const display = shown(values, state.draft)
    const resolved = resolve(model, display)
    return {
      values,
      resolved,
      entries: share(state.entries, resolved),
      // O rascunho pode mostrar o excesso enquanto é corrigido (§3.1)
      check: state.creation
        ? checkCreation(model, display, state.creation)
        : null,
    }
  }

  return createStore<SheetState & SheetActions>()((set, get) => {
    const without = (clientBatchId: string) => {
      const s = get()
      const batch = s.pending.find(b => b.clientBatchId === clientBatchId)
      const pending = s.pending.filter(b => b.clientBatchId !== clientBatchId)
      const undoStack = s.undoStack.filter(
        b => b.clientBatchId !== clientBatchId
      )
      return { batch, pending, undoStack }
    }

    // O modo do rascunho que volta: o pedido (o do registro ou o do lote),
    // se ainda vale; a Criação só enquanto a conta por pontos vale
    const allowedMode = (wanted?: 'create' | 'evolve'): 'create' | 'evolve' => {
      const creating = Boolean(get().creation)
      if (wanted === 'create') return creating ? 'create' : 'evolve'
      if (wanted === 'evolve') return 'evolve'
      return creating ? 'create' : 'evolve'
    }
    const returnMode = (batch: QueuedBatch | undefined) =>
      allowedMode(batch?.draftMeta?.mode)

    const commit: SheetActions['commit'] = (events, label, options) => {
      const s = get()
      if (!sync) return failure('readonly', 'ficha só de leitura')
      const r = applyBatch(model, s.values, { events }, roles)
      if (!r.ok) return { ok: false, kind: r.kind, issues: r.issues }
      // A mesma avaliação parcial do servidor, antes de enfileirar: o lote
      // que estoura a conta não sai do aparelho
      const refused = s.creation
        ? checkCreationBatch(model, s.values, r.sheet, s.creation)
        : null
      if (refused) {
        set({ creationRefusal: refused })
        return {
          ok: false,
          kind: 'creation',
          issues: refused.problems.flatMap(p =>
            (p.paths.length ? p.paths : ['']).map(path => ({
              path: path.split('#')[0] ?? '',
              message: p.code,
            }))
          ),
        }
      }
      const batch: QueuedBatch = {
        clientBatchId: uuid(),
        events: events.map(e => ({ path: e.path, from: e.from, to: e.to })),
        label,
        // O "Salvar" de Criação/Editar leva de onde veio: recusado com a
        // ficha fechada, ele volta ao rascunho do aparelho (T-03)
        ...(options?.draft
          ? {
              draft: true,
              draftMeta: {
                templateVersion: model.version,
                mode: s.mode === 'create' ? 'create' : 'evolve',
              },
            }
          : {}),
      }
      try {
        checkLimits(batch, s.pending.length)
      } catch (e) {
        if (e instanceof OutboxLimitError) return failure('limit', e.message)
        throw e
      }
      const pending = [...s.pending, batch]
      const undoStack =
        options?.undoable === false
          ? s.undoStack
          : [...s.undoStack, batch].slice(-MAX_UNDO)
      set({
        pending,
        undoStack,
        creationRefusal: null,
        ...derive({ ...s, pending }, r.sheet),
      })
      const queued = Promise.resolve(sync.enqueue(characterId, batch)).then(
        () => true,
        () => false
      )
      return { ok: true, batch, queued }
    }

    const editDraft: SheetActions['editDraft'] = events => {
      const s = get()
      if (!s.draft) return null
      const r = applyBatch(model, shown(s.values, s.draft), { events }, roles)
      if (!r.ok) return { ok: false, kind: r.kind, issues: r.issues }
      const draft = new Map(s.draft)
      for (const e of events) {
        // `from: null` (campo sem valor guardado) também é o de antes
        const before = draft.get(e.path)
        const from = before ? before.from : e.from
        // Voltou ao valor de antes: a alteração some do rascunho
        if (jsonEqual(from, e.to)) draft.delete(e.path)
        else draft.set(e.path, { from, to: e.to })
      }
      // O rascunho não passa do lote que a API aceita (50 eventos, 64 KiB):
      // o que não cabe num "Salvar" também não caberia no aparelho
      const tooBig = draftLimit(draft)
      if (tooBig) return failure('limit', tooBig, events[0]?.path ?? '')
      // Mexeu no campo: a recusa anterior do servidor deixa de valer
      let fieldIssues = s.fieldIssues
      for (const e of events) {
        const id = fieldOfIssuePath(e.path)
        if (id && fieldIssues.has(id)) {
          const next = new Map(fieldIssues)
          next.delete(id)
          fieldIssues = next
        }
      }
      const next = derive({ ...s, draft }, s.values)
      // Na criação, a conta vale a cada toque, não só no "Salvar": o grupo
      // cheio trava em Básicos e o saldo de bônus trava em Bônus
      if (s.mode === 'create' && s.creation) {
        const why = draftRefusal(
          model,
          { before: shown(s.values, s.draft), after: r.sheet },
          { before: s.check, after: next.check },
          s.creation,
          s.creationPhase
        )
        if (why)
          return {
            ok: false,
            kind: 'creation',
            issues: events.map(e => ({ path: e.path, message: why.text })),
          }
      }
      set({ draft, fieldIssues, ...next })
      return {
        ok: true,
        batch: { clientBatchId: '', events: [...events], label: '' },
      }
    }

    const received: SheetActions['received'] = (sheet, sheetVersion) => {
      const s = get()
      if (!Number.isInteger(sheetVersion) || sheetVersion < s.sheetVersion)
        return false
      // O que vem da rede é input hostil: passa pelo validador do core
      const parsed = parseSheet(model, sheet)
      if (!parsed.ok) return false
      if (
        sheetVersion === s.sheetVersion &&
        jsonEqual(parsed.value, s.snapshot)
      )
        return true
      const snapshot = parsed.value
      set({ snapshot, sheetVersion, ...derive({ ...s, snapshot }) })
      return true
    }

    return {
      characterId,
      model,
      roles,
      snapshot: init.sheet,
      sheetVersion: init.sheetVersion,
      pending: [],
      ...derive({
        snapshot: init.sheet,
        pending: [],
        draft: null,
        creation: init.creation ?? null,
      }),
      creation: init.creation ?? null,
      creationRefusal: null,
      creationPhase: 'basics',
      mode: init.mode ?? 'read',
      draft: null,
      draftExit: null,
      undoStack: [],
      conflict: null,
      fieldIssues: NO_ISSUES,
      editable: init.editable ?? true,

      commit,
      received,
      editDraft,

      setDraftValue(path, to) {
        const s = get()
        if (!s.draft) return null
        const from = valueAt(shown(s.values, s.draft), path)
        return editDraft([{ path, from, to }])
      },

      hydrate(batches) {
        const s = get()
        const known = new Set(s.pending.map(b => b.clientBatchId))
        const fresh = batches.filter(b => !known.has(b.clientBatchId))
        if (!fresh.length) return
        const pending = [...fresh, ...s.pending]
        set({ pending, ...derive({ ...s, pending }) })
      },

      undo(clientBatchId) {
        const s = get()
        const batch = clientBatchId
          ? s.undoStack.find(b => b.clientBatchId === clientBatchId)
          : s.undoStack.at(-1)
        if (!batch) return null
        const result = commit(
          invert(batch.events),
          `Desfeito: ${batch.label}`,
          {
            undoable: false,
          }
        )
        if (result.ok)
          set({
            undoStack: get().undoStack.filter(
              b => b.clientBatchId !== batch.clientBatchId
            ),
          })
        return result
      },

      confirmed(clientBatchId, body) {
        // Confirmado continua desfazível: só sai da fila
        const { pending } = without(clientBatchId)
        const s = get()
        set({ pending, ...derive({ ...s, pending }) })
        const res = body as { sheet?: unknown; sheetVersion?: unknown } | null
        if (res && typeof res.sheetVersion === 'number')
          received(res.sheet, res.sheetVersion)
      },

      rejected(clientBatchId, issues) {
        const { batch, pending, undoStack } = without(clientBatchId)
        const s = get()
        const marked = issues?.length ? issuesByField(model, issues) : null
        // O "Salvar" de Evoluir recusado (422): as alterações voltam ao
        // rascunho, com os campos marcados, em vez de sumirem. Recusa de um
        // lote do Jogo só desfaz o otimista. Sem permissão de edição, a tela
        // não entra em edição: o sync guarda o rascunho no aparelho
        const back = Boolean(
          marked?.size && batch?.draft && !s.draft && s.editable
        )
        const draft = back
          ? new Map(
              (batch?.events ?? []).map(e => [
                e.path,
                { from: e.from, to: e.to },
              ])
            )
          : s.draft
        set({
          pending,
          undoStack,
          draft,
          mode: back ? returnMode(batch) : s.mode,
          fieldIssues: marked?.size ? marked : s.fieldIssues,
          ...derive({ ...s, pending, draft }),
        })
        return batch
      },

      conflicted(clientBatchId, detail) {
        const { batch, pending, undoStack } = without(clientBatchId)
        const s = get()
        const inBatch = new Set(batch?.events.map(e => e.path) ?? [])
        const marked = (detail?.paths ?? []).filter(p => inBatch.has(p))
        const changedBy =
          s.conflict?.changedBy || detail?.changedBy
            ? { ...(s.conflict?.changedBy ?? {}), ...(detail?.changedBy ?? {}) }
            : undefined
        // O "Salvar" de Criação/Editar (T-31): as alterações voltam todas ao
        // rascunho, como no 422. As que não conflitam ficam prontas; as do
        // 409 ficam com o `from` antigo e seguram o Salvar até a escolha. Os
        // lotes do Jogo em conflito, se houver, continuam guardados
        if (batch?.draft && !s.draft?.size) {
          if (!s.editable) {
            set({ pending, undoStack, ...derive({ ...s, pending }) })
            return false
          }
          const draft = new Map(
            batch.events.map(e => [e.path, { from: e.from, to: e.to }])
          )
          set({
            pending,
            undoStack,
            draft,
            mode: returnMode(batch),
            conflict: conflictOf(
              s.conflict?.play ?? null,
              {
                paths: marked.length ? marked : [...inBatch],
                origin: 'draft',
              },
              changedBy
            ),
            ...derive({ ...s, pending, draft }),
          })
          return true
        }
        // Lote do Jogo (ou um "Salvar" com outro rascunho já aberto): volta
        // inteiro ou não volta. Os campos do rascunho em conflito ficam
        const batches = [
          ...(s.conflict?.play?.batches ?? []),
          ...(batch ? [batch] : []),
        ]
        // Só os campos do 409; sem o corpo, o lote inteiro (como antes)
        const paths = marked.length ? marked : [...inBatch]
        set({
          pending,
          undoStack,
          conflict: batches.length
            ? conflictOf(
                {
                  batches,
                  paths: [
                    ...new Set([...(s.conflict?.play?.paths ?? []), ...paths]),
                  ],
                },
                s.conflict?.draft ?? null,
                changedBy
              )
            : s.conflict,
          ...derive({ ...s, pending }),
        })
        return true
      },

      reapply() {
        const s = get()
        const play = s.conflict?.play
        if (!play) return null
        // O último `to` de cada caminho, com o `from` de agora
        const last = new Map<string, unknown>()
        for (const b of play.batches)
          for (const e of b.events) last.set(e.path, e.to)
        const events = [...last]
          .map(([path, to]) => ({ path, from: valueAt(s.values, path), to }))
          .filter(e => !jsonEqual(e.from, e.to))
        set({
          conflict: conflictOf(
            null,
            s.conflict?.draft ?? null,
            s.conflict?.changedBy
          ),
        })
        return events.length ? commit(events, 'Reaplicado') : null
      },

      dismissConflict() {
        const s = get()
        set({
          conflict: conflictOf(
            null,
            s.conflict?.draft ?? null,
            s.conflict?.changedBy
          ),
        })
      },

      resolveConflict(path, choice) {
        const s = get()
        const part = s.conflict?.draft
        if (!part || !s.draft || !part.paths.includes(path)) return
        const draft = new Map(s.draft)
        const edit = draft.get(path)
        if (edit) {
          const from = valueAt(s.values, path)
          if (choice === 'theirs' || jsonEqual(from, edit.to))
            draft.delete(path)
          else draft.set(path, { from, to: edit.to })
        }
        const paths = part.paths.filter(p => p !== path)
        set({
          draft,
          conflict: conflictOf(
            s.conflict?.play ?? null,
            paths.length ? { ...part, paths } : null,
            s.conflict?.changedBy
          ),
          ...derive({ ...s, draft }, s.values),
        })
      },

      setMode(mode) {
        set({ mode })
      },

      startDraft() {
        const s = get()
        if (s.draft) return
        set({ draft: new Map() })
      },

      draftEvents() {
        const { draft } = get()
        return draft ? draftToEvents(draft) : []
      },

      saveDraft(label) {
        const s = get()
        if (!s.draft) return null
        const events = draftToEvents(s.draft)
        if (!events.length) {
          set({ draft: null, draftExit: { kind: 'discarded' } })
          return null
        }
        // Salvar é um lote só; com conflito, o rascunho fica para decidir
        const result = commit(events, label, { draft: true })
        if (result.ok) {
          const after = get()
          set({
            draft: null,
            draftExit: {
              kind: 'saved',
              queued: result.queued ?? Promise.resolve(true),
            },
            fieldIssues: NO_ISSUES,
            ...derive({ ...after, draft: null }, after.values),
          })
        }
        return result
      },

      discardDraft() {
        const s = get()
        set({
          draft: null,
          draftExit: { kind: 'discarded' },
          // O conflito do rascunho sai com ele; o do Jogo fica
          conflict: conflictOf(
            s.conflict?.play ?? null,
            null,
            s.conflict?.changedBy
          ),
          fieldIssues: NO_ISSUES,
          creationRefusal: null,
          ...derive({ ...s, draft: null }, s.values),
        })
      },

      restoreDraft(plan, mode) {
        const s = get()
        // Sem permissão de edição, a tela não entra em edição; o registro
        // continua guardado no aparelho
        if (!s.editable) return false
        const draft = new Map(
          plan.events.map(e => [e.path, { from: e.from, to: e.to }])
        )
        set({
          draft,
          mode: allowedMode(mode),
          conflict: conflictOf(
            s.conflict?.play ?? null,
            plan.conflicts.length
              ? { paths: plan.conflicts, origin: 'recovery' }
              : null,
            s.conflict?.changedBy
          ),
          fieldIssues: NO_ISSUES,
          creationRefusal: null,
          ...derive({ ...s, draft }, s.values),
        })
        return true
      },

      setEditable(editable) {
        if (get().editable !== editable) set({ editable })
      },

      setCreation(creation) {
        const s = get()
        set({
          creation,
          creationRefusal: null,
          ...derive({ ...s, creation }, s.values),
        })
      },

      setCreationPhase(creationPhase) {
        set({ creationPhase })
      },
    }
  })
}
