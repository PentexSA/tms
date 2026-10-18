import {
  AppBar,
  Avatar,
  Button,
  EmptyState,
  ListItem,
  Screen,
  SectionHeader,
  Skeleton,
  tokens,
} from '@tms/ui'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import { plural } from '../../lib/format'
import { useChronicles } from '../../lib/queries/chronicles'
import { useSession } from '../../lib/session/SessionProvider'

// Crônicas (design/telas/cronicas.html): as que eu narro e as de que participo.
export default function ChroniclesScreen() {
  const router = useRouter()
  const { session } = useSession()
  const chronicles = useChronicles()

  const actions = (
    <View style={styles.actions}>
      <Button
        title="Criar crônica"
        onPress={() => router.push('/chronicles/new')}
      />
      <Button
        title="Entrar com convite"
        variant="secondary"
        onPress={() => router.push('/join')}
      />
    </View>
  )

  let body: ReactNode
  if (chronicles.isPending) body = <Skeleton lines={4} />
  else if (chronicles.isError)
    body = (
      <EmptyState
        title="Não foi possível carregar suas crônicas"
        message={messageOf(chronicles.error)}
        actions={
          <Button title="Tentar de novo" onPress={() => chronicles.refetch()} />
        }
      />
    )
  else if (chronicles.data.length === 0)
    body = (
      <EmptyState
        title="Você ainda não participa de nenhuma crônica"
        message="Crie uma crônica para narrar ou entre com o convite que o narrador enviou."
        actions={actions}
      />
    )
  else
    body = (
      <FlatList
        data={chronicles.data}
        keyExtractor={c => c.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionHeader title="Suas crônicas" />
          </View>
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.name}
            subtitle={item.system.name}
            meta={`${
              item.role === 'storyteller'
                ? 'Você narra'
                : `Narrador: ${item.storyteller.username}`
            } · ${plural(item.characterCount, 'personagem', 'personagens')}`}
            leading={<Avatar name={item.name} />}
            onPress={() => router.push(`/chronicles/${item.id}`)}
          />
        )}
        ListFooterComponent={<View style={styles.footer}>{actions}</View>}
      />
    )

  return (
    <Screen>
      <AppBar
        title="Crônicas"
        actions={
          <Button
            title="Sair"
            variant="ghost"
            onPress={() => session.logout()}
          />
        }
      />
      {body}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[4],
  },
  footer: { padding: tokens.layout.gutter },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: tokens.space[3],
  },
})
