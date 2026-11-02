import { useQueryClient } from '@tanstack/react-query'
import {
  AppBar,
  Avatar,
  Banner,
  Button,
  EmptyState,
  ListItem,
  Screen,
  SectionHeader,
  Skeleton,
  TabPanel,
  Tabs,
  Text,
  tokens,
} from '@tms/ui'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native'
import { CampaignBackstage } from '../../../../components/chronicles/CampaignBackstage'
import { CharacterList } from '../../../../components/chronicles/CharacterList'
import {
  type ChronicleCreationInfo,
  CreationSettings,
} from '../../../../components/chronicles/CreationSettings'
import { DeleteChronicleSheet } from '../../../../components/chronicles/DeleteChronicleSheet'
import { InviteSheet } from '../../../../components/chronicles/InviteSheet'
import {
  LeaveChronicleSheet,
  RemoveMemberSheet,
} from '../../../../components/chronicles/MemberSheets'
import {
  TableActionBar,
  TableSelectionProvider,
} from '../../../../components/chronicles/TableSelection'
import { TableView } from '../../../../components/chronicles/TableView'
import { TransferOffer } from '../../../../components/chronicles/TransferOffer'
import { rememberScroll, scrollOf } from '../../../../lib/chronicleScroll'
import { messageOf, statusOf } from '../../../../lib/errors'
import { shortDate } from '../../../../lib/format'
import { useTransfer } from '../../../../lib/queries/backstage'
import {
  chronicleKeys,
  useChronicle,
  useChronicleCharacters,
} from '../../../../lib/queries/chronicles'
import {
  usePullRefresh,
  useRefetchOnFocus,
} from '../../../../lib/queries/focus'
import { xpKeys } from '../../../../lib/queries/xp'

export type ChronicleView = 'sheets' | 'table' | 'backstage'

/**
 * A aba da crônica que a URL pede (T-39): `?view=table|backstage`; "Fichas" é
 * o padrão, sem parâmetro. Valor desconhecido vira "Fichas", e o jogador com
 * `?view=table` também (fail secure: a aba nem existe para ele, e a API dá
 * 404 na Mesa).
 */
export function viewOf(param: unknown, narrating: boolean): ChronicleView {
  if (param === 'table') return narrating ? 'table' : 'sheets'
  if (param === 'backstage') return 'backstage'
  return 'sheets'
}

export default function ChronicleScreen() {
  const params = useLocalSearchParams<{ id: string; view?: string }>()
  const { id } = params
  const router = useRouter()
  const queryClient = useQueryClient()
  const chronicle = useChronicle(id)
  // T-40: o foco e o puxar rebuscam a crônica e o que a aba aberta mostra
  // (só as queries montadas; nada duplica o que já está em voo). Sem
  // intervalo novo
  const refreshChronicle = () =>
    queryClient.invalidateQueries(
      { queryKey: chronicleKeys.one(id) },
      { cancelRefetch: false }
    )
  useRefetchOnFocus(refreshChronicle)
  const pull = usePullRefresh(refreshChronicle, () =>
    queryClient.invalidateQueries(
      { queryKey: xpKeys.table(id) },
      { cancelRefetch: false }
    )
  )
  // U-03: a proposta de narrar, para o jogador, no topo da crônica. A mesma
  // consulta do Diário (mesma chave, nenhuma requisição a mais)
  const transfer = useTransfer(id, chronicle.data?.role === 'player')
  const [inviting, setInviting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // A aba vem da URL (link direto, F5 no web, voltar do navegador) e muda na
  // hora pelo toque; a URL acompanha pelo setParams
  const [view, setView] = useState<string | undefined>(params.view)
  useEffect(() => {
    setView(params.view)
  }, [params.view])
  const selectView = (next: ChronicleView) => {
    setView(next)
    router.setParams({ view: next === 'sheets' ? undefined : next })
  }
  // A rolagem de cada aba, em memória: volta ao mesmo ponto ao voltar de
  // uma ficha (no web, mesmo se a tela foi desmontada)
  const scrollRef = useRef<ScrollViewInstance>(null)
  // A aba mostrada (a mesma chave da gravação): atualizada a cada render,
  // depois que a crônica carrega. A volta é pedida no foco e feita quando a
  // rolagem existe e o conteúdo já cabe o ponto guardado mais a tela
  const scrollKey = useRef<ChronicleView>('sheets')
  const restoring = useRef(false)
  const viewport = useRef(0)
  const content = useRef(0)
  const restore = useCallback(() => {
    if (!restoring.current || !scrollRef.current) return
    const y = scrollOf(id, scrollKey.current)
    if (!y) {
      restoring.current = false
      return
    }
    if (content.current - viewport.current < y) return
    restoring.current = false
    scrollRef.current.scrollTo({ y, animated: false })
  }, [id])
  useFocusEffect(
    useCallback(() => {
      restoring.current = true
      restore()
    }, [restore])
  )
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
  // Ex-membro (v3, Etapa 7): só as fichas dele, em Leitura; sem Nova ficha,
  // Mesa, convites nem membros
  const former = c.role === 'former'
  // A Mesa é do narrador: para o jogador a aba nem aparece (e a API dá 404)
  const showing: ChronicleView = former ? 'sheets' : viewOf(view, narrating)
  scrollKey.current = showing
  return (
    <Screen>
      <AppBar title={c.name} back={back} />
      {/* A seleção da Mesa vive aqui (T-49): a barra fica fora da rolagem */}
      <TableSelectionProvider>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          testID="chronicle-scroll"
          refreshControl={
            <RefreshControl
              refreshing={pull.refreshing}
              onRefresh={pull.onRefresh}
            />
          }
          scrollEventThrottle={64}
          onScroll={e => {
            // Quem rola antes de o conteúdo chegar decide (dedo, roda,
            // teclado ou barra): nada de pular depois
            restoring.current = false
            rememberScroll(id, showing, e.nativeEvent.contentOffset.y)
          }}
          onLayout={e => {
            viewport.current = e.nativeEvent.layout.height
            restore()
          }}
          // O conteúdo cresceu até a rolagem guardada: volta a ela uma vez
          onContentSizeChange={(_, height) => {
            content.current = height
            restore()
          }}
        >
          {former ? (
            <Banner
              title="Você saiu"
              message="Suas fichas desta crônica são só leitura. Para voltar, peça um convite ao narrador."
              testID="former-banner"
            />
          ) : null}
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

          {c.role === 'player' && transfer.data?.available ? (
            <View style={styles.info}>
              <TransferOffer chronicleId={c.id} transferId={transfer.data.id} />
            </View>
          ) : null}

          {narrating && c.creation ? (
            <CreationSettings
              chronicleId={c.id}
              systemCode={c.system.code}
              creation={c.creation}
            />
          ) : null}

          {!former ? (
            <Tabs
              id="chronicle-view"
              accessibilityLabel="Visão da crônica"
              items={
                narrating
                  ? [
                      { id: 'sheets', label: 'Fichas' },
                      { id: 'table', label: 'Mesa' },
                      { id: 'backstage', label: 'Bastidores' },
                    ]
                  : [
                      { id: 'sheets', label: 'Fichas' },
                      { id: 'backstage', label: 'Diário' },
                    ]
              }
              selected={showing}
              onSelect={next => selectView(next as ChronicleView)}
            />
          ) : null}

          {/* O ex-membro não tem as abas: sem tablist, nada de tabpanel (o
            aria-labelledby ficaria apontando para uma aba que não existe) */}
          {former ? (
            <SheetsPanel
              chronicle={c}
              narrating={narrating}
              former={former}
              onInvite={() => setInviting(true)}
            />
          ) : (
            <TabPanel tabsId="chronicle-view" tab={showing}>
              {showing === 'table' ? (
                <TableView chronicleId={c.id} />
              ) : showing === 'backstage' ? (
                <CampaignBackstage chronicle={c} narrating={narrating} />
              ) : (
                <SheetsPanel
                  chronicle={c}
                  narrating={narrating}
                  former={former}
                  onInvite={() => setInviting(true)}
                />
              )}
            </TabPanel>
          )}
          {c.role === 'player' ? (
            <View style={styles.danger}>
              <Button
                title="Sair da crônica"
                variant="danger"
                accessibilityHint="Suas fichas ficam arquivadas, só leitura"
                onPress={() => setLeaving(true)}
              />
            </View>
          ) : null}
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
        {narrating && showing === 'table' ? (
          <TableActionBar chronicleId={c.id} />
        ) : null}
      </TableSelectionProvider>
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
      {leaving ? (
        <LeaveChronicleSheet
          chronicleId={c.id}
          chronicleName={c.name}
          onClose={() => setLeaving(false)}
        />
      ) : null}
    </Screen>
  )
}

interface ChronicleData {
  readonly id: string
  readonly system: { readonly code: string }
  readonly storyteller: { readonly username: string }
  // As regras da criação (o ex-membro não recebe)
  readonly creation?: ChronicleCreationInfo
  readonly members: readonly {
    readonly id: string
    readonly username: string
    readonly joinedAt?: string | Date
  }[]
}

// Fichas da crônica e quem participa (com o convite, para o narrador)
function SheetsPanel({
  chronicle: c,
  narrating,
  former,
  onInvite,
}: {
  readonly chronicle: ChronicleData
  readonly narrating: boolean
  readonly former: boolean
  readonly onInvite: () => void
}) {
  const [removing, setRemoving] = useState<ChronicleData['members'][number]>()
  // As fichas de cada membro, na lista do narrador (a API manda todas a ele)
  const characters = useChronicleCharacters(c.id)
  const sheetsOf = (userId: string) =>
    (characters.data ?? []).flatMap(ch =>
      'owner' in ch && ch.owner?.id === userId && 'name' in ch ? [ch.name] : []
    )
  if (former)
    return (
      <CharacterList
        chronicleId={c.id}
        systemCode={c.system.code}
        narrating={false}
        canCreate={false}
      />
    )
  return (
    <>
      <CharacterList
        chronicleId={c.id}
        systemCode={c.system.code}
        narrating={narrating}
        creation={c.creation}
      />

      {/* O título e o "Convidar" com a margem da página (T-67) */}
      <View style={styles.header} testID="members-header">
        <SectionHeader
          title="Participantes"
          right={
            narrating ? (
              <Button title="Convidar" variant="secondary" onPress={onInvite} />
            ) : undefined
          }
        />
      </View>
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
        c.members.map(m => {
          const sheets = narrating ? sheetsOf(m.id) : []
          return (
            <ListItem
              key={m.id}
              title={m.username}
              subtitle={
                narrating && m.joinedAt
                  ? `Jogador · entrou em ${shortDate(m.joinedAt)}`
                  : 'Jogador'
              }
              meta={sheets.length ? sheets.join(', ') : undefined}
              leading={<Avatar name={m.username} />}
              trailing={
                narrating ? (
                  <Button
                    title="Remover"
                    variant="ghost"
                    accessibilityHint={`Tira ${m.username} da crônica`}
                    testID={`remove-${m.id}`}
                    onPress={() => setRemoving(m)}
                  />
                ) : undefined
              }
            />
          )
        })
      )}
      {removing ? (
        <RemoveMemberSheet
          chronicleId={c.id}
          member={removing}
          onClose={() => setRemoving(undefined)}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  content: { gap: tokens.space[2], paddingBottom: tokens.space[12] },
  info: { gap: tokens.space[1], padding: tokens.layout.gutter },
  empty: { paddingHorizontal: tokens.layout.gutter },
  header: { paddingHorizontal: tokens.layout.gutter },
  danger: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[8],
    alignItems: 'flex-start',
  },
})
