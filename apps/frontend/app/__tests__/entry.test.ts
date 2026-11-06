import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// P12, D-14: a leitura do convite tem de rodar antes do roteador (que poria
// o fragmento nos parâmetros) e antes do error tracking. Reordenar o
// index.ts quebra este teste.
it('o index.ts importa a leitura do convite antes do expo-router/entry', () => {
  const source = readFileSync(join(__dirname, '../../index.ts'), 'utf8')
  const imports = source
    .split('\n')
    .filter(line => line.startsWith('import '))
    .map(line => line.trim())
  expect(imports).toEqual([
    "import './lib/invite/capture'",
    "import 'expo-router/entry'",
  ])
})
