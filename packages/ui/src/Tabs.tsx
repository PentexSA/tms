import type { ReactNode } from 'react'
import {
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { Pressable } from './Pressable'
import { useRovingFocus } from './roving'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface TabItem {
  readonly id: string
  readonly label: string
  /**
   * Um selo curto abaixo do rótulo ("a seguir"), com um ponto na cor da
   * ação. Nunca só a cor: o texto aparece e entra no nome acessível
   * ("Vantagens, a seguir").
   */
  readonly attention?: string
}

export interface TabsProps {
  readonly items: readonly TabItem[]
  readonly selected: string
  readonly onSelect: (id: string) => void
  readonly accessibilityLabel: string
  /** `sm`: abas de segundo nível (grupos dentro de uma seção), mais discretas. */
  readonly size?: 'md' | 'sm'
  /**
   * Liga cada aba ao painel (`TabPanel` com o mesmo `tabsId`): a aba ganha
   * `nativeID` e a selecionada, `aria-controls`. Único na tela.
   */
  readonly id?: string
}

const tabId = (tabsId: string, tab: string) => `${tabsId}-tab-${tab}`
const panelId = (tabsId: string) => `${tabsId}-panel`

/**
 * Props do painel das abas `tabsId` com a aba `tab` selecionada: no web,
 * `role="tabpanel"` nomeado pela aba. Para quem não pode usar o `TabPanel`
 * (o contêiner já existe, como nos grupos da ficha).
 */
export function tabPanelProps(tabsId: string, tab: string) {
  return {
    nativeID: panelId(tabsId),
    ...(Platform.OS === 'web'
      ? { role: 'tabpanel' as const, 'aria-labelledby': tabId(tabsId, tab) }
      : {}),
  }
}

export interface TabPanelProps {
  /** O `id` das `Tabs` que controlam este painel. */
  readonly tabsId: string
  /** O id da aba selecionada. */
  readonly tab: string
  readonly children: ReactNode
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

/** O conteúdo da aba selecionada (SectionTabs: `role="tabpanel"` no web). */
export function TabPanel({
  tabsId,
  tab,
  children,
  style,
  testID,
}: TabPanelProps) {
  return (
    <View testID={testID} style={style} {...tabPanelProps(tabsId, tab)}>
      {children}
    </View>
  )
}

/**
 * Abas fixas que dividem a largura (as 3 zonas da ficha). Com fonte grande o
 * rótulo quebra em duas linhas; a faixa nunca rola de lado. As `sm` ficam
 * dentro de uma seção, abaixo das da ficha: rótulo menor e traço mais fino.
 *
 * Teclado (web): tabindex itinerante, ← e →, Home e End, com ativação
 * automática (a seta já seleciona: trocar de aba não tem custo). No iOS o
 * papel `tab` não tem traço, então cada aba diz a posição ("aba 2 de 3").
 */
export function Tabs({
  items,
  selected,
  onSelect,
  accessibilityLabel,
  size = 'md',
  id,
}: TabsProps) {
  const { colors } = useTheme()
  const sm = size === 'sm'
  const os = Platform.OS
  const roving = useRovingFocus({
    count: items.length,
    active: items.findIndex(item => item.id === selected),
    orientation: 'horizontal',
    activate: 'focus',
    onActivate: index => {
      const item = items[index]
      if (item) onSelect(item.id)
    },
  })
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.bar, { borderColor: colors.borderSubtle }]}
    >
      {items.map((item, index) => {
        const active = item.id === selected
        return (
          <Pressable
            key={item.id}
            {...roving(index)}
            accessibilityRole="tab"
            accessibilityLabel={
              item.attention ? `${item.label}, ${item.attention}` : item.label
            }
            aria-selected={active}
            {...(id ? { nativeID: tabId(id, item.id) } : {})}
            {...(id && active && os === 'web'
              ? { 'aria-controls': panelId(id) }
              : {})}
            {...(os === 'ios'
              ? {
                  accessibilityValue: {
                    text: `aba ${index + 1} de ${items.length}`,
                  },
                }
              : {})}
            onPress={() => onSelect(item.id)}
            style={[
              styles.tab,
              sm && styles.tabSm,
              active && { borderBottomColor: colors.action },
            ]}
          >
            <Text
              variant={sm ? 'caption' : 'fieldLabel'}
              color={active ? 'ink' : 'inkMuted'}
              style={styles.label}
            >
              {item.label}
            </Text>
            {item.attention ? (
              <View
                style={styles.attention}
                testID={`tab-attention-${item.id}`}
              >
                <View
                  style={[styles.dot, { backgroundColor: colors.action }]}
                />
                <Text variant="caption" color="action">
                  {item.attention}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderBottomWidth: tokens.borderWidth.hair },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    paddingHorizontal: tokens.space[1],
  },
  tabSm: { borderBottomWidth: 2 },
  label: { textAlign: 'center' },
  attention: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[1],
  },
  dot: { width: 6, height: 6, borderRadius: tokens.radius.pill },
})
