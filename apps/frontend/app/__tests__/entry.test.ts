import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// P12, D-14: a leitura do convite tem de rodar antes do roteador (que poria
// o fragmento nos parâmetros) e antes do error tracking. Reordenar o
// index.ts quebra este teste. O filtro dos avisos de dev (lib/devLogs.ts)
// vem depois do convite e antes do roteador: o LogBox só filtra o que chega
// depois do ignoreLogs.
it('o index.ts importa a leitura do convite, o filtro de avisos e o expo-router/entry, nesta ordem', () => {
  const source = readFileSync(join(__dirname, '../../index.ts'), 'utf8')
  const imports = source
    .split('\n')
    .filter(line => line.startsWith('import '))
    .map(line => line.trim())
  expect(imports).toEqual([
    "import './lib/invite/capture'",
    "import './lib/devLogs'",
    "import 'expo-router/entry'",
  ])
})
