import {
  AppBar,
  Avatar,
  Button,
  EmptyState,
  ListItem,
  Screen,
  SectionHeader,
  Skeleton,
  Tabs,
  Text,
  tokens,
} from '@tms/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import { CharacterList } from '../../../../components/chronicles/CharacterList'
import { DeleteChronicleSheet } from '../../../../components/chronicles/DeleteChronicleSheet'
import { InviteSheet } from '../../../../components/chronicles/InviteSheet'
import { TableView } from '../../../../components/chronicles/TableView'
import { messageOf, statusOf } from '../../../../lib/errors'
import { useChronicle } from '../../../../lib/queries/chronicles'

export default function ChronicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const chronicle = useChronicle(id)
  const [inviting, setInviting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [view, setView] = useState<'sheets' | 'table'>('sheets')
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
  // A Mesa é do narrador: para o jogador a aba nem aparece (e a API dá 404)
  const showing = narrating ? view : 'sheets'
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

        {narrating ? (
          <Tabs
            accessibilityLabel="Visão da crônica"
            items={[
              { id: 'sheets', label: 'Fichas' },
              { id: 'table', label: 'Mesa' },
            ]}
            selected={showing}
            onSelect={id => setView(id as typeof view)}
          />
        ) : null}

        {showing === 'table' ? (
          <TableView chronicleId={c.id} />
        ) : (
          <SheetsPanel
            chronicle={c}
            narrating={narrating}
            onInvite={() => setInviting(true)}
          />
        )}
        {narrating ? (
          <View style={styles.danger}>
            <Button
              title="Excluir crônica"
              variant="danger"
              accessibilityHint="Pede o nome da crônica para confirmar"
              onPress={() => setDeleting(true)}
            />
          </View>
        ) : null}
      </ScrollView>
      {narrating ? (
        <>
          <InviteSheet
            chronicleId={c.id}
            chronicleName={c.name}
            visible={inviting}
            onClose={() => setInviting(false)}
          />
          <DeleteChronicleSheet
            chronicleId={c.id}
            chronicleName={c.name}
            visible={deleting}
            onClose={() => setDeleting(false)}
          />
        </>
      ) : null}
    </Screen>
  )
}

interface ChronicleData {
  readonly id: string
  readonly system: { readonly code: string }
  readonly storyteller: { readonly username: string }
  readonly members: readonly {
    readonly id: string
    readonly username: string
  }[]
}

// Fichas da crônica e quem participa (com o convite, para o narrador)
function SheetsPanel({
  chronicle: c,
  narrating,
  onInvite,
}: {
  readonly chronicle: ChronicleData
  readonly narrating: boolean
  readonly onInvite: () => void
}) {
  return (
    <>
      <CharacterList chronicleId={c.id} systemCode={c.system.code} />

      <SectionHeader
        title="Participantes"
        right={
          narrating ? (
            <Button title="Convidar" variant="secondary" onPress={onInvite} />
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
    </>
  )
}

const styles = StyleSheet.create({
  content: { gap: tokens.space[2], paddingBottom: tokens.space[12] },
  info: { gap: tokens.space[1], padding: tokens.layout.gutter },
  empty: { paddingHorizontal: tokens.layout.gutter },
  danger: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[8],
    alignItems: 'flex-start',
  },
})
