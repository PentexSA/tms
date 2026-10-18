import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Etapa 22 (OWASP MASVS-STORAGE e MASVS-NETWORK): a configuração nativa que
// protege o que fica no aparelho. Quebra se alguém desligar sem querer.

const config = JSON.parse(
  readFileSync(join(__dirname, '../../../app.json'), 'utf8')
) as {
  expo: {
    plugins: (string | [string, Record<string, unknown>])[]
    android: Record<string, unknown>
    ios: { infoPlist?: { NSAppTransportSecurity?: Record<string, unknown> } }
  }
}
const { expo } = config

it('o expo-sqlite é compilado com SQLCipher', () => {
  const sqlite = expo.plugins.find(
    p => Array.isArray(p) && p[0] === 'expo-sqlite'
  ) as [string, Record<string, unknown>] | undefined
  expect(sqlite?.[1]).toMatchObject({ useSQLCipher: true })
})

it('Android: fora do backup e sem tráfego em texto claro', () => {
  expect(expo.android.allowBackup).toBe(false)
  expect(expo.android.usesCleartextTraffic).not.toBe(true)
})

it('iOS: o ATS continua ligado (sem NSAllowsArbitraryLoads)', () => {
  expect(
    expo.ios.infoPlist?.NSAppTransportSecurity?.NSAllowsArbitraryLoads
  ).not.toBe(true)
})

it('o SecureStore guarda a chave do banco e o refresh token', () => {
  expect(expo.plugins).toContain('expo-secure-store')
})
