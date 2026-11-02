import {
  completionBy,
  completionCopy,
  isStaleCompletion,
  unsavedBeforeCompleting,
} from '../completion'

// T-32: uma fonte só de texto para concluir e aprovar, escrita para quem lê

describe('completionCopy', () => {
  it('dono, aprovação ligada: envia para o narrador', () => {
    expect(
      completionCopy({ by: 'owner', approval: true, action: 'complete' })
    ).toEqual({
      title: 'Enviar para aprovação?',
      body: 'A ficha vai para o narrador aprovar e fica somente para leitura até lá.',
      confirm: 'Enviar para aprovação',
      done: 'Ficha enviada. Ela aguarda a aprovação do narrador.',
    })
  })

  it('dono, sem aprovação: entra em jogo, e subir passa pelo narrador', () => {
    expect(
      completionCopy({ by: 'owner', approval: false, action: 'complete' })
    ).toEqual({
      title: 'Concluir criação?',
      body: 'A ficha entra em jogo. Depois disso, subir um traço passa pelo narrador. Não dá para voltar à criação.',
      confirm: 'Concluir criação',
      done: 'Criação concluída. Subir um traço agora passa pelo narrador.',
    })
  })

  it('narrador conclui; com a aprovação ligada, conclui e aprova', () => {
    expect(
      completionCopy({ by: 'storyteller', approval: false, action: 'complete' })
    ).toEqual({
      title: 'Concluir criação?',
      body: 'A ficha entra em jogo. Depois disso, subir um traço passa por você. Não dá para voltar à criação.',
      confirm: 'Concluir criação',
      done: 'Criação concluída. Subir um traço agora passa por você.',
    })
    expect(
      completionCopy({ by: 'storyteller', approval: true, action: 'complete' })
    ).toMatchObject({
      title: 'Concluir e aprovar?',
      confirm: 'Concluir e aprovar',
    })
  })

  it('narrador aprova', () => {
    expect(
      completionCopy({ by: 'storyteller', approval: true, action: 'approve' })
    ).toEqual({
      title: 'Aprovar ficha?',
      body: 'A ficha entra em jogo. Depois disso, subir um traço passa por você. Não dá para voltar à criação.',
      confirm: 'Aprovar ficha',
      done: 'Ficha aprovada e liberada.',
    })
  })

  it('o narrador nunca lê "passa pelo narrador"; o dono, nunca "passa por você"', () => {
    for (const approval of [true, false])
      for (const action of ['complete', 'approve'] as const) {
        const st = completionCopy({ by: 'storyteller', approval, action })
        expect(JSON.stringify(st)).not.toContain('pelo narrador')
        const own = completionCopy({ by: 'owner', approval, action })
        expect(JSON.stringify(own)).not.toContain('por você')
      }
  })
})

describe('apoios da confirmação', () => {
  it('quem conclui vem dos papéis', () => {
    expect(completionBy(new Set(['storyteller']))).toBe('storyteller')
    expect(completionBy(new Set(['owner', 'storyteller']))).toBe('storyteller')
    expect(completionBy(new Set(['owner']))).toBe('owner')
  })

  it('o aviso das alterações não salvas concorda em número', () => {
    expect(unsavedBeforeCompleting(1)).toBe(
      'Você tem 1 alteração não salva nesta ficha. Salve ou descarte antes de concluir.'
    )
    expect(unsavedBeforeCompleting(3)).toBe(
      'Você tem 3 alterações não salvas nesta ficha. Salve ou descarte antes de concluir.'
    )
  })

  it('o 409 de revisão ou de versão é "a ficha mudou"; o resto não', () => {
    expect(isStaleCompletion({ code: 'CREATION_REVISION_CONFLICT' })).toBe(true)
    expect(isStaleCompletion({ code: 'SHEET_VERSION_CONFLICT' })).toBe(true)
    expect(isStaleCompletion({ code: 'CREATION_INCOMPLETE' })).toBe(false)
    expect(isStaleCompletion(null)).toBe(false)
  })
})
