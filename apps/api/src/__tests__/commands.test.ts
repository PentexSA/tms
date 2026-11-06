/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { commandHash } from '../sheets/commands'

// O hash da intenção, num módulo só (fichas, NPC e revelação): o mesmo valor
// que as rotas gravavam antes, para as chaves já gravadas continuarem valendo.
describe('commandHash', () => {
  it('é o sha256 de { kind, request }, como antes', () => {
    const request = { characterId: 'c', section: 's', revealed: true }
    expect(commandHash('character.reveal', request)).toBe(
      createHash('sha256')
        .update(JSON.stringify({ kind: 'character.reveal', request }))
        .digest('hex')
    )
  })

  it('outro tipo ou outro pedido é outra intenção', () => {
    const a = commandHash('character.reveal', { revealed: true })
    expect(commandHash('character.visibility', { revealed: true })).not.toBe(a)
    expect(commandHash('character.reveal', { revealed: false })).not.toBe(a)
  })
})
