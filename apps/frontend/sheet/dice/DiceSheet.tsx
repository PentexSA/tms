import type { PoolOption, RefusalCode, RollSlot } from '@tms/sheet-core'
import {
  Banner,
  BottomSheet,
  Button,
  Chip,
  ListItem,
  markSoftDisabled,
  Pressable,
  SectionHeader,
  Stepper,
  Text,
  TextField,
  tokens,
} from '@tms/ui'
import { type ComponentRef, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'
import { blockedBy, blockedNote, useLifecycle } from '../policy'
import type { SheetStore } from '../store/sheetStore'
import { matches } from './fold'
import { type DiceDeps, type SessionRoll, useDice } from './useDice'

// O sheet "Dados" (doc/plano-v0.md, Etapa 21; protótipo: design/telas). Os
// slots, a dificuldade, a especialização e os boosts vêm do `roll` do
// template; nada aqui conhece Vampiro nem Mago. Os atalhos (`roll.presets`)
// ficam no topo, e a ajuda do atalho ligado aparece embaixo da dificuldade.

export interface DiceSheetProps extends DiceDeps {
  readonly characterId: string
  readonly store: SheetStore
  readonly visible: boolean
  readonly onClose: () => void
}

export function DiceSheet({
  characterId,
  store,
  visible,
  onClose,
  ...deps
}: DiceSheetProps) {
  const dice = useDice(characterId, store, deps)
  // O gasto da rolagem segue a política do Jogo (T-77): na ficha travada, o
  // servidor recusa o custo (SHEET_LOCKED), e a rolagem sem gasto passa. O
  // boost fica bloqueado e tocável, com o motivo; o narrador nunca é barrado
  const lifecycle = useLifecycle()
  const costBlocked = blockedBy(
    new Set(store.getState().roles),
    lifecycle,
    'play'
  )
  const boostNote = costBlocked ? boostRefusal(costBlocked) : null
  const [manual, setManual] = useState<{
    successes: number
    botch: boolean
  } | null>(null)
  const { roll, plan } = dice
  if (!roll) return null
  const ready = plan.ok
  const hasSpecialty =
    roll.specialty === 'tenCountsDouble' &&
    Object.entries(dice.slots).some(([slot, key]) =>
      dice.options[slot]?.some(o => o.key === key && o.specialty)
    )
  const last = dice.rolls[0]

  return (
    <BottomSheet
      visible={visible}
      title={roll.label}
      onClose={onClose}
      footer={
        manual ? (
          <>
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setManual(null)}
            />
            <Button
              title="Registrar"
              disabled={!ready}
              busy={dice.busy}
              onPress={() => {
                void dice.rolledByHand(manual)
                setManual(null)
              }}
            />
          </>
        ) : (
          <>
            <Button
              title="Rolei na mão"
              variant="secondary"
              disabled={!ready}
              onPress={() => setManual({ successes: 0, botch: false })}
            />
            <Button
              title="Rolar no app"
              disabled={!ready}
              busy={dice.busy}
              onPress={() => void dice.rollInApp()}
            />
          </>
        )
      }
    >
      <View style={styles.body}>
        {dice.storyteller ? (
          <View style={styles.secret}>
            <Chip
              kind="switch"
              label="Rolagem oculta"
              selected={dice.hidden}
              onPress={() => dice.setHidden(!dice.hidden)}
            />
            {dice.hidden && plan.ok && plan.events.length ? (
              <Text variant="caption" color="inkMuted">
                O custo ainda altera a ficha, mas esta rolagem e seu lote não
                aparecem no histórico do jogador.
              </Text>
            ) : null}
          </View>
        ) : null}
        {dice.presets.length ? (
          <View
            role="group"
            aria-label="Atalhos"
            testID="dice-presets"
            style={styles.presets}
          >
            {dice.presets
              .filter(p => p.available)
              .map(p => (
                <Chip
                  key={p.id}
                  label={p.label}
                  selected={dice.preset?.id === p.id}
                  onPress={() => dice.togglePreset(p.id)}
                />
              ))}
          </View>
        ) : null}
        {roll.slots.map(slot => (
          <SlotPicker
            key={slot.id}
            slot={slot}
            options={dice.options[slot.id] ?? []}
            value={dice.slots[slot.id] ?? null}
            onChange={key => dice.choose(slot.id, key)}
          />
        ))}

        <Stepper
          label="Dificuldade"
          showLabel
          value={dice.difficulty}
          min={roll.difficulty.min}
          max={Math.min(roll.difficulty.max, roll.die ?? 10)}
          onChange={dice.setDifficulty}
          size="sheet"
        />
        {dice.preset?.help ? (
          <Text variant="caption" color="inkMuted" testID="preset-help">
            {dice.preset.help}
          </Text>
        ) : null}
        {hasSpecialty ? (
          <Toggle
            label="Usar especialização (10 conta 2 sucessos)"
            checked={dice.specialty}
            onChange={dice.setSpecialty}
          />
        ) : null}
        {(roll.boosts ?? []).map(b => (
          <Toggle
            key={b.id}
            label={b.label}
            checked={dice.boosts.includes(b.id)}
            onChange={() => dice.toggleBoost(b.id)}
            blocked={boostNote}
          />
        ))}

        {ready ? (
          <View
            accessible
            accessibilityLabel={`Parada: ${plan.dice} ${plan.dice === 1 ? 'dado' : 'dados'}${plan.modifiers.length ? `. ${plan.modifiers.map(m => `${m.label}: ${m.change}`).join('. ')}` : ''}`}
            style={styles.pool}
          >
            <Text variant="title">{`${plan.label}: ${plan.dice} ${plan.dice === 1 ? 'dado' : 'dados'}`}</Text>
            {plan.modifiers.map(m => (
              <Text key={`${m.label}-${m.change}`} color="inkMuted">
                {`${m.label}: ${m.change}`}
              </Text>
            ))}
          </View>
        ) : plan.kind !== 'incomplete' ? (
          <Banner tone="warning" message={capitalize(plan.reason)} />
        ) : null}

        {manual ? (
          <View style={styles.manual}>
            <Stepper
              label="Sucessos nos dados"
              showLabel
              value={manual.successes}
              min={0}
              max={50}
              onChange={successes =>
                setManual(m => ({
                  successes,
                  botch: successes > 0 ? false : (m?.botch ?? false),
                }))
              }
              size="sheet"
            />
            {manual.successes === 0 ? (
              <Toggle
                label="Falha crítica"
                checked={manual.botch}
                onChange={botch => setManual(m => (m ? { ...m, botch } : m))}
              />
            ) : null}
          </View>
        ) : null}

        {dice.error ? <Banner tone="danger" message={dice.error} /> : null}

        <View aria-live="polite" style={styles.result}>
          {last ? <RollResult roll={last} /> : null}
        </View>

        {dice.rolls.length > 1 ? (
          <View>
            <SectionHeader title="Nesta sessão" level="group" />
            {dice.rolls.slice(1).map(r => (
              <ListItem
                key={r.id}
                title={r.label}
                subtitle={tagsOf(r)}
                meta={r.text}
              />
            ))}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const tagsOf = (r: SessionRoll) =>
  [
    `dificuldade ${r.difficulty}`,
    r.manual ? 'na mão' : null,
    r.local ? 'no aparelho, sem rede' : null,
  ]
    .filter(Boolean)
    .join(' · ')

function RollResult({ roll }: { readonly roll: SessionRoll }) {
  return (
    <View
      accessible
      accessibilityLabel={roll.announcement}
      style={styles.resultCard}
    >
      <Text variant="displayXl">{roll.text}</Text>
      {roll.faces.length ? (
        <Text color="inkMuted">{`Dados: ${roll.faces.join(' · ')}`}</Text>
      ) : null}
      <Text variant="caption" color="inkMuted">
        {tagsOf(roll)}
      </Text>
    </View>
  )
}

function SlotPicker({
  slot,
  options,
  value,
  onChange,
}: {
  readonly slot: RollSlot
  readonly options: readonly PoolOption[]
  readonly value: string | null
  readonly onChange: (key: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const chosen = options.find(o => o.key === value)
  const visible = options.filter(o => matches(o.label, query))
  const label = slot.label.toLowerCase()
  return (
    <View>
      <ListItem
        title={slot.label}
        subtitle={chosen ? `${chosen.label} · ${chosen.value}` : 'Escolher'}
        accessibilityLabel={`${slot.label}: ${chosen ? `${chosen.label}, ${chosen.value}` : 'nenhum'}${slot.optional ? ' (opcional)' : ''}`}
        onPress={() => setOpen(o => !o)}
      />
      {open ? (
        <View style={styles.picker}>
          <TextField
            label={`Buscar ${label}`}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {slot.optional && value ? (
            <ListItem
              title="Nenhum"
              onPress={() => {
                onChange(null)
                setOpen(false)
              }}
            />
          ) : null}
          {visible.map(o => (
            <ListItem
              key={o.key}
              title={o.label}
              subtitle={[o.group, o.specialty, ...o.modifiers]
                .filter(Boolean)
                .join(' · ')}
              meta={String(o.value)}
              accessibilityLabel={`${o.label}, ${o.value}${o.specialty ? `, especialização ${o.specialty}` : ''}${o.modifiers.length ? `, ${o.modifiers.join(', ')}` : ''}`}
              onPress={() => {
                onChange(o.key)
                setOpen(false)
                setQuery('')
              }}
            />
          ))}
          {visible.length === 0 ? (
            <Text color="inkMuted">{`Nada encontrado para “${query}”.`}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/** O motivo de o boost não valer agora, perto do toque. */
const boostRefusal = (code: RefusalCode): string =>
  code === 'SHEET_LOCKED'
    ? 'O narrador travou a ficha: a rolagem sai sem gastar.'
    : `${blockedNote(code)} A rolagem sai sem gastar.`

function Toggle({
  label,
  checked,
  onChange,
  blocked = null,
}: {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (next: boolean) => void
  /**
   * O motivo de não ligar agora (a política recusaria o gasto). A caixa fica
   * com a cara de bloqueada e tocável: o toque não liga e repete o motivo.
   * Desligar continua valendo (o boost ligado antes da trava).
   */
  readonly blocked?: string | null
}) {
  const web = Platform.OS === 'web'
  const soft = blocked !== null
  const [alerted, setAlerted] = useState(false)
  const ref = useRef<ComponentRef<typeof View>>(null)
  // No web, o aria-disabled vai direto no elemento (markSoftDisabled): o
  // react-native-web tiraria o toque e o foco
  useEffect(() => {
    if (web) markSoftDisabled(ref.current, soft)
  }, [web, soft])
  return (
    <View style={styles.toggleBox}>
      <Pressable
        ref={ref}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        aria-checked={checked}
        {...(soft && !web ? { 'aria-disabled': true } : {})}
        {...(soft ? { accessibilityHint: blocked } : {})}
        onPress={() => {
          if (blocked !== null && !checked) {
            setAlerted(true)
            AccessibilityInfo.announceForAccessibility(blocked)
            return
          }
          onChange(!checked)
        }}
        style={[styles.toggle, soft && styles.blocked]}
      >
        <Text>{checked ? '☑' : '☐'}</Text>
        <Text style={styles.toggleLabel}>{label}</Text>
      </Pressable>
      {soft ? (
        <Text
          variant="caption"
          color="inkMuted"
          {...(alerted ? { accessibilityRole: 'alert' as const } : {})}
        >
          {blocked}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.space[3], paddingBottom: tokens.space[4] },
  secret: { gap: tokens.space[2], alignItems: 'flex-start' },
  picker: { gap: tokens.space[2], paddingLeft: tokens.space[3] },
  pool: { gap: tokens.space[1] },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  manual: { gap: tokens.space[2] },
  result: { minHeight: tokens.space[2] },
  resultCard: { gap: tokens.space[1], alignItems: 'flex-start' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
  },
  toggleLabel: { flex: 1 },
  toggleBox: { gap: tokens.space[1] },
  blocked: { opacity: 0.5 },
})
