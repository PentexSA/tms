import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock React Native components and APIs
vi.mock('react-native', async () => {
  const RN = await vi.importActual<typeof import('react-native-web')>('react-native-web')

  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
      select: (obj: any) => obj.web || obj.default,
    },
    StyleSheet: {
      ...RN.StyleSheet,
      create: (styles: any) => styles,
    },
  }
})
