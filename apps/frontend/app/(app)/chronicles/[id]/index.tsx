import {
  AppBar,
  Avatar,
  Button,
  EmptyState,
  ListItem,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
  tokens,
} from '@tms/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import { InviteSheet } from '../../../../components/chronicles/InviteSheet'
import { messageOf, statusOf } from '../../../../lib/errors'
import { useChronicle } from '../../../../lib/queries/chronicles'

export default function ChronicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const chronicle = useChronicle(id)
  const [inviting, setInviting] = useState(false)
  const back = { label: 'Crônicas', onPress: () => router.replace('/') }

  if (chronicle.isPending)
    return (
      <Screen>
        <AppBar title="Crônica" back={back} />
        <Skeleton lines={5} />
      </Screen>
    )
  if (chronicle.isError)
    return (
      <Screen>
        <AppBar title="Crônica" back={back} />
        {statusOf(chronicle.error) === 404 ? (
          <EmptyState
            title="Crônica não encontrada"
            message="Ela não existe ou você não participa dela."
          />
        ) : (
          <EmptyState
            title="Não foi possível carregar a crônica"
            message={messageOf(chronicle.error)}
            actions={
              <Button
                title="Tentar de novo"
                onPress={() => chronicle.refetch()}
              />
            }
          />
        )}
      </Screen>
    )

  const c = chronicle.data
  const narrating = c.role === 'storyteller'
  return (
    <Screen>
      <AppBar title={c.name} back={back} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.info}>
          <Text variant="caption" color="inkMuted">
            {c.system.name}
          </Text>
          <Text>
            {narrating
              ? 'Você narra esta crônica.'
              : `Narrador: ${c.storyteller.username}`}
          </Text>
        </View>

        <SectionHeader
          title="Mesa"
          right={
            narrating ? (
              <Button
                title="Convidar"
                variant="secondary"
                onPress={() => setInviting(true)}
              />
            ) : undefined
          }
        />
        <ListItem
          title={c.storyteller.username}
          subtitle="Narrador"
          leading={<Avatar name={c.storyteller.username} />}
        />
        {c.members.length === 0 ? (
          <Text color="inkMuted" style={styles.empty}>
            {narrating
              ? 'Ninguém entrou ainda. Convide os jogadores com um código.'
              : 'Você é o primeiro jogador.'}
          </Text>
        ) : (
          c.members.map(m => (
            <ListItem
              key={m.id}
              title={m.username}
              subtitle="Jogador"
              leading={<Avatar name={m.username} />}
            />
          ))
        )}
      </ScrollView>
      {narrating ? (
        <InviteSheet
          chronicleId={c.id}
          chronicleName={c.name}
          visible={inviting}
          onClose={() => setInviting(false)}
        />
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: tokens.space[2], paddingBottom: tokens.space[12] },
  info: { gap: tokens.space[1], padding: tokens.layout.gutter },
  empty: { paddingHorizontal: tokens.layout.gutter },
})
