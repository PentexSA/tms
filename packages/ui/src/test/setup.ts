import '@testing-library/jest-dom'

// Mock React Native components and APIs
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native-web')

  return {
    ...RN,
    Platform: {
      OS: 'web',
      select: <T>(obj: Record<string, T>) => obj.web || obj.default,
    },
    StyleSheet: {
      create: <T>(styles: T) => styles,
    },
  }
})
