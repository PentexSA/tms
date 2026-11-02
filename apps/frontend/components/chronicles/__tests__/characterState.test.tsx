import {
  type CharacterStateOptions,
  type CharacterStateRow,
  characterState,
} from '../characterState'

// P04-D (D-02, R-12): uma regra de estado para a lista, a Mesa, o menu do
// narrador e o selo sob o nome. A precedência é a da §3.4 do plano.

const player: CharacterStateOptions = { narrating: false }
const narrator: CharacterStateOptions = { narrating: true }

describe('characterState', () => {
  it.each<
    [string, CharacterStateRow, CharacterStateOptions, string | null, string?]
  >([
    [
      'NPC: o selo é o da visibilidade',
      { kind: 'npc', status: 'creating' },
      narrator,
      null,
    ],
    [
      'ajuste pedido vence a devolução e o aviso',
      { status: 'creating', adjust: true, returned: true, ready: true },
      player,
      'Aguardando ajuste',
      'attention',
    ],
    [
      'devolvida',
      { status: 'creating', returned: true, ready: true },
      narrator,
      'Devolvida',
      'attention',
    ],
    [
      'avisou, para o narrador',
      { status: 'creating', ready: true, creationMode: 'free' },
      narrator,
      'Avisou que terminou',
      'attention',
    ],
    [
      'avisou, para o jogador',
      { status: 'creating', ready: true, creationMode: 'free' },
      player,
      'Você avisou que terminou',
      'neutral',
    ],
    [
      'em criação por pontos',
      { status: 'creating', creationMode: 'points' },
      player,
      'Em criação · por pontos',
      'neutral',
    ],
    [
      'em criação livre',
      { status: 'creating', creationMode: 'free' },
      narrator,
      'Em criação · livre',
      'neutral',
    ],
    [
      'em criação sem o modo (app antigo, cache)',
      { status: 'creating' },
      player,
      'Em criação',
      'neutral',
    ],
    [
      'aguardando aprovação, para o narrador',
      { status: 'pending', creationMode: 'points' },
      narrator,
      'Aguardando aprovação',
      'attention',
    ],
    [
      'aguardando aprovação, para o jogador',
      { status: 'pending' },
      player,
      'Aguardando aprovação',
      'neutral',
    ],
    [
      'travada vence a data',
      { status: 'active', locked: true, activatedAt: '2026-11-01T12:00:00Z' },
      narrator,
      'Travada',
      'neutral',
    ],
    ['ativa sem data: nada', { status: 'active' }, player, null],
    [
      'arquivada',
      { status: 'archived', activatedAt: '2026-11-01T12:00:00Z' },
      player,
      'Arquivada',
      'neutral',
    ],
    [
      'fora de jogo, com o rótulo do template',
      { status: 'dead' },
      { narrating: true, deadLabel: 'Morto' },
      'Morto',
      'neutral',
    ],
    [
      'fora de jogo, sem template',
      { status: 'dead' },
      player,
      'Fora de jogo',
      'neutral',
    ],
    [
      'os marcadores só valem em creating',
      { status: 'pending', adjust: true, returned: true, ready: true },
      player,
      'Aguardando aprovação',
      'neutral',
    ],
    ['sem estado', {}, player, null],
    // O NPC fica sem estado de criação, mas mostra trava, arquivo e dead
    // (achado do /code-review)
    [
      'NPC em jogo: nada',
      { kind: 'npc', status: 'active', activatedAt: '2026-11-01T12:00:00Z' },
      narrator,
      null,
    ],
    [
      'NPC travado',
      { kind: 'npc', status: 'active', locked: true },
      narrator,
      'Travada',
      'neutral',
    ],
    [
      'NPC arquivado',
      { kind: 'npc', status: 'archived' },
      narrator,
      'Arquivada',
      'neutral',
    ],
    [
      'NPC fora de jogo',
      { kind: 'npc', status: 'dead' },
      { narrating: true, deadLabel: 'Morto' },
      'Morto',
      'neutral',
    ],
  ])('%s', (...[, row, options, label, tone]) => {
    // Com o resto, o Jest não passa o `done` na quinta posição das linhas
    // sem tom
    const state = characterState(row, options)
    expect(state?.label ?? null).toBe(label)
    if (tone) expect(state?.tone).toBe(tone)
  })

  it('"Concluída em dd/mm" no fuso de quem lê (o instante, não a data UTC)', () => {
    // 01/11 às 01:30 em UTC é 31/10 às 22:30 em São Paulo (UTC-3)
    const at = '2026-11-01T01:30:00Z'
    const state = characterState({ status: 'active', activatedAt: at }, player)
    const local = new Date(at)
    const expected = `${String(local.getDate()).padStart(2, '0')}/${String(local.getMonth() + 1).padStart(2, '0')}`
    expect(state).toEqual({
      id: 'completed',
      label: `Concluída em ${expected}`,
      tone: 'done',
    })
    // Com o fuso de São Paulo no CI, o dia é o 31/10
    if (local.getTimezoneOffset() === 180)
      expect(state?.label).toBe('Concluída em 31/10')
    // Também com Date (Eden converte datas)
    expect(
      characterState({ status: 'active', activatedAt: new Date(at) }, player)
        ?.label
    ).toBe(`Concluída em ${expected}`)
  })

  it('o gatilho do narrador não diz "Concluída em"', () => {
    expect(
      characterState(
        { status: 'active', activatedAt: '2026-11-01T12:00:00Z' },
        { narrating: true, completed: false }
      )
    ).toBeNull()
  })
})
