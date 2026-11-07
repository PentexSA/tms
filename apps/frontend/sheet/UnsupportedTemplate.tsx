import { Button, EmptyState } from '@tms/ui'
import Constants from 'expo-constants'
import { Linking, Platform } from 'react-native'
import { useBackTo } from '../lib/navigation'

// L-02: o template é mais novo que este app (compileSafe devolveu null). O
// motor recusa o que não conhece (falha segura); esta tela só dá a saída. No
// web, recarregar busca o bundle novo; no app, voltar ou abrir a loja. Nada
// aqui conhece sistema.

const STORE_HOSTS = new Set(['apps.apple.com', 'play.google.com'])

/**
 * O link da loja do app.json, só se for https de uma loja oficial. A URL vem
 * do build, nunca do servidor; mesmo assim, nada de outro esquema ou host.
 */
export function storeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && STORE_HOSTS.has(url.hostname)
      ? url.toString()
      : null
  } catch {
    return null
  }
}

/** O link da loja desta plataforma, quando o app.json tem um válido. */
function configuredStoreUrl(): string | null {
  const config = Constants.expoConfig
  if (Platform.OS === 'ios') return storeUrl(config?.ios?.appStoreUrl)
  if (Platform.OS === 'android') return storeUrl(config?.android?.playStoreUrl)
  return null
}

/** O texto curto, para a Mesa e para um painel dentro de outra tela. */
export function unsupportedShort(what: 'ficha' | 'regras'): string {
  const web = Platform.OS === 'web'
  if (what === 'ficha')
    return web
      ? 'Recarregue a página para ver esta ficha.'
      : 'Atualize o app para ver esta ficha.'
  return web
    ? 'As regras deste sistema são mais novas que esta página. Recarregue para ver.'
    : 'As regras deste sistema são mais novas que esta versão do app. Atualize o app para ver.'
}

export function UnsupportedTemplate({
  onBack,
}: {
  // No app, a saída da tela (padrão: voltar, ou a lista sem tela de baixo)
  readonly onBack?: () => void
}) {
  const backToList = useBackTo('/')
  if (Platform.OS === 'web')
    return (
      <EmptyState
        title="Recarregue a página"
        message="As regras deste sistema são mais novas que esta página. Recarregue para buscar a versão atual; se continuar, avise o narrador."
        actions={<ReloadButton />}
      />
    )
  const store = configuredStoreUrl()
  return (
    <EmptyState
      title="Atualize o app"
      message="As regras deste sistema são mais novas que esta versão do app. Atualize pela loja; se já estiver atualizado, avise o narrador."
      actions={
        <>
          <Button
            title="Voltar"
            variant={store ? 'secondary' : 'primary'}
            onPress={onBack ?? backToList}
          />
          {store ? (
            <Button
              title="Abrir a loja"
              onPress={() => {
                Linking.openURL(store).catch(() => undefined)
              }}
            />
          ) : null}
        </>
      }
    />
  )
}

// O tsconfig do app não carrega os tipos do DOM: só o que o botão usa
const page = globalThis as { location?: { reload(): void } }

/** "Recarregar" (só no web): busca a página e o bundle de novo. */
export function ReloadButton({
  variant = 'primary',
}: {
  readonly variant?: 'primary' | 'secondary'
}) {
  if (Platform.OS !== 'web') return null
  return (
    <Button
      title="Recarregar"
      variant={variant}
      onPress={() => page.location?.reload()}
    />
  )
}
