import {
  Button,
  Chip,
  ListItem,
  SectionHeader,
  Text,
  TextArea,
  TextField,
  tokens,
} from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import {
  useAcceptTransfer,
  useCancelTransfer,
  useChronicleHistory,
  useCreateSession,
  useProposeTransfer,
  useRejectTransfer,
  useSessions,
  useTransfer,
  useUpdateChronicle,
  useUpdateSession,
} from '../../lib/queries/backstage'
import { useChronicleCharacters } from '../../lib/queries/chronicles'

interface ChronicleInfo {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly imageUrl?: string | null
  readonly settingsRevision?: number
  readonly options?: Record<string, boolean | number | string>
  readonly optionCatalog?: readonly ChronicleOption[]
  readonly members: readonly {
    readonly id: string
    readonly username: string
  }[]
}

type ChronicleOption =
  | {
      readonly id: string
      readonly label: string
      readonly help?: string
      readonly type: 'boolean'
      readonly default: boolean
    }
  | {
      readonly id: string
      readonly label: string
      readonly help?: string
      readonly type: 'enum'
      readonly default: string
      readonly values: readonly {
        readonly id: string
        readonly label: string
      }[]
    }
  | {
      readonly id: string
      readonly label: string
      readonly help?: string
      readonly type: 'integer'
      readonly default: number
      readonly min: number
      readonly max: number
    }

export function CampaignBackstage({
  chronicle,
  narrating,
}: {
  readonly chronicle: ChronicleInfo
  readonly narrating: boolean
}) {
  const sessions = useSessions(chronicle.id)
  const transfer = useTransfer(chronicle.id)
  return (
    <View style={styles.root}>
      <SectionHeader title="Diário da crônica" />
      {narrating ? <SessionComposer chronicleId={chronicle.id} /> : null}
      {sessions.data?.items.length ? (
        sessions.data.items.map(session => (
          <SessionEntry
            key={session.id}
            chronicleId={chronicle.id}
            narrating={narrating}
            session={session}
          />
        ))
      ) : (
        <Text color="inkMuted" style={styles.inset}>
          Nenhuma sessão registrada.
        </Text>
      )}
      {narrating ? (
        <>
          <SettingsForm chronicle={chronicle} />
          <TransferPanel
            chronicleId={chronicle.id}
            members={chronicle.members}
            transfer={transfer.data}
          />
          <History chronicleId={chronicle.id} />
        </>
      ) : transfer.data?.available ? (
        <AcceptTransfer
          chronicleId={chronicle.id}
          transferId={transfer.data.id}
        />
      ) : null}
    </View>
  )
}

function SessionEntry({
  chronicleId,
  narrating,
  session,
}: {
  readonly chronicleId: string
  readonly narrating: boolean
  readonly session: {
    readonly id: string
    readonly date: string
    readonly title: string
    readonly summary: string
    readonly privateNotes?: string
    readonly revision: number
  }
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(session.title)
  const [summary, setSummary] = useState(session.summary)
  const [notes, setNotes] = useState(session.privateNotes ?? '')
  const update = useUpdateSession(chronicleId, session.id)
  const key = useRef<string | null>(null)
  if (!editing)
    return (
      <ListItem
        title={session.title}
        subtitle={session.summary || 'Sem resumo público.'}
        meta={String(session.date)}
        trailing={
          narrating ? (
            <Button
              title="Editar"
              variant="ghost"
              onPress={() => setEditing(true)}
            />
          ) : undefined
        }
      />
    )
  const change = (write: (value: string) => void) => (value: string) => {
    key.current = null
    write(value)
  }
  return (
    <View style={styles.form}>
      <TextField
        label="Título da sessão"
        value={title}
        onChangeText={change(setTitle)}
      />
      <TextArea
        label="Resumo público"
        value={summary}
        onChangeText={change(setSummary)}
      />
      <TextArea
        label="Notas privadas do narrador"
        value={notes}
        onChangeText={change(setNotes)}
      />
      <View style={styles.row}>
        <Button
          title="Cancelar"
          variant="ghost"
          onPress={() => setEditing(false)}
        />
        <Button
          title={key.current ? 'Reenviar edição' : 'Salvar sessão'}
          busy={update.isPending}
          disabled={!title.trim()}
          onPress={() =>
            update.mutate(
              {
                clientCommandId: (key.current ??= randomUUID()),
                revision: session.revision,
                date: String(session.date),
                title,
                summary,
                privateNotes: notes,
              },
              {
                onSuccess: () => {
                  key.current = null
                  setEditing(false)
                },
              }
            )
          }
        />
      </View>
      {update.isError ? (
        <Text color="danger">{messageOf(update.error)}</Text>
      ) : null}
    </View>
  )
}

function SessionComposer({ chronicleId }: { readonly chronicleId: string }) {
  const create = useCreateSession(chronicleId)
  const key = useRef<string | null>(null)
  const today = new Date()
  const [date, setDate] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  )
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [notes, setNotes] = useState('')
  const change = (write: (value: string) => void) => (value: string) => {
    key.current = null
    write(value)
  }
  return (
    <View style={styles.form}>
      <TextField label="Data" value={date} onChangeText={change(setDate)} />
      <TextField
        label="Título da sessão"
        value={title}
        onChangeText={change(setTitle)}
        maxLength={120}
      />
      <TextArea
        label="Resumo público"
        value={summary}
        onChangeText={change(setSummary)}
        maxLength={8000}
      />
      <TextArea
        label="Notas privadas do narrador"
        value={notes}
        onChangeText={change(setNotes)}
        maxLength={16000}
        hint="Nunca são enviadas aos jogadores."
      />
      <Button
        title={key.current ? 'Reenviar registro' : 'Registrar sessão'}
        busy={create.isPending}
        disabled={!title.trim()}
        onPress={() => {
          const clientCommandId = (key.current ??= randomUUID())
          create.mutate(
            { clientCommandId, date, title, summary, privateNotes: notes },
            {
              onSuccess: () => {
                key.current = null
                setTitle('')
                setSummary('')
                setNotes('')
              },
            }
          )
        }}
      />
      {create.isError ? (
        <Text color="danger">{messageOf(create.error)}</Text>
      ) : null}
    </View>
  )
}

function SettingsForm({ chronicle }: { readonly chronicle: ChronicleInfo }) {
  const update = useUpdateChronicle(chronicle.id)
  const key = useRef<string | null>(null)
  const [name, setName] = useState(chronicle.name)
  const [description, setDescription] = useState(chronicle.description ?? '')
  const [imageUrl, setImageUrl] = useState(chronicle.imageUrl ?? '')
  const [optionValues, setOptionValues] = useState<
    Record<string, boolean | number | string>
  >(chronicle.options ?? {})
  useEffect(() => setName(chronicle.name), [chronicle.name])
  useEffect(() => {
    setDescription(chronicle.description ?? '')
    setImageUrl(chronicle.imageUrl ?? '')
    setOptionValues(chronicle.options ?? {})
  }, [chronicle.description, chronicle.imageUrl, chronicle.options])
  const changed = () => {
    key.current = null
  }
  const setOption = (id: string, value: boolean | number | string) => {
    changed()
    setOptionValues(current => ({ ...current, [id]: value }))
  }
  return (
    <View style={styles.section}>
      <SectionHeader title="Apresentação" />
      <View style={styles.form}>
        <TextField
          label="Nome"
          value={name}
          onChangeText={value => {
            changed()
            setName(value)
          }}
          maxLength={80}
        />
        <TextArea
          label="Descrição"
          value={description}
          onChangeText={value => {
            changed()
            setDescription(value)
          }}
          maxLength={4000}
        />
        <TextField
          label="Imagem HTTPS"
          value={imageUrl}
          onChangeText={value => {
            changed()
            setImageUrl(value)
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {chronicle.optionCatalog?.length ? (
          <View style={styles.form}>
            <Text variant="fieldLabel">Regras da casa</Text>
            {chronicle.optionCatalog.map(option => {
              const value = optionValues[option.id] ?? option.default
              return (
                <View key={option.id} style={styles.option}>
                  <Text>{option.label}</Text>
                  {option.help ? (
                    <Text color="inkMuted">{option.help}</Text>
                  ) : null}
                  {option.type === 'boolean' ? (
                    <Button
                      title={value === true ? 'Ligada' : 'Desligada'}
                      variant={value === true ? 'primary' : 'secondary'}
                      onPress={() => setOption(option.id, value !== true)}
                    />
                  ) : option.type === 'enum' ? (
                    <View style={styles.row}>
                      {option.values.map(item => (
                        <Button
                          key={item.id}
                          title={item.label}
                          variant={value === item.id ? 'primary' : 'secondary'}
                          onPress={() => setOption(option.id, item.id)}
                        />
                      ))}
                    </View>
                  ) : (
                    <TextField
                      label={`${option.min} a ${option.max}`}
                      value={String(value)}
                      keyboardType="number-pad"
                      onChangeText={raw => {
                        const number = Number(raw)
                        if (Number.isSafeInteger(number))
                          setOption(option.id, number)
                      }}
                    />
                  )}
                </View>
              )
            })}
          </View>
        ) : null}
        <Button
          title={key.current ? 'Reenviar alterações' : 'Salvar apresentação'}
          busy={update.isPending}
          disabled={!name.trim()}
          onPress={() => {
            const clientCommandId = (key.current ??= randomUUID())
            update.mutate(
              {
                clientCommandId,
                revision: chronicle.settingsRevision ?? 0,
                name,
                description,
                imageUrl: imageUrl.trim() || null,
                options: optionValues,
              },
              { onSuccess: () => (key.current = null) }
            )
          }}
        />
        {update.isError ? (
          <Text color="danger">{messageOf(update.error)}</Text>
        ) : null}
      </View>
    </View>
  )
}

function TransferPanel({
  chronicleId,
  members,
  transfer,
}: {
  chronicleId: string
  members: ChronicleInfo['members']
  transfer:
    | {
        id: string
        status: string
        recipient: { username: string }
        expiresAt: string | Date
        available: boolean
      }
    | undefined
}) {
  const propose = useProposeTransfer(chronicleId)
  const pending = useRef<{ recipientId: string; key: string } | null>(null)
  const cancel = useCancelTransfer(chronicleId, transfer?.id ?? '')
  const cancelKey = useRef<string | null>(null)
  return (
    <View style={styles.section}>
      <SectionHeader title="Transferir narração" />
      {/* Vencido não espera ninguém: a próxima proposta o fecha no servidor */}
      {transfer?.status === 'pending' && transfer.available ? (
        <View style={styles.form}>
          <Text>
            Aguardando {transfer.recipient.username} aceitar. O pedido vale por
            sete dias.
          </Text>
          <Button
            title="Cancelar transferência"
            variant="secondary"
            busy={cancel.isPending}
            onPress={() => cancel.mutate((cancelKey.current ??= randomUUID()))}
          />
        </View>
      ) : members.length ? (
        members.map(member => (
          <ListItem
            key={member.id}
            title={member.username}
            subtitle="Receberá NPCs, notas privadas e o histórico administrativo"
            trailing={
              <Button
                title="Propor"
                variant="secondary"
                busy={propose.isPending}
                onPress={() => {
                  const command =
                    pending.current?.recipientId === member.id
                      ? pending.current
                      : { recipientId: member.id, key: randomUUID() }
                  pending.current = command
                  propose.mutate(
                    {
                      clientCommandId: command.key,
                      recipientId: member.id,
                    },
                    { onSuccess: () => (pending.current = null) }
                  )
                }}
              />
            }
          />
        ))
      ) : (
        <Text color="inkMuted" style={styles.inset}>
          Convide um membro antes de transferir.
        </Text>
      )}
    </View>
  )
}

function AcceptTransfer({
  chronicleId,
  transferId,
}: {
  chronicleId: string
  transferId: string
}) {
  const accept = useAcceptTransfer(chronicleId, transferId)
  const reject = useRejectTransfer(chronicleId, transferId)
  const key = useRef<string | null>(null)
  const rejectKey = useRef<string | null>(null)
  return (
    <View style={styles.form}>
      <Text variant="fieldLabel">Convite para narrar</Text>
      <Text>
        Ao aceitar, você assume NPCs, notas privadas e o histórico
        administrativo desta crônica.
      </Text>
      <Button
        title="Aceitar narração"
        busy={accept.isPending}
        onPress={() => accept.mutate((key.current ??= randomUUID()))}
      />
      <Button
        title="Recusar"
        variant="secondary"
        busy={reject.isPending}
        onPress={() => reject.mutate((rejectKey.current ??= randomUUID()))}
      />
    </View>
  )
}

function History({ chronicleId }: { readonly chronicleId: string }) {
  const characters = useChronicleCharacters(chronicleId)
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const dateFilter = (value: string, end: boolean) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  const fromIso = dateFilter(from, false)
  const toIso = dateFilter(to, true)
  const history = useChronicleHistory(chronicleId, true, {
    ...(characterId ? { characterId } : {}),
    ...(fromIso ? { from: fromIso } : {}),
    ...(toIso ? { to: toIso } : {}),
  })
  const items = history.data?.pages.flatMap(page => page.items) ?? []
  return (
    <View style={styles.section}>
      <SectionHeader title="Auditoria" />
      <View style={styles.form}>
        <View style={styles.row}>
          <Chip
            label="Todas as fichas"
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
        <View style={styles.row}>
          <View style={styles.dateField}>
            <TextField
              label="Desde (AAAA-MM-DD)"
              value={from}
              onChangeText={setFrom}
            />
          </View>
          <View style={styles.dateField}>
            <TextField
              label="Até (AAAA-MM-DD)"
              value={to}
              onChangeText={setTo}
            />
          </View>
        </View>
      </View>
      {items.map(item => (
        <ListItem
          key={`${item.source}:${item.id}`}
          title={item.action}
          subtitle={item.by?.username ?? 'Conta excluída'}
          meta={new Date(item.at).toLocaleString()}
        />
      ))}
      {history.hasNextPage ? (
        <View style={styles.form}>
          <Button
            title="Carregar histórico anterior"
            variant="secondary"
            busy={history.isFetchingNextPage}
            onPress={() => history.fetchNextPage()}
          />
        </View>
      ) : null}
      {history.isError ? (
        <Text color="danger" style={styles.inset}>
          {messageOf(history.error)}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.space[4], paddingBottom: tokens.space[8] },
  section: { gap: tokens.space[2], paddingTop: tokens.space[3] },
  form: { gap: tokens.space[3], paddingHorizontal: tokens.layout.gutter },
  option: { gap: tokens.space[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  dateField: { minWidth: 220, flex: 1 },
  inset: { paddingHorizontal: tokens.layout.gutter },
})
