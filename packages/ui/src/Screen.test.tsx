import { render, screen } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'
import { Screen } from './Screen'

describe('@tms/ui - Screen', () => {
  it('renders its children', () => {
    render(
      <Screen>
        <Text>Conteúdo</Text>
      </Screen>
    )

    expect(screen.getByText('Conteúdo')).toBeTruthy()
  })

  it('renders without the safe area and with custom style', () => {
    render(
      <Screen safe={false} style={{ padding: 8 }} testID="screen">
        <Text>Conteúdo</Text>
      </Screen>
    )

    expect(screen.getByTestId('screen')).toHaveStyle({ padding: 8 })
  })

  it('limits the width on the web', () => {
    const os = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
      render(
        <Screen testID="screen">
          <Text>Conteúdo</Text>
        </Screen>
      )
      expect(screen.getByTestId('screen')).toHaveStyle({ maxWidth: 1200 })
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
    }
  })
})
