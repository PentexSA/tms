import { Banner, Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useOnline } from '../../lib/network'
import { useSyncStatus } from './SyncProvider'
import type { SyncStatus } from './sync'

// O estado da fila no header (doc/plano-v0.md, Etapa 20): salvo, salvando,
// offline · N pendentes, ou erro. Anunciado ao leitor de tela quando muda.

export type SyncState = 'saved' | 'saving' | 'offline' | 'error'

const pendentes = (n: number) => (n === 1 ? '1 pendente' : `${n} pendentes`)

export function describeSync(
  status: SyncStatus,
  online: boolean
): { readonly state: SyncState; readonly text: string } {
  if (!online || status.failure === 'network')
    return {
      state: 'offline',
      text: status.pending
        ? `Offline · ${pendentes(status.pending)}`
        : 'Offline',
    }
  if (status.failure === 'server' && status.pending)
    return { state: 'error', text: 'Erro ao salvar · tentando de novo' }
  if (status.pending) return { state: 'saving', text: 'Salvando…' }
  return { state: 'saved', text: 'Salvo' }
}

export function SyncIndicator() {
  const { colors } = useTheme()
  const { state, text } = describeSync(useSyncStatus(), useOnline())
  const dot = {
    saved: colors.success,
    saving: colors.inkMuted,
    offline: colors.action,
    error: colors.danger,
  }[state]
  return (
    <View
      accessible
      accessibilityLabel={`Sincronização: ${text}`}
      aria-live="polite"
      testID={`sync-${state}`}
      style={styles.row}
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text variant="caption" color="inkMuted">
        {text}
      </Text>
    </View>
  )
}

/** Sem rede: o que a pessoa faz continua valendo e sobe quando voltar. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <View style={styles.banner}>
      <Banner
        tone="info"
        title="Sem conexão"
        message="As alterações ficam guardadas neste aparelho e são enviadas quando a conexão voltar."
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[1],
    minHeight: 44,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  banner: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[2],
  },
})
