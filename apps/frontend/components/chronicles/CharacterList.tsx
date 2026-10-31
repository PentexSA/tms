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
import { useChronicleCharacters } from '../../lib/queries/chronicles'
import { useCompiled, useTemplate } from '../../sheet/data'

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
  const pending = !partial && row.status === 'pending'
  const who = pending
    ? `${owner} · ${narrating ? 'Aguarda sua revisão' : 'Aguarda aprovação'}`
    : owner
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
        meta={identity?.chip ? `${identity.chip} · ${who}` : who}
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

// O narrador vê todas as fichas; o jogador, só as dele (a API já filtra: a
// ficha de outro jogador nunca chega ao aparelho).
export function CharacterList({
  chronicleId,
  systemCode,
  narrating,
  canCreate = true,
}: {
  readonly chronicleId: string
  readonly systemCode: string
  readonly narrating: boolean
  // O ex-membro não cria ficha (a API dá 403)
  readonly canCreate?: boolean
}) {
  const router = useRouter()
  const characters = useChronicleCharacters(chronicleId)
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
