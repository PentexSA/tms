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

import { TransferOffer } from '../../components/chronicles/TransferOffer'
import { LogoutButton } from '../../components/session/LogoutButton'
import { messageOf } from '../../lib/errors'
import { civilDate, plural } from '../../lib/format'
import { useChronicles } from '../../lib/queries/chronicles'
import { usePullRefresh, useRefetchOnFocus } from '../../lib/queries/focus'

/**
 * "Narrador: ana · 2 personagens · Última sessão: 01/11 · Convite para
 * narrar". A última sessão é data civil (U-04); a proposta, só para quem a
 * recebeu (U-03). Para o narrador, "2 fichas em criação" (a vez do jogador,
 * P09-D) antes de "1 ficha aguarda revisão" (a vez dele): as duas contagens
 * não se sobrepõem, e só ele as recebe.
 */
function chronicleMeta(item: {
  readonly role: 'storyteller' | 'player' | 'former'
  readonly storyteller: { readonly username: string }
  readonly characterCount: number
  readonly pendingReview: number
  // Ausente na API antiga: vale como 0
  readonly creatingCount?: number
  readonly lastSession?: string | null
  readonly transferOffer?: unknown
}) {
  const last = item.lastSession
    ? civilDate(item.lastSession, { year: false })
    : null
  return [
    item.role === 'storyteller'
      ? 'Você narra'
      : item.role === 'former'
        ? 'Você saiu'
        : `Narrador: ${item.storyteller.username}`,
    plural(item.characterCount, 'personagem', 'personagens'),
    item.role === 'storyteller' && item.creatingCount
      ? `${plural(item.creatingCount, 'ficha', 'fichas')} em criação`
      : null,
    item.pendingReview
      ? `${plural(item.pendingReview, 'ficha aguarda', 'fichas aguardam')} revisão`
      : null,
    last ? `Última sessão: ${last}` : null,
    item.transferOffer ? 'Convite para narrar' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

// Crônicas (design/telas/cronicas.html): as que eu narro e as de que participo.
export default function ChroniclesScreen() {
  const router = useRouter()
  const chronicles = useChronicles()
  // T-40: a volta à lista e o puxar trazem a contagem e o "aguarda revisão"
  // atuais (no Android, a lista ficava com o dado de antes)
  useRefetchOnFocus(() => chronicles.refetch({ cancelRefetch: false }))
  const pull = usePullRefresh(() => chronicles.refetch())

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
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* U-03: a proposta de narrar, para quem a recebeu */}
            {chronicles.data.map(item =>
              item.transferOffer ? (
                <TransferOffer
                  key={item.transferOffer.id}
                  chronicleId={item.id}
                  transferId={item.transferOffer.id}
                  chronicleName={item.name}
                />
              ) : null
            )}
            <SectionHeader title="Suas crônicas" />
          </View>
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.name}
            subtitle={item.system.name}
            meta={chronicleMeta(item)}
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
          <View style={styles.bar}>
            <Button
              title="Conta"
              variant="ghost"
              onPress={() => router.push('/account')}
            />
            <LogoutButton />
          </View>
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
    gap: tokens.space[3],
  },
  footer: { padding: tokens.layout.gutter },
  bar: { flexDirection: 'row', gap: tokens.space[1] },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: tokens.space[3],
  },
})
