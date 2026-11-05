import { useCallback, useEffect, useId, useState } from 'react'
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'
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
  readonly testID?: string
}

/**
 * A frase expandida. Sempre texto puro, num Text: o template nunca desenha
 * HTML nem link. Ao aparecer, é anunciada: região viva no web e no Android;
 * no iOS, onde não há região viva, pelo announceForAccessibility.
 */
export function HelpText({ id, text, testID }: HelpTextProps) {
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text)
  }, [text])
  const os = Platform.OS
  return (
    <Text
      testID={testID}
      nativeID={id}
      variant="caption"
      color="inkMuted"
      {...(os === 'web' ? { 'aria-live': 'polite' as const } : {})}
      {...(os === 'android'
        ? { accessibilityLiveRegion: 'polite' as const }
        : {})}
      style={styles.text}
    >
      {text}
    </Text>
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
})
