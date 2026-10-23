import {
  Button,
  Chip,
  ListItem,
  SectionHeader,
  Stepper,
  Text,
  TextField,
  tokens,
} from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf, statusOf } from '../../lib/errors'
import {
  useChronicle,
  useChronicleCharacters,
} from '../../lib/queries/chronicles'
import { useFreeRoll, useRollFeed } from '../../lib/queries/rolls'
import { useCompiled, useLatestTemplate } from '../../sheet/data'

export function RollFeed({ chronicleId }: { readonly chronicleId: string }) {
  const chronicle = useChronicle(chronicleId)
  const characters = useChronicleCharacters(chronicleId)
  const template = useLatestTemplate(chronicle.data?.system.code)
  const model = useCompiled(template.data)
  const [visibility, setVisibility] = useState<'all' | 'hidden' | 'visible'>(
    'all'
  )
  const [characterId, setCharacterId] = useState<string | null>(null)
  const feed = useRollFeed(chronicleId, {
    ...(characterId ? { characterId } : {}),
    ...(visibility === 'hidden'
      ? { hidden: 'true' as const }
      : visibility === 'visible'
        ? { hidden: 'false' as const }
        : {}),
  })
  const free = useFreeRoll(chronicleId)
  const [label, setLabel] = useState('Parada livre')
  const [dice, setDice] = useState(1)
  const [difficulty, setDifficulty] = useState(6)
  const [specialty, setSpecialty] = useState(false)
  const [hidden, setHidden] = useState(true)
  const key = useRef<string | null>(null)
  const roll = model?.roll.model === 'pool-success' ? model.roll : null
  const items = feed.data?.pages.flatMap(page => page.items) ?? []

  useEffect(() => {
    if (roll) setDifficulty(roll.difficulty.default)
  }, [roll])

  const change =
    <T,>(write: (value: T) => void) =>
    (value: T) => {
      key.current = null
      write(value)
    }

  const submit = () => {
    if (!roll || free.isPending) return
    const command = (key.current ??= randomUUID())
    free.mutate(
      { clientRollId: command, dice, difficulty, specialty, label, hidden },
      {
        onSuccess: () => {
          key.current = null
        },
        onError: error => {
          // Resposta definitiva: uma nova edição pode usar outra intenção.
          // Falha de rede conserva a chave para o botão de reenvio.
          if (statusOf(error)) key.current = null
        },
      }
    )
  }

  return (
    <View style={styles.root}>
      <SectionHeader title="Rolagens da mesa" />
      {roll ? (
        <View style={styles.form}>
          <TextField
            label="Rótulo"
            value={label}
            maxLength={120}
            onChangeText={change(setLabel)}
          />
          <View style={styles.steppers}>
            <Stepper
              label="Dados"
              value={dice}
              min={1}
              max={50}
              onChange={change(setDice)}
            />
            <Stepper
              label="Dificuldade"
              value={difficulty}
              min={roll.difficulty.min}
              max={roll.difficulty.max}
              onChange={change(setDifficulty)}
            />
          </View>
          <View style={styles.chips}>
            {roll.specialty === 'tenCountsDouble' ? (
              <Chip
                label="Especialização"
                selected={specialty}
                onPress={() => {
                  key.current = null
                  setSpecialty(value => !value)
                }}
              />
            ) : null}
            <Chip
              label="Oculta"
              selected={hidden}
              onPress={() => {
                key.current = null
                setHidden(value => !value)
              }}
            />
          </View>
          <Button
            title={key.current ? 'Reenviar a mesma rolagem' : 'Rolar'}
            busy={free.isPending}
            disabled={!label.trim()}
            onPress={submit}
          />
          {free.isError ? (
            <Text color="danger">{messageOf(free.error)}</Text>
          ) : null}
        </View>
      ) : model ? (
        <Text color="inkMuted" style={styles.inset}>
          Este sistema ainda não oferece parada livre.
        </Text>
      ) : null}

      <View style={styles.form}>
        <Text variant="fieldLabel">Filtrar feed</Text>
        <View style={styles.chips}>
          {(
            [
              ['all', 'Todas'],
              ['hidden', 'Ocultas'],
              ['visible', 'Visíveis'],
            ] as const
          ).map(([id, title]) => (
            <Chip
              key={id}
              label={title}
              selected={visibility === id}
              onPress={() => setVisibility(id)}
            />
          ))}
        </View>
        <View style={styles.chips}>
          <Chip
            label="Todas as origens"
            selected={characterId === null}
            onPress={() => setCharacterId(null)}
          />
          {characters.data?.map(character => (
            <Chip
              key={character.id}
              label={
                character.projection === 'identity'
                  ? character.identity.name
                  : character.name
              }
              selected={characterId === character.id}
              onPress={() => setCharacterId(character.id)}
            />
          ))}
        </View>
        {feed.dataUpdatedAt ? (
          <Text variant="caption" color="inkMuted">
            Atualizado às {new Date(feed.dataUpdatedAt).toLocaleTimeString()}
          </Text>
        ) : null}
      </View>

      {feed.isError ? (
        <Text color="danger" style={styles.inset}>
          {messageOf(feed.error)}
        </Text>
      ) : items.length ? (
        items.map(item => (
          <ListItem
            key={item.id}
            title={item.label}
            subtitle={`${item.text} · ${item.dice}d${item.die} · dificuldade ${item.difficulty}`}
            meta={`${item.hidden ? 'Oculta' : 'Visível'} · ${item.origin.kind === 'character' ? (item.origin.character.name ?? 'Ficha') : 'Parada livre'}`}
          />
        ))
      ) : (
        <Text color="inkMuted" style={styles.inset}>
          Nenhuma rolagem registrada nesta crônica.
        </Text>
      )}
      {feed.hasNextPage ? (
        <View style={styles.form}>
          <Button
            title="Carregar rolagens anteriores"
            variant="secondary"
            busy={feed.isFetchingNextPage}
            onPress={() => feed.fetchNextPage()}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.space[2], paddingVertical: tokens.space[3] },
  form: {
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    paddingBottom: tokens.space[2],
  },
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[4] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  inset: { paddingHorizontal: tokens.layout.gutter },
})
