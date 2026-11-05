import { type ReactNode, useCallback, useEffect, useId, useState } from 'react'
import {
  AccessibilityInfo,
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

// O "?" da ajuda contextual (R-19, D-11). Padrão disclosure: um botão que
// expande uma frase curta logo abaixo do que ela explica, na própria linha.
// Sem tooltip (não existe no toque) e sem folha (a lista de escolha já está
// numa folha, e uma folha sobre outra fecharia a escolha).

export interface HelpButtonProps {
  /** O que a frase explica: o nome acessível é "Ajuda: <subject>". */
  readonly subject: string
  readonly expanded: boolean
  readonly onToggle: () => void
  /** Id do HelpText que o botão controla (aria-controls, só no web). */
  readonly controls?: string
  readonly testID?: string
}

/**
 * Botão "?" com alvo mínimo (44, ou 48 no Android) e o estado de expandido.
 * Fica sempre ao lado do controle que explica, nunca dentro dele: botão
 * dentro de rádio não é aceito pelo ARIA, e no app viraria um alvo dentro de
 * outro.
 */
export function HelpButton({
  subject,
  expanded,
  onToggle,
  controls,
  testID,
}: HelpButtonProps) {
  const { colors } = useTheme()
  const web = Platform.OS === 'web'
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Ajuda: ${subject}`}
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      {...(web && controls ? { 'aria-controls': controls } : {})}
      onPress={onToggle}
      style={styles.button}
    >
      <View
        style={[
          styles.circle,
          {
            borderColor: expanded ? colors.action : colors.borderControl,
            backgroundColor: expanded ? colors.surface : 'transparent',
          },
        ]}
        accessible={false}
        aria-hidden
      >
        <Text
          variant="caption"
          color={expanded ? 'action' : 'inkMuted'}
          accessible={false}
          aria-hidden
        >
          ?
        </Text>
      </View>
    </Pressable>
  )
}

export interface HelpTextProps {
  readonly id: string
  readonly text: string
  /** Aberta: a frase aparece. Fechada: o contêiner fica montado e vazio. */
  readonly expanded: boolean
  readonly testID?: string
  readonly style?: StyleProp<ViewStyle>
}

/**
 * A região da frase. O contêiner fica sempre montado, vazio quando fechado,
 * e só o conteúdo muda: a região viva já existe quando a frase entra, então
 * o web e o Android a anunciam, e o `aria-controls` do botão sempre aponta
 * um elemento que existe. No iOS, onde não há região viva, a frase é
 * anunciada ao abrir. Fechado, o contêiner sai do fluxo (absoluto e sem
 * tamanho), para não somar o `gap` do pai. Sempre texto puro, num Text: o
 * template nunca desenha HTML nem link.
 */
export function HelpText({ id, text, expanded, testID, style }: HelpTextProps) {
  useEffect(() => {
    if (expanded && Platform.OS === 'ios')
      AccessibilityInfo.announceForAccessibility(text)
  }, [expanded, text])
  const os = Platform.OS
  return (
    <View
      testID={testID}
      nativeID={id}
      {...(os === 'web' ? { 'aria-live': 'polite' as const } : {})}
      {...(os === 'android'
        ? { accessibilityLiveRegion: 'polite' as const }
        : {})}
      style={expanded ? style : styles.closed}
    >
      {expanded ? (
        <Text variant="caption" color="inkMuted" style={styles.text}>
          {text}
        </Text>
      ) : null}
    </View>
  )
}

export interface HelpState {
  readonly expanded: boolean
  readonly toggle: () => void
  /** Id para o HelpText e o aria-controls do HelpButton. */
  readonly textId: string
}

/** Estado de um "?" para quem monta o botão e a frase em lugares diferentes da linha. */
export function useHelp(): HelpState {
  const [expanded, setExpanded] = useState(false)
  const textId = `${useId()}-help`
  const toggle = useCallback(() => setExpanded(e => !e), [])
  return { expanded, toggle, textId }
}

/** A frase de ajuda de um nó: o nome do "?" e o texto. */
export interface Help {
  readonly subject: string
  readonly text: string
}

export interface WithHelpProps {
  /** Sem frase, só o conteúdo, sem "?". */
  readonly help: Help | null | undefined
  /** O rótulo, o botão da linha ou o título; vazio, só o "?". */
  readonly children?: ReactNode
  /** O conteúdo ocupa o resto da linha, e o "?" fica na ponta. */
  readonly fill?: boolean
  readonly testID?: string
  readonly style?: StyleProp<ViewStyle>
  /** Onde a frase aberta fica (o respiro lateral, por exemplo). */
  readonly textStyle?: StyleProp<ViewStyle>
}

/**
 * A composição de todo "?": [conteúdo][?] numa linha e, abaixo, a frase.
 * O "?" é irmão do conteúdo, nunca filho dele: o nome do botão ou do rádio
 * da linha não muda.
 */
export function WithHelp({
  help,
  children,
  fill,
  testID,
  style,
  textStyle,
}: WithHelpProps) {
  const state = useHelp()
  if (!help) return <>{children}</>
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        {children != null ? (
          <View style={fill ? styles.fill : styles.shrink}>{children}</View>
        ) : null}
        <HelpButton
          subject={help.subject}
          expanded={state.expanded}
          onToggle={state.toggle}
          controls={state.textId}
          testID={testID}
        />
      </View>
      <HelpText
        id={state.textId}
        text={help.text}
        expanded={state.expanded}
        style={textStyle}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flexShrink: 1 },
  closed: { position: 'absolute', width: 0, height: 0, overflow: 'hidden' },
  wrap: { gap: tokens.space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[1] },
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
})
