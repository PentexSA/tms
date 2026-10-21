import { identityOf, resolve, type SheetData } from '@tms/sheet-core'
import {
  Avatar,
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

interface Row {
  readonly id: string
  readonly name: string
  readonly mine: boolean
  readonly owner: { readonly username: string }
  readonly templateVersion: string
  readonly values: Record<string, unknown>
}

// Uma linha por ficha, com o selo e o resumo calculados pelo core a partir
// da prévia que a API manda (identidade e dock, sem campo restrito).
function CharacterRow({
  row,
  systemCode,
}: {
  readonly row: Row
  readonly systemCode: string
}) {
  const router = useRouter()
  const template = useTemplate(systemCode, row.templateVersion)
  const model = useCompiled(template.data)
  const identity = model
    ? identityOf(resolve(model, { values: row.values } as SheetData))
    : null
  const owner = row.mine ? 'Sua ficha' : `de ${row.owner.username}`
  return (
    <ThemeProvider accent={identity?.accent ?? 'accent-neutral'}>
      <ListItem
        title={row.name}
        subtitle={identity ? identity.summary : undefined}
        meta={identity?.chip ? `${identity.chip} · ${owner}` : owner}
        leading={<Avatar name={row.name} />}
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
}: {
  readonly chronicleId: string
  readonly systemCode: string
  readonly narrating: boolean
}) {
  const router = useRouter()
  const characters = useChronicleCharacters(chronicleId)
  const rows = (characters.data ?? []) as Row[]
  const shown = narrating ? rows : rows.filter(r => r.mine)
  const create = (
    <Button
      title="Nova ficha"
      variant="secondary"
      onPress={() => router.push(`/chronicles/${chronicleId}/new-character`)}
    />
  )
  return (
    <View>
      <View style={styles.header}>
        <SectionHeader
          title={narrating ? 'Fichas' : 'Suas fichas'}
          right={create}
        />
      </View>
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
          <CharacterRow key={row.id} row={row} systemCode={systemCode} />
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: tokens.layout.gutter },
  text: { paddingHorizontal: tokens.layout.gutter },
})
