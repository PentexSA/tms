import { useQuery } from '@tanstack/react-query'
import { AppBar, Button, Screen, Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'

import { api, unwrap } from '../../lib/api'
import { useSession } from '../../lib/session/SessionProvider'

// Placeholder até a tela de Crônicas (doc/plano-v0.md, Etapa 11)
export default function HomeScreen() {
  const { user, session } = useSession()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async ({ signal }) =>
      unwrap(await api.health.get({ fetch: { signal } })),
  })

  return (
    <Screen>
      <AppBar
        title="TMS"
        actions={
          <Button
            title="Sair"
            variant="ghost"
            onPress={() => session.logout()}
          />
        }
      />
      <View style={styles.content}>
        <Text variant="title">{`Olá, ${user?.username ?? ''}`}</Text>
        <Text color="inkMuted">
          {health.isPending
            ? 'Verificando a API…'
            : health.isSuccess
              ? 'API online'
              : 'API indisponível'}
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: tokens.space[3], padding: tokens.layout.gutter },
})
