import { useQueryClient } from '@tanstack/react-query'
import { identityOf, resolve, type SheetData } from '@tms/sheet-core'
import {
  Avatar,
  Banner,
  Button,
  ListItem,
  SectionHeader,
  Skeleton,
  Text,
  ThemeProvider,
  tokens,
} from '@tms/ui'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { messageOf } from '../../lib/errors'
import {
  chronicleKeys,
  useChronicleCharacters,
} from '../../lib/queries/chronicles'
import { useRefetchOnFocus } from '../../lib/queries/focus'
import {
  chronicleCreationSummary,
  summaryLine,
} from '../../sheet/creation/summary'
import { useCompiled, useLatestTemplate, useTemplate } from '../../sheet/data'
import { deadLabel } from '../../sheet/policy'
import type { ChronicleCreationInfo } from './CreationSettings'
import { characterState } from './characterState'

interface PublicIdentity {
  readonly name: string
  readonly chip: string
  readonly subtitle: string | null
  readonly portraitUrl: string | null
}

interface FullRow {
  readonly projection?: 'full'
  readonly id: string
  readonly name: string
  readonly mine: boolean
  readonly owner: { readonly username: string }
  readonly templateVersion: string
  readonly values: Record<string, unknown>
  readonly kind?: 'pc' | 'npc'
  readonly visibility?: 'hidden' | 'identity' | 'full'
  readonly identity?: PublicIdentity
  // creating, pending (aguarda o narrador), active...
  readonly status?: string
  // O estado da criação (T-06, P04-D): o modo e os marcadores, sem o motivo
  readonly creationMode?: 'free' | 'points' | null
  readonly returned?: boolean
  readonly adjust?: boolean
  readonly ready?: boolean
  readonly activatedAt?: string | Date | null
}

interface IdentityRow {
  readonly projection: 'identity'
  readonly id: string
  readonly kind: 'npc'
  readonly visibility: 'identity' | 'full'
  readonly identity: PublicIdentity
}

type Row = FullRow | IdentityRow

// Uma linha por ficha, com o selo e o resumo calculados pelo core a partir
// da prévia que a API manda (identidade e dock, sem campo restrito).
function CharacterRow({
  row,
  systemCode,
  narrating,
}: {
  readonly row: Row
  readonly systemCode: string
  readonly narrating: boolean
}) {
  const router = useRouter()
  const partial = row.projection === 'identity'
  const template = useTemplate(
    systemCode,
    partial ? undefined : row.templateVersion
  )
  const model = useCompiled(template.data)
  const identity = partial
    ? row.identity
    : (row.identity ??
      (model
        ? identityOf(resolve(model, { values: row.values } as SheetData))
        : null))
  const owner = partial
    ? 'NPC revelado'
    : row.mine
      ? 'Sua ficha'
      : `de ${row.owner.username}`
  const name = partial ? row.identity.name : row.name
  // O estado vai no selo, sob o meta, e entra no nome acessível (D-02)
  const state = partial
    ? null
    : characterState(row, {
        narrating,
        deadLabel: model ? deadLabel(model) : undefined,
      })
  return (
    <ThemeProvider
      accent={
        identity && 'accent' in identity ? identity.accent : 'accent-neutral'
      }
    >
      <ListItem
        title={name}
        subtitle={
          identity
            ? 'summary' in identity
              ? identity.summary
              : (identity.subtitle ?? undefined)
            : undefined
        }
        meta={identity?.chip ? `${identity.chip} · ${owner}` : owner}
        badges={
          state
            ? [
                {
                  label: state.label,
                  tone: state.tone,
                  testID: `character-state-${row.id}`,
                },
              ]
            : undefined
        }
        leading={
          <Avatar
            name={name}
            imageUrl={
              identity && 'portraitUrl' in identity
                ? identity.portraitUrl
                : undefined
            }
          />
        }
        onPress={() => router.push(`/characters/${row.id}`)}
      />
    </ThemeProvider>
  )
}

/** "Criação por pontos · Atributos 7/5/3 · … · 15 de bônus · …". */
function CreationLine({
  systemCode,
  creation,
}: {
  readonly systemCode: string
  readonly creation: ChronicleCreationInfo
}) {
  const latest = useLatestTemplate(systemCode)
  const model = useCompiled(latest.data)
  // L-01: sem as regras do sistema, nada de "criação livre"
  if (!model) return null
  return (
    <Text variant="caption" color="inkMuted" testID="creation-summary">
      {summaryLine(chronicleCreationSummary(model, creation))}
    </Text>
  )
}

// O narrador vê todas as fichas; o jogador, só as dele (a API já filtra: a
// ficha de outro jogador nunca chega ao aparelho).
export function CharacterList({
  chronicleId,
  systemCode,
  narrating,
  canCreate = true,
  creation,
}: {
  readonly chronicleId: string
  readonly systemCode: string
  readonly narrating: boolean
  // O ex-membro não cria ficha (a API dá 403)
  readonly canCreate?: boolean
  // As regras da criação da crônica: o jogador vê o modo e o orçamento (T-29)
  readonly creation?: ChronicleCreationInfo
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const characters = useChronicleCharacters(chronicleId)
  // Voltar à crônica rebusca: a ficha devolvida ou aprovada noutro aparelho
  // aparece sem esperar o cache vencer (T-06)
  useRefetchOnFocus(() =>
    queryClient.invalidateQueries(
      { queryKey: chronicleKeys.characters(chronicleId) },
      { cancelRefetch: false }
    )
  )
  const rows = (characters.data ?? []) as Row[]
  const pcs = rows.filter(
    (row): row is FullRow =>
      row.projection !== 'identity' && (row.kind ?? 'pc') === 'pc'
  )
  const npcs = rows.filter(row =>
    row.projection === 'identity' ? true : row.kind === 'npc'
  )
  const shown = narrating ? pcs : pcs.filter(r => r.mine)
  // A ficha enviada para aprovação espera o narrador: o aviso fica no topo
  const review = narrating ? shown.filter(r => r.status === 'pending') : []
  // Na criação livre, o jogador avisou que terminou (D-03): o narrador
  // conclui ou pede ajuste
  const told = narrating
    ? shown.filter(r => r.status === 'creating' && r.ready === true && !r.mine)
    : []
  const create = (
    <Button
      title="Nova ficha"
      variant="secondary"
      onPress={() => router.push(`/chronicles/${chronicleId}/new-character`)}
    />
  )
  const createNpc = (
    <Button
      title="Criar NPC"
      variant="secondary"
      accessibilityHint="Cria um personagem do narrador, oculto por padrão"
      onPress={() =>
        router.push(`/chronicles/${chronicleId}/new-character?kind=npc`)
      }
    />
  )
  return (
    <View>
      <View style={styles.header}>
        <SectionHeader
          title={narrating ? 'Fichas' : 'Suas fichas'}
          right={canCreate ? create : undefined}
        />
        {/* O narrador vê o painel inteiro; o jogador, a linha (T-29) */}
        {!narrating && canCreate && creation ? (
          <CreationLine systemCode={systemCode} creation={creation} />
        ) : null}
      </View>
      {review.length ? (
        <View style={styles.header} testID="review-pending">
          <Banner
            tone="warning"
            title={
              review.length === 1
                ? '1 ficha aguarda sua revisão'
                : `${review.length} fichas aguardam sua revisão`
            }
            message={`${review.map(r => r.name).join(', ')}: abra a ficha para aprovar ou devolver para correção.`}
          />
        </View>
      ) : null}
      {told.length ? (
        <View style={styles.header} testID="ready-review">
          <Banner
            tone="warning"
            title={
              told.length === 1
                ? '1 jogador avisou que terminou'
                : `${told.length} jogadores avisaram que terminaram`
            }
            message={`${told.map(r => r.name).join(', ')}: abra a ficha para concluir a criação ou pedir ajuste.`}
          />
        </View>
      ) : null}
      {characters.isPending ? (
        <Skeleton lines={2} label="Carregando as fichas" />
      ) : characters.isError ? (
        <Text color="danger" style={styles.text}>
          {messageOf(characters.error)}
        </Text>
      ) : shown.length === 0 ? (
        <Text color="inkMuted" style={styles.text}>
          {narrating
            ? 'Nenhuma ficha ainda.'
            : 'Você ainda não tem ficha nesta crônica.'}
        </Text>
      ) : (
        shown.map(row => (
          <CharacterRow
            key={row.id}
            row={row}
            systemCode={systemCode}
            narrating={narrating}
          />
        ))
      )}
      {(narrating || npcs.length > 0) && (
        <>
          <View style={styles.header}>
            <SectionHeader
              title="NPCs"
              right={narrating ? createNpc : undefined}
            />
          </View>
          {npcs.length === 0 ? (
            <Text color="inkMuted" style={styles.text}>
              Nenhum NPC ainda.
            </Text>
          ) : (
            npcs.map(row => (
              <CharacterRow
                key={row.id}
                row={row}
                systemCode={systemCode}
                narrating={narrating}
              />
            ))
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: tokens.layout.gutter },
  text: { paddingHorizontal: tokens.layout.gutter },
})
