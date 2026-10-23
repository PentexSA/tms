import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { clone, type Json } from './fixtures'

// Template sintético da contabilização (doc/plano-v4.md, Etapa 2a), em
// design/templates/testes/acct-teste.json para a API e o app usarem o mesmo.
// Os números são de TESTE, escolhidos para exercitar o contrato; não são
// tabelas de V20, M20 ou W20, que só entram depois de conferidas no livro
// (Etapa 2b). Nunca é publicado.

const TEMPLATE = JSON.parse(
  readFileSync(
    join(
      import.meta.dir,
      '../../../../design/templates/testes/acct-teste.json'
    ),
    'utf8'
  )
) as Json

const ATTRIBUTES = [
  'str',
  'dex',
  'sta',
  'cha',
  'man',
  'app',
  'per',
  'int',
  'wit',
]
const ABILITIES = ['alert', 'brawl', 'lore', 'occult']

export const acct = (): Json => clone(TEMPLATE)
export const ACCT_ATTRIBUTES = ATTRIBUTES
export const ACCT_ABILITIES = ABILITIES
