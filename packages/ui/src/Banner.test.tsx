import { render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'
import { Banner } from './Banner'

// T-12: com botões, a faixa era uma linha sem quebra e o texto encolhia até
// ~25 px. Agora o texto tem uma base mínima e as ações descem quando falta
// largura. O layout real (390 px: texto em cima, botões embaixo) é conferido
// no E2E (conflict.spec.ts, boundingBox).

const flat = (style: unknown) => StyleSheet.flatten(style as never) ?? {}

describe('Banner com ações', () => {
  it('a linha quebra e o texto tem base mínima, sem encolher até sumir', () => {
    render(
      <Banner
        tone="warning"
        title="A ficha mudou em outro lugar"
        message="Senhor mudou antes de a sua alteração chegar."
        action={<Text>Revisar</Text>}
        testID="b"
      />
    )
    const banner = screen.getByTestId('b')
    expect(flat(banner.props.style)).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'wrap',
    })
    const [text, action] = banner.props.children as {
      props: { style: unknown }
    }[]
    expect(flat(text?.props.style)).toMatchObject({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 200,
      minWidth: 0,
    })
    // A ação não encolhe para dentro do texto: ela é que desce de linha
    expect(flat(action?.props.style)).toMatchObject({ flexShrink: 0 })
    // Com ação, os filhos continuam alcançáveis (não é um elemento só)
    expect(banner.props.accessible).toBe(false)
    expect(screen.getByText('Revisar')).toBeTruthy()
  })

  it('sem ação, é um elemento só com título e mensagem', () => {
    render(
      <Banner tone="info" title="Offline" message="2 pendentes" testID="b" />
    )
    const banner = screen.getByTestId('b')
    expect(banner.props.accessible).toBe(true)
    expect(banner.props.accessibilityLabel).toBe('Offline. 2 pendentes')
    expect(banner.props.children).toHaveLength(2)
    expect(banner.props.children[1]).toBeNull()
  })
})
