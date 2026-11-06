import {
  Button,
  Chip,
  hitTarget,
  Stepper,
  Text,
  TextField,
  textStyle,
  tokens,
  useTheme,
} from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useRef, useState } from 'react'
import { Platform, StyleSheet, TextInput, View } from 'react-native'
import { useOnline } from '../../lib/network'
import {
  type useXpCommands,
  type XpEntryData,
  type XpOutcome,
} from '../../lib/queries/xp'
import type { XpCommand, XpCommandKind } from '../../lib/xpCommands'
import { parseTyped } from '../evolve/typing'
import { xpMessage } from './messages'

// Formulários dos comandos de XP. A chave nasce ao confirmar e só é trocada
// quando o servidor responde: sem resposta, o mesmo comando (mesma chave,
// mesma intenção) fica salvo e o "Tentar de novo" o reenvia.

type Commands = ReturnType<typeof useXpCommands>

/** Envia um comando e diz o que aconteceu, numa frase. */
export function useCommand(commands: Commands, storyteller: boolean) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef<XpCommand | null>(null)
  const send = async (
    make: (key: string) => XpCommand,
    action?: string
  ): Promise<XpOutcome | null> => {
    if (busy) return null
    // A mesma intenção ainda sem resposta reaproveita a chave
    const command = pending.current ?? make(randomUUID())
    pending.current = command
    setBusy(true)
    setError(null)
    try {
      const outcome = await commands.run(command)
      if (outcome.status === 'done' || outcome.status === 'refused')
        pending.current = null
      if (outcome.status === 'refused')
        setError(xpMessage(outcome.error, { storyteller, action }))
      if (outcome.status === 'unknown')
        setError(
          'Sem resposta do servidor. O comando ficou guardado: tente de novo, sem risco de repetir.'
        )
      if (outcome.status === 'offline')
        setError('Conecte-se para enviar. Nada foi enviado.')
      return outcome
    } finally {
      setBusy(false)
    }
  }
  // Mudou a intenção (outro valor, outro motivo): uma chave nova depois
  const reset = () => {
    pending.current = null
    setError(null)
  }
  return { send, reset, error, busy }
}

const command = (
  kind: XpCommandKind,
  key: string,
  args: {
    readonly chronicleId: string
    readonly characterId: string
    readonly requestId?: string
    readonly body: Record<string, unknown>
    readonly label: string
  }
): XpCommand => ({ key, kind, at: Date.now(), ...args })

export { command as xpCommand }

/** Conceder XP a uma ou várias fichas (até 20), com motivo. */
export function GrantForm({
  chronicleId,
  characterIds,
  commands,
  onDone,
}: {
  readonly chronicleId: string
  readonly characterIds: readonly string[]
  readonly commands: Commands
  readonly onDone?: (result: unknown) => void
}) {
  const online = useOnline()
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState('')
  const run = useCommand(commands, true)
  const valid = reason.trim().length > 0 && characterIds.length > 0
  return (
    <View style={styles.form}>
      <TypedAmount
        label="XP a conceder"
        value={amount}
        min={1}
        max={1000}
        testID="xp-grant-amount"
        disabled={run.busy}
        onChange={v => {
          setAmount(v)
          run.reset()
        }}
      />
      <TextField
        label="Motivo"
        value={reason}
        maxLength={200}
        placeholder="Sessão 12"
        testID="xp-grant-reason"
        onChangeText={t => {
          setReason(t)
          run.reset()
        }}
      />
      {run.error ? (
        <Text color="danger" accessibilityRole="alert">
          {run.error}
        </Text>
      ) : null}
      {!online ? (
        <Text color="inkMuted">Conecte-se para conceder XP.</Text>
      ) : null}
      <Button
        title="Conceder XP"
        testID="xp-grant-confirm"
        busy={run.busy}
        disabled={!online || !valid}
        onPress={() => {
          void run
            .send(key =>
              command('grant', key, {
                chronicleId,
                characterId: characterIds[0] as string,
                body: {
                  amount,
                  reason: reason.trim(),
                  targets: characterIds.map(characterId => ({ characterId })),
                },
                label: `Conceder ${amount} XP`,
              })
            )
            .then(outcome => {
              if (outcome?.status === 'done') onDone?.(outcome.data)
            })
        }}
      />
    </View>
  )
}

/** Ajuste do total ou estorno de uma concessão, com motivo. */
export function AdjustForm({
  chronicleId,
  characterId,
  grants,
  commands,
  onDone,
}: {
  readonly chronicleId: string
  readonly characterId: string
  // Concessões que ainda têm o que estornar
  readonly grants: readonly XpEntryData[]
  readonly commands: Commands
  readonly onDone?: () => void
}) {
  const online = useOnline()
  const [delta, setDelta] = useState(-1)
  const [reason, setReason] = useState('')
  const [reverses, setReverses] = useState<string | null>(null)
  const run = useCommand(commands, true)
  const reversible = grants.filter(g => (g.reversible ?? 0) > 0)
  const limit = reversible.find(g => g.id === reverses)?.reversible
  const valid =
    delta !== 0 &&
    reason.trim().length > 0 &&
    (reverses === null || (delta < 0 && -delta <= (limit ?? 0)))
  return (
    <View style={styles.form}>
      <TypedAmount
        label="Ajuste no total"
        value={delta}
        min={-1000}
        max={1000}
        testID="xp-adjust-delta"
        valueText={n => (n > 0 ? `+${n}` : String(n))}
        disabled={run.busy}
        signed
        onChange={v => {
          setDelta(v)
          run.reset()
        }}
      />
      {reversible.length ? (
        <View style={styles.form}>
          <Text variant="fieldLabel">Estornar uma concessão (opcional)</Text>
          <View style={styles.chips}>
            {reversible.map(g => (
              <Chip
                key={g.id}
                label={`${g.reason ?? 'Concessão'} · até ${g.reversible}`}
                selected={reverses === g.id}
                onPress={() => {
                  setReverses(reverses === g.id ? null : g.id)
                  run.reset()
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
      <TextField
        label="Motivo"
        value={reason}
        maxLength={200}
        testID="xp-adjust-reason"
        onChangeText={t => {
          setReason(t)
          run.reset()
        }}
      />
      {run.error ? (
        <Text color="danger" accessibilityRole="alert">
          {run.error}
        </Text>
      ) : null}
      <Button
        title={reverses ? 'Estornar' : 'Ajustar XP'}
        testID="xp-adjust-confirm"
        busy={run.busy}
        disabled={!online || !valid}
        onPress={() => {
          void run
            .send(key =>
              command('adjust', key, {
                chronicleId,
                characterId,
                body: {
                  delta,
                  reason: reason.trim(),
                  ...(reverses && { reversesEntryId: reverses }),
                },
                label: `${reverses ? 'Estornar' : 'Ajustar'} ${delta} XP`,
              })
            )
            .then(outcome => {
              if (outcome?.status === 'done') onDone?.()
            })
        }}
      />
    </View>
  )
}

/**
 * U-02: o valor do XP com o "Digitar" do Stepper, como no Editar (T-25):
 * Enter aplica; sair do campo aplica; Esc cancela; fora da faixa, a
 * mensagem, e com Enter o campo fica aberto. Estado local: a folha da Mesa
 * também usa o formulário, e o `typingStore` é do editor da ficha.
 */
function TypedAmount({
  label,
  value,
  min,
  max,
  testID,
  disabled,
  valueText,
  signed = false,
  onChange,
}: {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly testID: string
  readonly disabled: boolean
  readonly valueText?: (n: number) => string
  // Aceita negativo: no iOS, o `number-pad` não tem o sinal de menos
  readonly signed?: boolean
  readonly onChange: (n: number) => void
}) {
  const theme = useTheme()
  const { colors } = theme
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const text = useRef('')
  const done = useRef(true)
  const finish = (how: 'submit' | 'leave') => {
    if (done.current) return
    const n = parseTyped(text.current, min, max)
    if (n === null) {
      setError(`Digite um número inteiro de ${min} a ${max}`)
      if (how === 'submit') return
    } else setError(null)
    done.current = true
    setTyping(false)
    if (n !== null) onChange(n)
  }
  const cancel = () => {
    done.current = true
    setError(null)
    setTyping(false)
  }
  const open = () => {
    text.current = String(value)
    done.current = false
    setError(null)
    setTyping(true)
  }
  const textOf = (e: { nativeEvent: unknown }) => {
    const t = (e.nativeEvent as { text?: unknown } | undefined)?.text
    if (typeof t === 'string') text.current = t
  }
  return (
    <View style={styles.form}>
      {typing ? (
        <>
          <Text variant="fieldLabel">{label}</Text>
          <TextInput
            testID={`${testID}-input`}
            accessibilityLabel={`${label}, de ${min} a ${max}`}
            keyboardType={
              signed && Platform.OS === 'ios'
                ? 'numbers-and-punctuation'
                : 'number-pad'
            }
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            defaultValue={String(value)}
            maxLength={Math.max(String(min).length, String(max).length) + 1}
            onChangeText={t => {
              text.current = t
            }}
            submitBehavior="submit"
            {...(Platform.OS === 'web' ? { blurOnSubmit: false } : {})}
            onSubmitEditing={e => {
              textOf(e)
              finish('submit')
            }}
            onBlur={e => {
              textOf(e)
              finish('leave')
            }}
            onKeyPress={e => {
              if (e.nativeEvent.key === 'Escape') cancel()
            }}
            style={[
              styles.input,
              { minHeight: hitTarget() },
              textStyle(theme, 'number'),
              { borderColor: colors.borderControl, color: colors.ink },
            ]}
          />
        </>
      ) : (
        <Stepper
          label={label}
          showLabel
          value={value}
          min={min}
          max={max}
          size="sheet"
          testID={testID}
          disabled={disabled}
          onValuePress={disabled ? undefined : open}
          {...(valueText ? { valueText } : {})}
          onChange={onChange}
        />
      )}
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: tokens.space[2] },
  input: {
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[3],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
})
