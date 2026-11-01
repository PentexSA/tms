import type { RoleName, SheetData } from '@tms/sheet-core'
import { clone, example, modelOf, sheetFor } from '../../../test/fixtures'
import type { DraftRecord } from '../../sync/draftStore'
import { MAX_PENDING_PER_CHARACTER } from '../../sync/outbox'
import { planDraftRestore } from '../draftRestore'
import { createSheetStore, fieldOfIssuePath, MAX_UNDO } from '../sheetStore'

// Etapa 16: o SheetStore (doc/arquitetura §6.5): otimista, confirmação,
// rejeição, conflito, Desfazer e o rascunho de Evoluir.

const model = modelOf('vtm-v20')
const ID = '00000000-0000-4000-8000-00000000c001'

function setup(roles: RoleName[] = ['owner'], sheet?: SheetData) {
  const enqueue = jest.fn()
  let n = 0
  const store = createSheetStore({
    characterId: ID,
    model,
    sheet: sheet ?? sheetFor('helena', roles).sheet,
    sheetVersion: 3,
    roles,
    sync: { enqueue },
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  })
  return { store, enqueue, s: () => store.getState() }
}

const blood = (from: number, to: number) => ({
  path: 'values.blood',
  from: { current: from },
  to: { current: to },
})
const bloodOf = (sheet: SheetData) =>
  (sheet.values as { blood?: { current: number } }).blood?.current
const value = (s: { resolved: { get(id: string): unknown } }, id: string) =>
  s.resolved.get(id) as { value?: number; current?: number } | undefined

/** A resposta do servidor a um lote: a ficha dele, filtrada pelo papel. */
const serverSheet = (from: SheetData, change: Record<string, unknown>) => ({
  ...from,
  values: { ...from.values, ...change },
})

describe('commit: o otimista', () => {
  it('aplica na hora e enfileira com um clientBatchId novo', () => {
    const { s, enqueue } = setup()
    const result = s().commit([blood(9, 8)], 'Sangue −1')
    expect(result.ok).toBe(true)
    expect(bloodOf(s().values)).toBe(8)
    expect(value(s(), 'blood')?.current).toBe(8)
    // O snapshot (confirmado) não muda até o servidor responder
    expect(bloodOf(s().snapshot)).toBe(9)
    expect(s().pending).toHaveLength(1)
    expect(enqueue).toHaveBeenCalledWith(ID, {
      clientBatchId: '00000000-0000-4000-8000-000000000001',
      events: [blood(9, 8)],
      label: 'Sangue −1',
    })
  })

  it('lote inválido nem sai do aparelho', () => {
    const { s, enqueue } = setup()
    const result = s().commit(
      [{ path: 'values.strength', from: 2, to: 9 }],
      'Força'
    )
    expect(result).toMatchObject({
      ok: false,
      kind: 'invalid',
      issues: [{ path: 'values.strength', message: 'acima do máximo 5' }],
    })
    expect(enqueue).not.toHaveBeenCalled()
    expect(s().pending).toEqual([])
  })

  it('campo derivado, conflito local e sem permissão', () => {
    const { s } = setup(['owner'])
    expect(
      s().commit(
        [{ path: 'values.storytellerNotes', from: null, to: 'x' }],
        'x'
      )
    ).toMatchObject({ ok: false, kind: 'forbidden' })
    const owner = setup().s
    expect(owner().commit([blood(5, 4)], 'Sangue')).toMatchObject({
      ok: false,
      kind: 'conflict',
    })
  })

  it('ficha sem fila é só de leitura', () => {
    const store = createSheetStore({
      characterId: ID,
      model,
      sheet: sheetFor('helena', ['owner']).sheet,
      sheetVersion: 0,
      roles: ['owner'],
    })
    expect(store.getState().commit([blood(9, 8)], 'x')).toMatchObject({
      ok: false,
      kind: 'readonly',
    })
  })

  it('limite de lotes pendentes por ficha (igual ao da fila)', () => {
    const { s, enqueue } = setup()
    let current = 9
    for (let i = 0; i < MAX_PENDING_PER_CHARACTER; i++) {
      const to = current === 0 ? 1 : current - 1
      expect(s().commit([blood(current, to)], 'Sangue').ok).toBe(true)
      current = to
    }
    const to = current === 0 ? 1 : current - 1
    expect(s().commit([blood(current, to)], 'Sangue')).toMatchObject({
      ok: false,
      kind: 'limit',
    })
    expect(enqueue).toHaveBeenCalledTimes(MAX_PENDING_PER_CHARACTER)
  })

  it('lotes em sequência encadeiam o from', () => {
    const { s } = setup()
    expect(s().commit([blood(9, 8)], 'a').ok).toBe(true)
    expect(s().commit([blood(8, 7)], 'b').ok).toBe(true)
    expect(bloodOf(s().values)).toBe(7)
    expect(s().pending).toHaveLength(2)
  })
})

describe('respostas do servidor', () => {
  it('a confirmação troca o snapshot pela ficha do servidor', () => {
    const { s } = setup()
    const first = s().commit([blood(9, 8)], 'a')
    s().commit([blood(8, 7)], 'b')
    if (!first.ok) throw new Error('commit')
    // O servidor responde a ficha dele; os outros lotes continuam por cima
    const server = serverSheet(s().snapshot, {
      blood: { current: 8 },
      concept: 'Arquivista (servidor)',
    })
    s().confirmed(first.batch.clientBatchId, {
      sheetVersion: 4,
      sheet: server,
    })
    expect(s().sheetVersion).toBe(4)
    expect(bloodOf(s().snapshot)).toBe(8)
    expect(s().snapshot.values.concept).toBe('Arquivista (servidor)')
    expect(bloodOf(s().values)).toBe(7)
    expect(s().pending).toHaveLength(1)
    // Confirmado continua desfazível
    expect(s().undoStack.map(b => b.label)).toEqual(['a', 'b'])
  })

  it('resposta que não passa no validador não vira snapshot', () => {
    const { s } = setup()
    const r = s().commit([blood(9, 8)], 'a')
    if (!r.ok) throw new Error('commit')
    const before = s().snapshot
    s().confirmed(r.batch.clientBatchId, {
      sheetVersion: 4,
      sheet: { values: { strength: 99 } },
    })
    expect(s().snapshot).toBe(before)
    expect(s().sheetVersion).toBe(3)
    expect(s().pending).toEqual([])
  })

  it('rejeitado: o otimista volta atrás e sai do Desfazer', () => {
    const { s } = setup()
    const r = s().commit([blood(9, 8)], 'Sangue −1')
    if (!r.ok) throw new Error('commit')
    expect(s().rejected(r.batch.clientBatchId)?.label).toBe('Sangue −1')
    expect(bloodOf(s().values)).toBe(9)
    expect(s().undoStack).toEqual([])
    expect(s().rejected('outro')).toBeUndefined()
  })

  it('conflito: guarda o lote e reaplica sobre o valor de agora', () => {
    const { s, enqueue } = setup()
    const r = s().commit([blood(9, 8)], 'Sangue −1')
    if (!r.ok) throw new Error('commit')
    s().conflicted(r.batch.clientBatchId)
    expect(s().conflict?.paths).toEqual(['values.blood'])
    expect(bloodOf(s().values)).toBe(9)
    // A ficha rebuscada: a narradora gastou 3
    expect(
      s().received(serverSheet(s().snapshot, { blood: { current: 6 } }), 4)
    ).toBe(true)
    expect(bloodOf(s().values)).toBe(6)
    const again = s().reapply()
    expect(again).toMatchObject({ ok: true })
    expect(enqueue).toHaveBeenLastCalledWith(
      ID,
      expect.objectContaining({ events: [blood(6, 8)], label: 'Reaplicado' })
    )
    expect(s().conflict).toBeNull()
    expect(s().reapply()).toBeNull()
  })

  it('reaplicar o que já está lá não gera lote; manter descarta', () => {
    const { s, enqueue } = setup()
    const r = s().commit([blood(9, 8)], 'a')
    if (!r.ok) throw new Error('commit')
    s().conflicted(r.batch.clientBatchId)
    s().received(serverSheet(s().snapshot, { blood: { current: 8 } }), 4)
    expect(s().reapply()).toBeNull()
    expect(enqueue).toHaveBeenCalledTimes(1)

    const r2 = s().commit([blood(8, 7)], 'b')
    if (!r2.ok) throw new Error('commit')
    s().conflicted(r2.batch.clientBatchId)
    s().dismissConflict()
    expect(s().conflict).toBeNull()
  })

  it('vários conflitos se juntam num aviso só', () => {
    const { s } = setup()
    const a = s().commit([blood(9, 8)], 'a')
    const b = s().commit([{ path: 'values.strength', from: 2, to: 3 }], 'Força')
    if (!a.ok || !b.ok) throw new Error('commit')
    s().conflicted(a.batch.clientBatchId)
    s().conflicted(b.batch.clientBatchId)
    s().conflicted('desconhecido')
    expect(s().conflict?.paths).toEqual(['values.blood', 'values.strength'])
  })
})

describe('received: a ficha rebuscada', () => {
  it('versão mais velha, inválida ou não inteira é ignorada', () => {
    const { s } = setup()
    const before = s().resolved
    expect(s().received(s().snapshot, 2)).toBe(false)
    expect(s().received({ values: { strength: 99 } }, 9)).toBe(false)
    expect(s().received(s().snapshot, 3.5)).toBe(false)
    expect(s().resolved).toBe(before)
  })

  it('mesma versão e mesmo conteúdo: nada re-renderiza', () => {
    const { s } = setup()
    const before = s().resolved
    expect(s().received(clone(s().snapshot), 3)).toBe(true)
    expect(s().resolved).toBe(before)
  })

  it('lote que o servidor já aplicou não conta duas vezes', () => {
    const { s } = setup()
    s().commit([blood(9, 8)], 'a')
    // A rebusca chegou antes da resposta: já tem o Sangue 8
    s().received(serverSheet(s().snapshot, { blood: { current: 8 } }), 4)
    expect(bloodOf(s().values)).toBe(8)
  })

  it('hydrate: os lotes que já estavam na fila voltam como otimista', () => {
    const { s } = setup()
    const batch = {
      clientBatchId: '00000000-0000-4000-8000-0000000000aa',
      events: [blood(9, 5)],
      label: 'Sangue −4',
    }
    s().hydrate([batch])
    s().hydrate([batch])
    s().hydrate([])
    expect(s().pending).toHaveLength(1)
    expect(bloodOf(s().values)).toBe(5)
  })
})

describe('Desfazer', () => {
  it('gera o lote inverso, que é só mais um lote', () => {
    const { s, enqueue } = setup()
    const r = s().commit(
      [blood(9, 8), { path: 'values.strength', from: 2, to: 3 }],
      'Sangue e Força'
    )
    if (!r.ok) throw new Error('commit')
    const undone = s().undo(r.batch.clientBatchId)
    expect(undone).toMatchObject({ ok: true })
    expect(enqueue).toHaveBeenLastCalledWith(ID, {
      clientBatchId: expect.any(String),
      events: [{ path: 'values.strength', from: 3, to: 2 }, blood(8, 9)],
      label: 'Desfeito: Sangue e Força',
    })
    expect(bloodOf(s().values)).toBe(9)
    // O inverso não entra na pilha (desfazer o desfazer não existe)
    expect(s().undoStack).toEqual([])
    expect(s().undo()).toBeNull()
  })

  it('sem id desfaz o último; valor que mudou depois é conflito', () => {
    const { s } = setup()
    s().commit([blood(9, 8)], 'a')
    s().commit([blood(8, 7)], 'b')
    expect(s().undo()).toMatchObject({ ok: true })
    expect(bloodOf(s().values)).toBe(8)
    // Depois de "c", desfazer "a" (8 → 9) não bate com o Sangue 2
    s().commit([blood(8, 2)], 'c')
    const first = s().undoStack[0]
    expect(s().undo(first?.clientBatchId)).toMatchObject({
      ok: false,
      kind: 'conflict',
    })
  })

  it(`a pilha guarda os últimos ${MAX_UNDO}`, () => {
    const { s } = setup()
    for (let i = 0; i < MAX_UNDO + 5; i++)
      s().commit([blood(i % 2 ? 8 : 9, i % 2 ? 9 : 8)], `#${i}`)
    expect(s().undoStack).toHaveLength(MAX_UNDO)
    expect(s().undoStack[0]?.label).toBe('#5')
  })
})

describe('rascunho da edição', () => {
  const strength = (from: number, to: number) => ({
    path: 'values.strength',
    from,
    to,
  })

  it('vira um lote só ao salvar, na ordem do template', () => {
    const { s, enqueue } = setup()
    s().setMode('evolve')
    s().startDraft()
    s().startDraft()
    expect(
      s().editDraft([
        { path: 'specialties.occult', from: 'Hermetismo', to: 'Rituais' },
      ])
    ).toMatchObject({ ok: true })
    s().editDraft([strength(2, 3)])
    s().editDraft([strength(3, 4)])
    // A tela mostra o rascunho; a ficha ainda não mudou
    expect(value(s(), 'strength')?.value).toBe(4)
    expect(s().values.values.strength).toBe(2)
    expect(s().draftEvents()).toEqual([
      strength(2, 4),
      { path: 'specialties.occult', from: 'Hermetismo', to: 'Rituais' },
    ])
    expect(enqueue).not.toHaveBeenCalled()
    expect(s().saveDraft('Evolução')).toMatchObject({ ok: true })
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue.mock.calls[0][1].events).toHaveLength(2)
    expect(s().draft).toBeNull()
    expect(s().values.values.strength).toBe(4)
    expect(s().mode).toBe('evolve')
  })

  it('voltar ao valor de antes tira a alteração; descartar volta tudo', () => {
    const { s, enqueue } = setup()
    s().startDraft()
    s().editDraft([strength(2, 3)])
    s().editDraft([strength(3, 2)])
    expect(s().draftEvents()).toEqual([])
    expect(s().saveDraft('nada')).toBeNull()
    expect(s().draft).toBeNull()

    s().startDraft()
    s().editDraft([strength(2, 5)])
    s().discardDraft()
    expect(value(s(), 'strength')?.value).toBe(2)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('rascunho inválido não aceita a alteração', () => {
    const { s } = setup()
    expect(s().editDraft([strength(2, 3)])).toBeNull()
    expect(s().saveDraft('x')).toBeNull()
    expect(s().draftEvents()).toEqual([])
    s().startDraft()
    expect(s().editDraft([strength(2, 6)])).toMatchObject({
      ok: false,
      kind: 'invalid',
    })
  })

  it('o que outra pessoa mudou em outro campo continua aparecendo', () => {
    const { s } = setup()
    s().startDraft()
    s().editDraft([strength(2, 3)])
    s().received(serverSheet(s().snapshot, { blood: { current: 4 } }), 4)
    expect(value(s(), 'blood')?.current).toBe(4)
    expect(value(s(), 'strength')?.value).toBe(3)
  })

  it('mesmo campo mudado por outra pessoa: conflito ao salvar, rascunho fica', () => {
    const { s, enqueue } = setup()
    s().startDraft()
    s().editDraft([strength(2, 3)])
    s().received(serverSheet(s().snapshot, { strength: 4 }), 4)
    // A tela mostra o do rascunho
    expect(value(s(), 'strength')?.value).toBe(3)
    expect(s().saveDraft('Evolução')).toMatchObject({
      ok: false,
      kind: 'conflict',
    })
    expect(s().draft).not.toBeNull()
    expect(enqueue).not.toHaveBeenCalled()
  })
})

describe('assinatura por campo', () => {
  it('só a entrada do campo que mudou é nova', () => {
    const { s } = setup()
    const before = s().entries
    s().commit([blood(9, 8)], 'a')
    const after = s().entries
    expect(after.get('blood')).not.toBe(before.get('blood'))
    const changed = [...after].filter(([id, e]) => before.get(id) !== e)
    expect(changed.map(([id]) => id)).toEqual(['blood'])
  })

  it('especialização nova muda a entrada do campo dela', () => {
    const { s } = setup()
    const before = s().entries
    s().commit(
      [{ path: 'specialties.occult', from: 'Hermetismo', to: 'Rituais' }],
      'a'
    )
    const changed = [...s().entries].filter(([id, e]) => before.get(id) !== e)
    expect(changed.map(([id]) => id)).toEqual(['occult'])
  })

  it('sistemas sem nada de WoD funcionam igual', () => {
    const c = example('lia')
    const other = modelOf(c.system)
    const store = createSheetStore({
      characterId: ID,
      model: other,
      sheet: c.sheet,
      sheetVersion: 0,
      roles: ['owner'],
      sync: { enqueue: jest.fn() },
      uuid: () => '00000000-0000-4000-8000-000000000001',
    })
    expect(store.getState().entries.size).toBe(other.fields.size)
  })
})

describe('Editar (Etapa 18): setDraftValue e o 422', () => {
  it('campo sem valor guardado editado duas vezes mantém o from null', () => {
    const { s } = setup(['owner'], {
      values: { name: 'Nova' },
      specialties: {},
    })
    s().startDraft()
    expect(s().setDraftValue('values.strength', 2)).toMatchObject({ ok: true })
    expect(s().setDraftValue('values.strength', 3)).toMatchObject({ ok: true })
    expect(s().draftEvents()).toEqual([
      { path: 'values.strength', from: null, to: 3 },
    ])
    expect(s().saveDraft('Força')).toMatchObject({ ok: true })
  })

  it('setDraftValue sem rascunho não faz nada', () => {
    const { s } = setup()
    expect(s().setDraftValue('values.strength', 3)).toBeNull()
  })

  it('422 do Salvar: o rascunho volta, em Editar, com o campo marcado', () => {
    const { s } = setup()
    s().setMode('evolve')
    s().startDraft()
    s().setDraftValue('values.strength', 3)
    const saved = s().saveDraft('Evolução')
    if (!saved?.ok) throw new Error('save')
    expect(saved.batch.draft).toBe(true)
    // A tela já saiu de Evoluir quando a resposta chega
    s().setMode('read')
    s().rejected(saved.batch.clientBatchId, [
      { path: 'values.strength', message: 'acima do permitido' },
      { path: 'values.strength', message: 'segunda mensagem' },
      { path: 'values.naoExiste', message: 'ignorada' },
    ])
    expect(s().mode).toBe('evolve')
    expect(s().draftEvents()).toEqual([
      { path: 'values.strength', from: 2, to: 3 },
    ])
    expect([...s().fieldIssues]).toEqual([['strength', 'acima do permitido']])
    // Mexer no campo apaga a marca
    s().setDraftValue('values.strength', 4)
    expect(s().fieldIssues.size).toBe(0)
  })

  it('422 de um lote do Jogo só desfaz (não abre Editar)', () => {
    const { s } = setup()
    s().setMode('play')
    const r = s().commit([blood(9, 8)], 'Sangue −1')
    if (!r.ok) throw new Error('commit')
    s().rejected(r.batch.clientBatchId, [
      { path: 'values.blood', message: 'não' },
    ])
    expect(s().mode).toBe('play')
    expect(s().draft).toBeNull()
    expect(s().fieldIssues.get('blood')).toBe('não')
  })

  it('descartar limpa as marcas', () => {
    const { s } = setup()
    s().setMode('evolve')
    s().startDraft()
    s().setDraftValue('values.strength', 3)
    const saved = s().saveDraft('x')
    if (!saved?.ok) throw new Error('save')
    s().rejected(saved.batch.clientBatchId, [
      { path: 'values.dexterity', message: 'm' },
    ])
    expect(s().fieldIssues.size).toBe(1)
    s().discardDraft()
    expect(s().fieldIssues.size).toBe(0)
  })

  it.each([
    ['values.strength', 'strength'],
    ['/values/strength', 'strength'],
    ['values.disciplines.0.value', 'disciplines'],
    ['specialties.occult', 'occult'],
    ['', null],
    ['events.0.path', null],
  ])('o caminho %s marca %s', (path, field) => {
    expect(fieldOfIssuePath(path)).toBe(field)
  })
})

// T-03: o rascunho volta do aparelho revalidado com os papéis e a ficha de
// agora; o que mudou desde então fica marcado, e nada sobrescreve às cegas
describe('rascunho recuperado do aparelho', () => {
  const strength = (from: number, to: number) => ({
    path: 'values.strength',
    from,
    to,
  })
  const record = (edits: DraftRecord['edits']): DraftRecord => ({
    v: 1,
    characterId: ID,
    templateVersion: model.version,
    baseVersion: 2,
    mode: 'evolve',
    savedAt: Date.now(),
    edits,
  })

  it('separa o que entra, o que já está salvo, o que mudou e o que o papel não escreve', () => {
    const { s } = setup()
    const plan = planDraftRestore(
      model,
      s().values,
      s().roles,
      record([
        // Igual ao `from`: entra como estava
        { path: 'values.strength', from: 2, to: 3 },
        // Já salvo (valor atual = `to`): sai em silêncio
        { path: 'values.dexterity', from: 1, to: 2 },
        // Mudou desde então (atual 4, nem `from` nem `to`): conflito
        { path: 'values.occult', from: 2, to: 3 },
        // O dono não escreve as Notas do Narrador
        { path: 'values.storytellerNotes', from: null, to: 'x' },
        // Projeção do extrato de XP: nunca por evento
        { path: 'values.xpTotal', from: null, to: 99 },
        // Campo que o template não tem
        { path: 'values.inexistente', from: null, to: 1 },
      ])
    )
    expect(plan).toEqual({
      events: [
        { path: 'values.strength', from: 2, to: 3 },
        { path: 'values.occult', from: 2, to: 3 },
      ],
      conflicts: ['values.occult'],
      applied: 1,
      dropped: 3,
    })
  })

  it('o que não passa na validação sai; o resto volta', () => {
    const { s } = setup()
    const plan = planDraftRestore(
      model,
      s().values,
      s().roles,
      record([
        { path: 'values.strength', from: 2, to: 9 },
        { path: 'values.dexterity', from: 2, to: 3 },
      ])
    )
    expect(plan.events).toEqual([{ path: 'values.dexterity', from: 2, to: 3 }])
    expect(plan.dropped).toBe(1)
  })

  it('restoreDraft entra em Editar com o rascunho; o conflito segura o Salvar até escolher', () => {
    const { s, enqueue } = setup()
    s().restoreDraft(
      planDraftRestore(
        model,
        s().values,
        s().roles,
        record([
          { path: 'values.strength', from: 2, to: 3 },
          { path: 'values.occult', from: 2, to: 3 },
        ])
      )
    )
    expect(s().mode).toBe('evolve')
    expect(s().draft?.size).toBe(2)
    expect(s().conflict).toEqual({
      batches: [],
      paths: ['values.occult'],
      origin: 'recovery',
    })
    // A tela mostra o valor do rascunho
    expect(value(s(), 'occult')?.value).toBe(3)
    // Com o `from` antigo, o Salvar é recusado (o mesmo aviso do conflito)
    expect(s().saveDraft('x')).toMatchObject({ ok: false, kind: 'conflict' })
    expect(enqueue).not.toHaveBeenCalled()
    // "Manter como está": fica o valor de agora; a entrada sai
    s().dismissConflict()
    expect(s().conflict).toBeNull()
    expect(s().draftEvents()).toEqual([
      { path: 'values.strength', from: 2, to: 3 },
    ])
  })

  it('"Reaplicar" no rascunho recuperado fica com o seu valor sobre o de agora', () => {
    const { s } = setup()
    s().restoreDraft(
      planDraftRestore(
        model,
        s().values,
        s().roles,
        record([{ path: 'values.occult', from: 2, to: 3 }])
      )
    )
    expect(s().reapply()).toBeNull()
    expect(s().conflict).toBeNull()
    expect(s().draftEvents()).toEqual([
      { path: 'values.occult', from: 4, to: 3 },
    ])
    expect(s().saveDraft('Ocultismo')).toMatchObject({ ok: true })
  })

  it('draftExit: salvo leva a Promise do outbox; descartado não', async () => {
    const { s } = setup()
    s().setMode('evolve')
    s().startDraft()
    s().editDraft([strength(2, 3)])
    expect(s().draftExit).toBeNull()
    s().saveDraft('Força')
    const exit = s().draftExit
    expect(exit?.kind).toBe('saved')
    expect(exit?.kind === 'saved' && (await exit.queued)).toBe(true)
    s().startDraft()
    s().editDraft([strength(3, 4)])
    s().discardDraft()
    expect(s().draftExit).toEqual({ kind: 'discarded' })
  })
})

// T-31: um campo em conflito recusava o lote e o aviso culpava os 7;
// "Reaplicar" sobrescrevia o valor do outro sem mostrá-lo
describe('conflito por campo no "Salvar"', () => {
  /** Rascunho de 7 alterações salvo: o lote está no outbox. */
  function savedSeven() {
    const ctx = setup()
    const { s } = ctx
    s().setMode('evolve')
    s().startDraft()
    for (const [path, to] of [
      ['values.strength', 3],
      ['values.dexterity', 3],
      ['values.appearance', 3],
      ['values.occult', 5],
      ['values.sire', 'Meerlinda'],
      ['values.concept', 'Arquivista'],
      ['values.demeanor', 'Galã'],
    ] as const)
      expect(s().setDraftValue(path, to)).toMatchObject({ ok: true })
    const saved = s().saveDraft('7 alterações')
    if (!saved?.ok) throw new Error('não salvou')
    return { ...ctx, batch: saved.batch }
  }
  // O narrador mudou o Senhor antes de o lote chegar
  const withSire = (sire: string) => ({
    ...example('helena').sheet,
    values: { ...example('helena').sheet.values, sire },
  })

  it('as 7 voltam ao rascunho; só o Senhor fica marcado e segura o Salvar', () => {
    const { s, batch } = savedSeven()
    s().conflicted(batch.clientBatchId, { paths: ['values.sire'] })
    expect(s().pending).toEqual([])
    expect(s().mode).toBe('evolve')
    expect(s().draft?.size).toBe(7)
    expect(s().conflict).toEqual({
      batches: [],
      paths: ['values.sire'],
      origin: 'draft',
    })
    s().received(withSire('Etrius'), 4)
    expect(s().saveDraft('x')).toMatchObject({ ok: false, kind: 'conflict' })
  })

  it('"Ficar com o atual" tira a entrada; as outras 6 se salvam', () => {
    const { s, batch, enqueue } = savedSeven()
    s().conflicted(batch.clientBatchId, { paths: ['values.sire'] })
    s().received(withSire('Etrius'), 4)
    s().resolveConflict('values.sire', 'theirs')
    expect(s().conflict).toBeNull()
    expect(s().draft?.size).toBe(6)
    const result = s().saveDraft('6 alterações')
    expect(result).toMatchObject({ ok: true })
    expect(
      enqueue.mock.calls.at(-1)?.[1].events.map((e: { path: string }) => e.path)
    ).not.toContain('values.sire')
  })

  it('"Usar o meu" refaz o `from` sobre o valor de agora', () => {
    const { s, batch } = savedSeven()
    s().conflicted(batch.clientBatchId, { paths: ['values.sire'] })
    s().received(withSire('Etrius'), 4)
    s().resolveConflict('values.sire', 'mine')
    expect(s().conflict).toBeNull()
    expect(s().draft?.get('values.sire')).toEqual({
      from: 'Etrius',
      to: 'Meerlinda',
    })
    expect(s().saveDraft('7 alterações')).toMatchObject({ ok: true })
  })

  it('sem caminhos no 409, o lote inteiro fica marcado (como antes)', () => {
    const { s, batch } = savedSeven()
    s().conflicted(batch.clientBatchId)
    expect(s().conflict?.paths).toHaveLength(7)
  })

  it('lote do Jogo: só os campos do 409, e "Reaplicar" refaz o lote inteiro', () => {
    const { s } = setup()
    const r = s().commit(
      [blood(9, 8), { path: 'values.strength', from: 2, to: 3 }],
      'Ação'
    )
    if (!r.ok) throw new Error('não enfileirou')
    s().conflicted(r.batch.clientBatchId, { paths: ['values.blood'] })
    expect(s().conflict).toMatchObject({
      paths: ['values.blood'],
      origin: 'play',
    })
    expect(s().draft).toBeNull()
    // resolveConflict não vale no Jogo: a ação volta inteira ou não volta
    s().resolveConflict('values.blood', 'mine')
    expect(s().conflict).not.toBeNull()
    expect(s().reapply()).toMatchObject({ ok: true })
    expect(
      s()
        .pending.at(-1)
        ?.events.map(e => e.path)
    ).toEqual(['values.blood', 'values.strength'])
  })
})
