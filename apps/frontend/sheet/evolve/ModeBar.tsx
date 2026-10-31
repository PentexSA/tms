import {
  applyBatch,
  type ChangeLabel,
  describeBatch,
  describeEvent,
  inactiveChanges,
  isDraftMode,
  type SheetEvent,
  type SheetMode,
} from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  Pressable,
  Text,
  tokens,
  useTheme,
  useToast,
} from '@tms/ui'
import { useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { useSheet, useSheetStore } from '../context'
import { useCreation } from '../creation/CreationContext'
import { useFinishCreation, useFreebiesText } from '../creation/CreationPanel'
import { REFUSAL_TEXT } from '../creation/creation'
import { useDraftCount } from './hooks'

// Modos da ficha (DS: ModeBar). O modo é UX: o que cada um libera vem de
// `editableIn` por campo e das permissões, conferidas pelo core e pelo
// servidor. Em Evoluir as alterações formam um rascunho ("N alterações")
// que vira UM lote ao salvar (doc/arquitetura §6.5). Em Criação, o botão é
// um só: salva o rascunho e, com a conta fechada, conclui (salvando antes).

export const MODE_LABELS: Readonly<Record<SheetMode, string>> = {
  read: 'Leitura',
  play: 'Jogo',
  evolve: 'Editar',
  create: 'Criação',
}

// O dono não tem Leitura: Jogo já mostra a ficha inteira. Quem escreve sem
// ser dono (o narrador) começa em Leitura e precisa do botão para voltar
const OWNER_MODES: readonly SheetMode[] = ['play', 'evolve']
const OTHER_MODES: readonly SheetMode[] = ['read', 'play', 'evolve']
// Na criação por pontos, o Editar vira Criação: o mesmo rascunho, com a conta
const OWNER_CREATE: readonly SheetMode[] = ['play', 'create']
const OTHER_CREATE: readonly SheetMode[] = ['read', 'play', 'create']

export const changesLabel = (n: number): string =>
  n === 1 ? '1 alteração' : `${n} alterações`

export function ModeBar({
  modes: only,
}: {
  readonly modes?: readonly SheetMode[]
}) {
  const { model, mode, roles } = useSheet()
  const creating = useCreation()?.active === true
  const owner = roles.has('owner')
  const modes =
    only ??
    (creating
      ? owner
        ? OWNER_CREATE
        : OTHER_CREATE
      : owner
        ? OWNER_MODES
        : OTHER_MODES)
  const store = useSheetStore()
  const toast = useToast()
  const count = useDraftCount()
  const finishing = useFinishCreation()
  const freebies = useFreebiesText()
  const [summary, setSummary] = useState<{
    readonly next: SheetMode
    // Concluir a criação depois de salvar
    readonly finish: boolean
    readonly events: readonly SheetEvent[]
    // Pontos que ficam inativos (ou voltam a valer) com o teto novo
    readonly inactive: readonly ChangeLabel[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Ao sair de Editar, volta ao modo de antes, se ele estiver no seletor
  const back = (m: SheetMode): SheetMode =>
    !isDraftMode(m) && modes.includes(m) ? m : (modes[0] ?? 'read')
  const returnTo = useRef<SheetMode>(back(mode))

  const switchTo = (next: SheetMode) => {
    const s = store.getState()
    if (isDraftMode(next)) {
      returnTo.current = isDraftMode(s.mode) ? returnTo.current : back(s.mode)
      s.startDraft()
    } else if (isDraftMode(s.mode)) s.discardDraft()
    s.setMode(next)
    AccessibilityInfo.announceForAccessibility(`Modo ${MODE_LABELS[next]}`)
  }

  const go = (next: SheetMode) => {
    const s = store.getState()
    if (next === s.mode) return
    // Sair de Evoluir com alterações passa pelo resumo: salvar ou descartar
    if (isDraftMode(s.mode) && s.draft?.size) {
      review(next)
      return
    }
    switchTo(next)
  }

  // O resumo antes de salvar; `next` é o modo depois (na criação, ela mesma)
  const review = (next: SheetMode, finish = false) => {
    const s = store.getState()
    setError(null)
    const events = s.draftEvents()
    const after = applyBatch(model, s.values, { events }, roles)
    setSummary({
      next,
      finish,
      events,
      inactive: after.ok ? inactiveChanges(model, s.values, after.sheet) : [],
    })
  }

  const save = () => {
    if (!summary) return
    if (summary.finish && !summary.events.length) {
      setSummary(null)
      finishing.start()
      return
    }
    const label = describeBatch(model, summary.events)
    const result = store.getState().saveDraft(label)
    if (result && !result.ok) {
      const refused = store.getState().creationRefusal
      setError(
        result.kind === 'conflict'
          ? 'Alguém mudou um destes campos enquanto você editava. Confira os valores e salve de novo.'
          : result.kind === 'creation' && refused
            ? REFUSAL_TEXT[refused.code]
            : (result.issues[0]?.message ?? 'Não foi possível salvar.')
      )
      return
    }
    const next = summary.next
    setSummary(null)
    switchTo(next)
    // Concluir: espera a fila confirmar o lote; sem Desfazer no meio
    if (summary.finish) {
      if (result?.ok) finishing.start()
      return
    }
    if (result?.ok) {
      const id = result.batch.clientBatchId
      toast.show({
        message: `Salvo: ${label}`,
        action: {
          label: 'Desfazer',
          onPress: () => {
            store.getState().undo(id)
          },
        },
      })
    }
  }

  const discard = () => {
    const next = summary?.next ?? returnTo.current
    store.getState().discardDraft()
    setSummary(null)
    switchTo(next)
  }

  return (
    <View>
      <ModeSwitch modes={modes} mode={mode} onChange={go} />
      {mode === 'evolve' ? (
        <EvolveBar count={count} onFinish={() => go(returnTo.current)} />
      ) : mode === 'create' ? (
        // Um botão só: com a conta fechada, conclui (salvando antes)
        <EvolveBar
          count={count}
          label="Criação"
          detail={freebies}
          finish={
            finishing.waitingSync
              ? 'Sincronizando…'
              : finishing.ready
                ? finishing.label
                : 'Salvar alterações'
          }
          primary={finishing.ready}
          busy={finishing.busy}
          disabled={!finishing.ready && count === 0}
          testID="creation-action"
          onFinish={() =>
            finishing.ready
              ? review('create', true)
              : count
                ? review('create')
                : undefined
          }
        />
      ) : null}
      <SummarySheet
        visible={summary !== null}
        finish={
          summary?.finish
            ? { label: finishing.label, approval: finishing.approval }
            : null
        }
        events={summary?.events ?? []}
        inactive={summary?.inactive ?? []}
        error={error}
        onSave={save}
        onDiscard={discard}
        onClose={() => setSummary(null)}
      />
    </View>
  )
}

function ModeSwitch({
  modes,
  mode,
  onChange,
}: {
  readonly modes: readonly SheetMode[]
  readonly mode: SheetMode
  readonly onChange: (mode: SheetMode) => void
}) {
  const { colors } = useTheme()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Modo da ficha"
      style={styles.switch}
    >
      {modes.map(m => {
        const on = m === mode
        return (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityLabel={MODE_LABELS[m]}
            aria-checked={on}
            onPress={() => onChange(m)}
            style={[
              styles.mode,
              {
                borderColor: on ? colors.action : colors.borderControl,
                backgroundColor: on ? colors.surfaceRaised : 'transparent',
              },
            ]}
          >
            <Text variant="caption" color={on ? 'action' : 'ink'}>
              {MODE_LABELS[m]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function EvolveBar({
  count,
  onFinish,
  label = 'Editar',
  finish = 'Concluir',
  detail = null,
  primary = false,
  busy = false,
  disabled = false,
  testID,
}: {
  readonly count: number
  readonly onFinish: () => void
  readonly label?: string
  readonly finish?: string
  // Ao lado da contagem (o saldo de bônus, na criação)
  readonly detail?: string | null
  readonly primary?: boolean
  readonly busy?: boolean
  readonly disabled?: boolean
  readonly testID?: string
}) {
  const { colors } = useTheme()
  return (
    <View
      accessibilityLabel={`Modo ${label}`}
      style={[
        styles.bar,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.borderSubtle,
        },
      ]}
    >
      <Text variant="caption" aria-live="polite" style={styles.flex}>
        {[label === 'Editar' ? 'Editando' : label, changesLabel(count), detail]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Button
        title={finish}
        variant={primary ? 'primary' : 'secondary'}
        busy={busy}
        disabled={disabled || busy}
        testID={testID}
        onPress={onFinish}
      />
    </View>
  )
}

function SummarySheet({
  visible,
  finish,
  events,
  inactive,
  error,
  onSave,
  onDiscard,
  onClose,
}: {
  readonly visible: boolean
  // Conclusão da criação: confirma em vez de oferecer Descartar
  readonly finish: { readonly label: string; readonly approval: boolean } | null
  readonly events: readonly SheetEvent[]
  readonly inactive: readonly ChangeLabel[]
  readonly error: string | null
  readonly onSave: () => void
  readonly onDiscard: () => void
  readonly onClose: () => void
}) {
  const { model } = useSheet()
  return (
    <BottomSheet
      visible={visible}
      title={
        finish ? `${finish.label}?` : `Salvar ${changesLabel(events.length)}?`
      }
      onClose={onClose}
      footer={
        finish ? (
          <>
            <Button title="Voltar" variant="ghost" onPress={onClose} />
            <Button
              title={finish.label}
              testID="creation-confirm"
              onPress={onSave}
            />
          </>
        ) : (
          <>
            <Button title="Descartar" variant="danger" onPress={onDiscard} />
            <Button title="Salvar" onPress={onSave} />
          </>
        )
      }
    >
      <View testID="evolve-summary" style={styles.summary}>
        {error ? (
          <Text color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {finish ? (
          <Text color="inkMuted">
            {finish.approval
              ? 'A ficha vai para o narrador aprovar e fica somente para leitura até lá.'
              : 'Depois de concluir, subir um traço passa pelo narrador.'}
            {events.length ? ' As alterações abaixo são salvas antes.' : ''}
          </Text>
        ) : null}
        {events.map(e => {
          const { label, change } = describeEvent(model, e)
          return (
            <View
              key={e.path}
              accessible
              accessibilityLabel={`${label}, ${change}`}
              style={styles.change}
            >
              <Text style={styles.flex}>{label}</Text>
              <Text color="inkMuted">{change}</Text>
            </View>
          )
        })}
        {inactive.length ? (
          <View testID="evolve-inactive" style={styles.summary}>
            <Text variant="caption" color="inkMuted">
              Nenhum ponto se perde: acima do teto, ficam inativos até ele
              subir.
            </Text>
            {inactive.map(c => (
              <View
                key={c.label}
                accessible
                accessibilityLabel={`${c.label}, ${c.change}`}
                style={styles.change}
              >
                <Text style={styles.flex}>{c.label}</Text>
                <Text color="inkMuted">{c.change}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switch: {
    flexDirection: 'row',
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
  },
  mode: {
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.control,
    paddingHorizontal: tokens.space[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
    borderTopWidth: tokens.borderWidth.hair,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  summary: { gap: tokens.space[2] },
  change: {
    flexDirection: 'row',
    gap: tokens.space[3],
    paddingVertical: tokens.space[1],
  },
})
