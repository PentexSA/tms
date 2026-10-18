import { render } from '@testing-library/react-native'
import type { ComponentType } from 'react'
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
    // test/setup.ts mocka o Stack do expo-router como o host component 'Stack'
    expect(UNSAFE_getByType('Stack' as unknown as ComponentType)).toBeTruthy()
  })
})
