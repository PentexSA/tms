import { render, screen, waitFor } from '@testing-library/react-native'
import TodosScreen from '../index'

/**
 * Testes do TodosScreen (tela principal)
 *
 * NOTA: Estes são testes básicos para validar a configuração do Jest com Expo.
 * Os testes focam na estrutura UI do componente, não na lógica de API.
 * Os mocks da API e config estão em test/setup.ts
 */

describe('TodosScreen', () => {
  it('should render the screen title', () => {
    // Act
    render(<TodosScreen />)

    // Assert
    expect(screen.getByText('My Todos')).toBeTruthy()
  })

  it('should render the input placeholder', () => {
    // Act
    render(<TodosScreen />)

    // Assert
    expect(screen.getByPlaceholderText('What needs to be done?')).toBeTruthy()
  })

  it('should render the Add button', () => {
    // Act
    render(<TodosScreen />)

    // Assert
    expect(screen.getByText('Add')).toBeTruthy()
  })

  it('should render FlatList component', async () => {
    // Act
    render(<TodosScreen />)

    // Assert - Verifica que o FlatList está renderizado (via RCTScrollView)
    await waitFor(() => {
      expect(screen.UNSAFE_getByType('RCTScrollView')).toBeTruthy()
    })
  })

  it('should display correct platform label', () => {
    // Act
    render(<TodosScreen />)

    // Assert - Verifica se mostra Web ou Mobile
    const platformLabel = screen.queryByText(/Web|Mobile/)
    expect(platformLabel).toBeTruthy()
  })

  it('should show todos count', async () => {
    // Act
    render(<TodosScreen />)

    // Assert - Verifica que mostra a contagem de itens
    await waitFor(() => {
      expect(screen.getByText(/items/)).toBeTruthy()
    })
  })
})
