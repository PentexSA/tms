import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// T-09 (P06): o app é só em português. Sem a localização no Info.plist, o
// React Native monta "radio button, unchecked" em inglês (RCTLocalizedString
// segue a localização do bundle, e o prebuild deixa `en`). Com pt-BR, sai do
// pt.lproj do React Native: "botão de opção, não marcado". A prova no
// VoiceOver é no build nativo; aqui só a configuração.

const { expo } = JSON.parse(
  readFileSync(join(__dirname, '../app.json'), 'utf8')
) as {
  expo: { ios: { infoPlist?: Record<string, unknown> } }
}

it('iOS: região de desenvolvimento em pt-BR', () => {
  expect(expo.ios.infoPlist?.CFBundleDevelopmentRegion).toBe('pt-BR')
})

it('iOS: o bundle declara a localização pt-BR', () => {
  expect(expo.ios.infoPlist?.CFBundleLocalizations).toContain('pt-BR')
})
