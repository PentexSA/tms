import { type ReactNode, useId, useState } from 'react'
import {
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { HelpButton, HelpText, useHelp } from './HelpButton'
import { Pressable } from './Pressable'
import { useRovingFocus } from './roving'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface ChoiceOption {
  readonly id: string
  readonly label: string
  readonly meta?: string
  // Nome acessível por extenso, quando o meta usa abreviações ("For 7").
  readonly spoken?: string
  /** Frase curta de ajuda da opção: um "?" ao lado do rádio (R-19). */
  readonly help?: string
}

export interface ChoiceProps {
  readonly label: string
  readonly options: readonly ChoiceOption[]
  readonly value: string | null
  readonly onChange: (id: string) => void
  readonly testID?: string
  /** Colunas; por padrão, 2 a partir de 8 opções (os 14 clãs). */
  readonly columns?: 1 | 2
  /**
   * Título visível acima do grupo (padrão). Desligue só quando o nome já está
   * na tela, como no título da folha que abre a escolha.
   */
  readonly showLabel?: boolean
  /** Todas as opções sem toque (por exemplo, com um pedido em andamento). */
  readonly disabled?: boolean
  /** Frase de ajuda do grupo: um "?" na linha do título (R-19). */
  readonly help?: string
}

// A partir daqui a lista vira grade, para não rolar uma coluna longa
const GRID_FROM = 8
// Com "?" nas opções, a grade só cabe com células de 240 (o "?" ocupa 44/48)
const GRID_WITH_HELP_MIN = 480

/**
 * Escolha única: radiogroup com um radio marcado (Clã, Natureza...).
 *
 * O título fica visível acima do grupo. Por plataforma: no web, o grupo é
 * nomeado pelo título (`aria-labelledby`); no Android o TalkBack já lê o nome
 * do grupo, e o título fica fora da árvore; no iOS, onde o radiogroup não
 * tem traço, o título é o texto lido logo antes das opções.
 *
 * No web: tabindex itinerante e setas, com ativação manual (a seta só move o
 * foco; Espaço, Enter ou toque escolhem). Vários grupos aplicam a escolha na
 * hora (revelar um NPC, gravar a prioridade), e a seta não pode fazer isso.
 */
export function Choice({
  label,
  options,
  value,
  onChange,
  testID,
  columns = options.length >= GRID_FROM ? 2 : 1,
  showLabel = true,
  disabled = false,
  help,
}: ChoiceProps) {
  const { colors } = useTheme()
  const titleId = `${useId()}-choice-label`
  const withHelp = options.some(o => o.help)
  // Com "?" nas opções, a grade de 2 colunas só a partir de 480 de largura
  // medida (onLayout); abaixo, 1 coluna. Sem frase, a grade de hoje.
  const [width, setWidth] = useState(0)
  const grid = columns === 2 && (!withHelp || width >= GRID_WITH_HELP_MIN)
  const onLayout = withHelp
    ? (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)
    : undefined
  const groupHelp = useHelp()
  const os = Platform.OS
  const roving = useRovingFocus({
    count: options.length,
    active: options.findIndex(o => o.id === value),
    activate: 'manual',
  })
  const group = (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      {...(showLabel && os === 'web' ? { 'aria-labelledby': titleId } : {})}
      onLayout={onLayout}
      style={[styles.group, grid && styles.grid]}
    >
      {options.map((o, i) => {
        const checked = o.id === value
        const radio = (
          <Pressable
            key={o.id}
            {...roving(i)}
            accessibilityRole="radio"
            accessibilityLabel={
              o.spoken ?? (o.meta ? `${o.label}, ${o.meta}` : o.label)
            }
            aria-checked={checked}
            disabled={disabled}
            onPress={() => onChange(o.id)}
            style={[styles.row, o.help ? styles.fill : grid && styles.cell]}
          >
            <View
              style={[
                styles.mark,
                { borderColor: checked ? colors.action : colors.borderControl },
              ]}
            >
              {checked ? (
                <View
                  style={[styles.dot, { backgroundColor: colors.action }]}
                />
              ) : null}
            </View>
            <View style={styles.text}>
              <Text variant="fieldLabel">{o.label}</Text>
              {o.meta ? (
                <Text variant="caption" color="inkMuted">
                  {o.meta}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )
        if (!o.help) return radio
        return (
          <OptionWithHelp
            key={o.id}
            subject={o.label}
            text={o.help}
            style={grid ? styles.cell : undefined}
          >
            {radio}
          </OptionWithHelp>
        )
      })}
    </View>
  )
  if (!showLabel) return group
  const title = (
    <Text
      variant="fieldLabel"
      nativeID={titleId}
      {...(os === 'android' ? { 'aria-hidden': true } : {})}
      style={help ? styles.titleText : undefined}
    >
      {label}
    </Text>
  )
  return (
    <View style={styles.root}>
      {help ? (
        <View style={styles.titleRow}>
          {title}
          <HelpButton
            subject={label}
            expanded={groupHelp.expanded}
            onToggle={groupHelp.toggle}
            controls={groupHelp.textId}
          />
        </View>
      ) : (
        title
      )}
      {help && groupHelp.expanded ? (
        <HelpText id={groupHelp.textId} text={help} />
      ) : null}
      {group}
    </View>
  )
}

// A opção com frase: [rádio (flex 1)][?] e, abaixo, a frase. O "?" é irmão
// do rádio, nunca filho: o nome do rádio não muda.
function OptionWithHelp({
  subject,
  text,
  style,
  children,
}: {
  readonly subject: string
  readonly text: string
  readonly style?: object
  readonly children: ReactNode
}) {
  const { expanded, toggle, textId } = useHelp()
  return (
    <View style={[styles.option, style]}>
      <View style={styles.optionRow}>
        {children}
        <HelpButton
          subject={subject}
          expanded={expanded}
          onToggle={toggle}
          controls={textId}
        />
      </View>
      {expanded ? <HelpText id={textId} text={text} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.space[2] },
  group: { gap: tokens.space[1] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 0 },
  // 50% menos o respiro, para o rótulo não colar na coluna ao lado
  cell: { width: '50%', paddingRight: tokens.space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 12, height: 12, borderRadius: tokens.radius.pill },
  text: { flex: 1 },
  fill: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[1],
  },
  titleText: { flexShrink: 1 },
  option: { gap: tokens.space[1] },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[1],
  },
})
