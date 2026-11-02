import type { SheetMode } from '@tms/sheet-core'
import { AppBar, Button, EmptyState, Screen } from '@tms/ui'
import {
  type ErrorBoundaryProps,
  useLocalSearchParams,
  useRouter,
} from 'expo-router'
import { useEffect, useState } from 'react'

import { SheetScreen } from '../../../sheet/SheetScreen'
import { ReloadButton } from '../../../sheet/UnsupportedTemplate'

export default function CharacterRoute() {
  const router = useRouter()
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>()
  // O parâmetro vem da URL: só "evolve" e "create" são aceitos (a ficha nova
  // abre no rascunho). Vale só na chegada: recarregar ou voltar abre no modo
  // de abertura da ficha (a montagem, se ainda em criação; T-05)
  const [initialMode] = useState<SheetMode | undefined>(
    mode === 'evolve' || mode === 'create' ? mode : undefined
  )
  useEffect(() => {
    if (mode) router.setParams?.({ mode: undefined })
  }, [mode, router])
  return <SheetScreen id={id} initialMode={initialMode} />
}

/**
 * L-03: um erro ao desenhar a ficha fica nesta rota, com "Tentar de novo",
 * em vez de derrubar o app (no web, tela em branco). Não mostra a mensagem
 * nem a pilha do erro: elas podem repetir valores da ficha. Não afirma que a
 * ficha foi criada: a rota também abre por link, com qualquer id.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const router = useRouter()
  return (
    <Screen>
      <AppBar
        title="Ficha"
        back={{
          label: 'Crônicas',
          onPress: () =>
            router.canGoBack?.() ? router.back() : router.replace('/'),
        }}
      />
      <EmptyState
        title="Não foi possível mostrar esta ficha"
        message="O que já foi salvo continua na crônica. Tente de novo; se o erro continuar, avise o narrador."
        actions={
          <>
            <Button title="Tentar de novo" onPress={() => void retry()} />
            <ReloadButton variant="secondary" />
          </>
        }
      />
    </Screen>
  )
}
