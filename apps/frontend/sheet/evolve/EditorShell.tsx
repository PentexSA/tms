import {
  type Help,
  HelpButton,
  HelpText,
  Text,
  tokens,
  useHelp,
  useTheme,
} from '@tms/ui'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

// A linha de um campo em Evoluir (DS: FieldRow com `editor`): rótulo à
// esquerda, controle à direita. O erro (do core, da conta ou do servidor) fica
// na coluna do rótulo, logo abaixo dele, na altura do toque (T-20): embaixo
// de tudo, ele caía fora da tela a 390 px. A linha cresce para baixo.
// Com `help` (a frase do template, R-19), o "?" fica logo depois do rótulo, e
// a frase aberta vai no topo do `below`, na largura da linha.
export function EditorShell({
  label,
  help,
  sub,
  note,
  error,
  children,
  below,
  testID,
}: {
  readonly label: string
  readonly help?: FieldHelp | null
  readonly sub?: string | null
  // Nota da linha sob o rótulo (o custo do próximo ponto na criação)
  readonly note?: ReactNode
  // Texto (vira alerta) ou o aviso já montado (DraftNoticeText)
  readonly error?: ReactNode
  readonly children?: ReactNode
  readonly below?: ReactNode
  readonly testID?: string
}) {
  const { colors } = useTheme()
  const helpState = useHelp()
  return (
    <View
      testID={testID}
      style={[styles.wrap, { borderBottomColor: colors.borderSubtle }]}
    >
      <View style={styles.row}>
        <View
          style={styles.text}
          testID={testID ? `${testID}-label` : undefined}
        >
          {help ? (
            <View style={styles.labelRow}>
              <Text variant="fieldLabel" style={styles.labelText}>
                {label}
              </Text>
              <HelpButton
                subject={help.subject}
                expanded={helpState.expanded}
                onToggle={helpState.toggle}
                controls={helpState.textId}
                testID={testID ? `${testID}-help` : undefined}
              />
            </View>
          ) : (
            <Text variant="fieldLabel">{label}</Text>
          )}
          {sub ? (
            <Text variant="caption" color="inkMuted" numberOfLines={2}>
              {sub}
            </Text>
          ) : null}
          {note || null}
          {typeof error === 'string' && error ? (
            <Text variant="caption" color="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : (
            error || null
          )}
        </View>
        {children}
      </View>
      {help ? (
        <HelpText
          id={helpState.textId}
          text={help.text}
          expanded={helpState.expanded}
        />
      ) : null}
      {below}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: tokens.space[1],
    minHeight: tokens.size.rowMin,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  text: { flex: 1, gap: tokens.space['0.5'] },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[1],
  },
  labelText: { flexShrink: 1 },
})

/** A frase de ajuda de uma linha: o nome do "?" e o texto do template. */
export type FieldHelp = Help

/**
 * A frase de um nome no mapa ao lado da lista (`catalogHelp`, `suggestionHelp`):
 * só propriedade própria, porque o nome vem do texto da ficha.
 */
export function nameHelp(
  map: Readonly<Record<string, string>> | undefined,
  name: string | undefined
): Help | null {
  if (!map || !name || !Object.hasOwn(map, name)) return null
  const text = map[name]
  return typeof text === 'string' && text ? { subject: name, text } : null
}

/** A ajuda do campo, se o template tiver frase (campo sem frase não mostra "?"). */
export function fieldHelp(def: {
  readonly label: string
  readonly help?: string
}): FieldHelp | null {
  return def.help ? { subject: def.label, text: def.help } : null
}
