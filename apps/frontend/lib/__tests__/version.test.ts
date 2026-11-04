import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// O `pnpm release` sobe os dois juntos (scripts/release.sh). Divergir manda a
// versão errada no x-tms-client-version e nos logs da API.

const versionOf = (...path: string[]) =>
  JSON.parse(readFileSync(join(__dirname, '../..', ...path), 'utf8'))

it('o app.json tem a mesma versão do package.json da raiz', () => {
  const root = versionOf('../..', 'package.json').version
  expect(root).toMatch(/^\d+\.\d+\.\d+$/)
  expect(versionOf('app.json').expo.version).toBe(root)
})

it('a versão cabe no formato que a API aceita no header', () => {
  expect(versionOf('app.json').expo.version).toMatch(
    /^\d{1,4}\.\d{1,4}\.\d{1,4}$/
  )
})
