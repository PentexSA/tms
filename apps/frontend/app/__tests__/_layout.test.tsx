import { render } from '@testing-library/react-native'
import Layout from '../_layout'

/**
 * Testes do componente Layout (root layout do Expo Router)
 */

describe('Layout', () => {
  it('should render without crashing', () => {
    // Act & Assert
    expect(() => render(<Layout />)).not.toThrow()
  })

  it('should render Stack component', () => {
    // Act
    const { UNSAFE_getByType } = render(<Layout />)

    // Assert
    expect(UNSAFE_getByType('Stack')).toBeTruthy()
  })
})
