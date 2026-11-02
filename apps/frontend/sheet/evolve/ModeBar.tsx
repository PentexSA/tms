import {
  applyBatch,
  type ChangeLabel,
  describeEvent,
  fieldPlace,
  inactiveChanges,
  isDraftMode,
  parsePath,
  type SheetEvent,
  type SheetMode,
  type SheetModel,
  withEffectiveFrom,
} from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  Pressable,
  Text,
  tokens,
  useLayout,
  useRovingFocus,
  useTheme,
  useToast,
} from '@tms/ui'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { useSheet, useSheetStore } from '../context'
import { CompletionMessage } from '../creation/CompletionMessage'
import { useCreation } from '../creation/CreationContext'
import { useFinishCreation, useFreebiesText } from '../creation/CreationPanel'
import { completionBy, completionCopy } from '../creation/completion'
import { useDraftCount } from './hooks'
import { saveDraftNow } from './saveDraft'

// Modos da ficha (DS: ModeBar). O modo é UX: o que cada um libera vem de
// `editableIn` por campo e das permissões, conferidas pelo core e pelo
// servidor. Em Evoluir as alterações formam um rascunho ("N alterações")
// que vira UM lote ao salvar (doc/arquitetura §6.5). Em Criação, "Salvar"
// fica sempre; com a conta fechada, "Concluir criação" (ou "Enviar para
// aprovação") aparece ao lado e conclui, salvando antes (D-01).

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

/** As três partes da barra de modos, com um estado só (T-27). */
export interface ModeBarParts {
  /** O seletor de modo (Leitura · Jogo · Editar). */
  readonly switcher: ReactNode
  /** A barra de ação do rascunho ("Criação · N alterações" e o botão). */
  readonly actionBar: ReactNode
  /** O resumo antes de salvar (folha). */
  readonly summary: ReactNode
}

/**
 * A lógica da barra de modos (ir, revisar, salvar, descartar e o resumo),
 * com as partes separadas: no celular, o seletor rola com a ficha e a barra
 * de ação fica fixa (T-27). Fora dele, o SheetView monta as três juntas,
 * fixas acima da ficha.
 */
export function useModeBar({
  modes: only,
  enabled = true,
}: {
  readonly modes?: readonly SheetMode[]
  // Quem não escreve (pelo papel ou pela política) fica sem as partes: o
  // resumo aberto fecha, e não volta sozinho quando o Editar voltar
  readonly enabled?: boolean
} = {}): ModeBarParts {
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
  useEffect(() => {
    if (!enabled) setSummary(null)
  }, [enabled])
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
      // Só para mostrar (T-54): o "de" efetivo da ficha salva ("Aparência
      // 1 → 3", não "0 → 3"), como o Histórico. O lote sai do rascunho do
      // store, com o `from` cru, que é o que o conflito compara.
      events: withEffectiveFrom(model, s.values, events),
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
    const result = saveDraftNow(model, store)
    if (!result.ok) {
      setError(result.message)
      return
    }
    const next = summary.next
    setSummary(null)
    switchTo(next)
    // Concluir: espera a fila confirmar o lote; sem Desfazer no meio
    if (summary.finish) {
      if (result.batchId !== null) finishing.start()
      return
    }
    if (result.batchId !== null) {
      const id = result.batchId
      toast.show({
        message: `Salvo: ${result.label}`,
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

  const switcher = <ModeSwitch modes={modes} mode={mode} onChange={go} />
  const actionBar =
    mode === 'evolve' ? (
      // R-05 (D-01): o botão só salva; sem alterações, não há o que salvar,
      // e a saída do modo é o seletor
      <EvolveBar
        count={count}
        save={{
          title: 'Salvar alterações',
          testID: 'mode-save',
          disabled: count === 0,
          onPress: () => go(returnTo.current),
        }}
      />
    ) : mode === 'create' ? (
      // D-01: "Salvar" sempre; com a conta fechada, a conclusão ao lado
      <EvolveBar
        count={count}
        label="Criação"
        detail={freebies}
        save={{
          // "Salvar" visível; o nome é o do Editar (WCAG 2.5.3: começa
          // pelo texto visível) e não colide com o "Salvar" do resumo
          title: 'Salvar',
          accessibilityLabel: 'Salvar alterações',
          testID: 'mode-save',
          disabled: count === 0 || finishing.busy,
          onPress: () => review('create'),
        }}
        next={
          finishing.ready
            ? {
                title: finishing.waitingSync
                  ? 'Sincronizando…'
                  : finishing.label,
                primary: true,
                busy: finishing.busy,
                testID: 'creation-action',
                onPress: () => review('create', true),
              }
            : null
        }
      />
    ) : null
  const summarySheet = (
    <SummarySheet
      visible={summary !== null}
      finish={
        summary?.finish
          ? {
              label: finishing.label,
              body: completionCopy({
                by: completionBy(roles),
                approval: finishing.approval,
                action: 'complete',
              }).body,
              notes: finishing.notes,
            }
          : null
      }
      events={summary?.events ?? []}
      inactive={summary?.inactive ?? []}
      error={error}
      onSave={save}
      onDiscard={discard}
      onClose={() => setSummary(null)}
    />
  )
  return { switcher, actionBar, summary: summarySheet }
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
  // Setas só movem o foco: trocar de modo é uma ação (Espaço ou Enter)
  const roving = useRovingFocus({
    count: modes.length,
    active: modes.indexOf(mode),
    activate: 'manual',
  })
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Modo da ficha"
      style={styles.switch}
    >
      {modes.map((m, i) => {
        const on = m === mode
        return (
          <Pressable
            key={m}
            {...roving(i)}
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

/** Uma ação da barra de modos. */
interface BarAction {
  readonly title: string
  // Padrão: o título. Começa pelo título visível (WCAG 2.5.3)
  readonly accessibilityLabel?: string
  readonly onPress: () => void
  readonly primary?: boolean
  readonly busy?: boolean
  readonly disabled?: boolean
  readonly testID?: string
}

/**
 * A barra de ação do rascunho: o texto ("Criação · N alterações") e as
 * ações. `save` está sempre; `next` é a ação seguinte (concluir ou enviar;
 * no Editar da criação livre, o aviso da D-03); `note` é uma linha sob o
 * texto (o próximo passo). No celular com duas ações (ou com a nota), e com
 * fonte grande, o texto fica em cima e as ações embaixo, numa linha que
 * quebra se não couber.
 */
function EvolveBar({
  count,
  label = 'Editar',
  detail = null,
  save,
  next = null,
  note = null,
}: {
  readonly count: number
  readonly label?: string
  // Ao lado da contagem (o saldo de bônus, na criação)
  readonly detail?: string | null
  readonly save: BarAction
  readonly next?: BarAction | null
  readonly note?: ReactNode
}) {
  const { colors } = useTheme()
  const { breakpoint, stacked } = useLayout()
  const twoLines = stacked || (breakpoint === 'compact' && (next || note))
  const text = (
    <Text
      variant="caption"
      aria-live="polite"
      style={note || twoLines ? undefined : styles.flex}
    >
      {[label === 'Editar' ? 'Editando' : label, changesLabel(count), detail]
        .filter(Boolean)
        .join(' · ')}
    </Text>
  )
  // A principal fica à direita, como nos rodapés das folhas
  const actions = [save, next].map(a =>
    a ? (
      <Button
        key={a.testID ?? a.title}
        title={a.title}
        accessibilityLabel={a.accessibilityLabel}
        variant={a.primary ? 'primary' : 'secondary'}
        busy={a.busy}
        disabled={a.disabled || a.busy}
        testID={a.testID}
        onPress={a.onPress}
      />
    ) : null
  )
  return (
    <View
      accessibilityLabel={`Modo ${label}`}
      testID="mode-bar"
      style={[
        twoLines ? styles.barStacked : styles.bar,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.borderSubtle,
        },
      ]}
    >
      {note || twoLines ? (
        <View style={twoLines ? undefined : styles.flex}>
          {text}
          {note}
        </View>
      ) : (
        text
      )}
      {twoLines ? (
        <View testID="mode-bar-actions" style={styles.barActions}>
          {actions}
        </View>
      ) : (
        actions
      )}
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
  // Conclusão da criação: confirma em vez de oferecer Descartar. O corpo é o
  // do `completionCopy` (T-32), com as linhas extras em `notes`
  readonly finish: {
    readonly label: string
    readonly body: string
    readonly notes?: readonly string[]
  } | null
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
            {/* T-78: Descartar é secundário e fica longe do Salvar */}
            <View style={styles.discard}>
              <Button
                title="Descartar"
                variant="ghost"
                onPress={onDiscard}
                accessibilityHint={`Descarta ${changesLabel(events.length)}`}
              />
            </View>
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
          <CompletionMessage
            body={finish.body}
            notes={finish.notes}
            suffix={
              events.length ? ' As alterações abaixo são salvas antes.' : ''
            }
          />
        ) : null}
        {groupByPlace(model, events).map(group => (
          <View key={group.key} style={styles.group}>
            {group.title ? (
              <Text variant="caption" color="inkMuted">
                {group.title}
              </Text>
            ) : null}
            {group.events.map(e => {
              const { label, change } = describeEvent(model, e)
              return (
                <View
                  key={e.path}
                  accessible
                  accessibilityLabel={`${group.spoken}${label}, ${change}`}
                  style={styles.change}
                >
                  <Text style={styles.flex}>{label}</Text>
                  <Text color="inkMuted">{change}</Text>
                </View>
              )
            })}
          </View>
        ))}
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

interface PlaceGroup {
  readonly key: string
  // "Atributos › Sociais"; vazio para campos fora de seção
  readonly title: string
  // O caminho lido antes do rótulo: "Habilidades, Talentos, "
  readonly spoken: string
  readonly events: SheetEvent[]
}

// Os eventos já vêm na ordem da ficha (draftToEvents): os do mesmo lugar ficam
// juntos. O caminho separa campos de mesmo nome (a Consciência Talento e a
// Virtude) e vem das seções do template, não de nome de campo.
function groupByPlace(
  model: SheetModel,
  events: readonly SheetEvent[]
): PlaceGroup[] {
  const groups: PlaceGroup[] = []
  for (const e of events) {
    const id = parsePath(e.path)?.fieldId
    const place = id ? fieldPlace(model, id) : null
    const parts = place ? [place.section, place.group].filter(Boolean) : []
    const title = parts.join(' › ')
    const last = groups[groups.length - 1]
    // As especializações vêm depois dos valores: o mesmo lugar pode voltar
    if (last && last.title === title) last.events.push(e)
    else
      groups.push({
        key: `${groups.length}:${title}`,
        title,
        spoken: parts.map(p => `${p}, `).join(''),
        events: [e],
      })
  }
  return groups
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: tokens.space[1] },
  discard: { flex: 1, alignItems: 'flex-start' },
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
  // Duas linhas (D-01): o texto em cima, as ações embaixo
  barStacked: {
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
    borderTopWidth: tokens.borderWidth.hair,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  barActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.space[2],
  },
  summary: { gap: tokens.space[2] },
  change: {
    flexDirection: 'row',
    gap: tokens.space[3],
    paddingVertical: tokens.space[1],
  },
})
