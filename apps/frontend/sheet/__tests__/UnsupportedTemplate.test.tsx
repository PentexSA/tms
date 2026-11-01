import { fireEvent, render, screen } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { Linking, Platform } from 'react-native'

import {
  storeUrl,
  UnsupportedTemplate,
  unsupportedShort,
} from '../UnsupportedTemplate'

// L-02: "Atualize o app" sem saída. No web, "Recarregue a página" com o botão
// "Recarregar"; no app, "Voltar" e a loja só quando o app.json tiver um link
// https de loja oficial.

// O app.json do build (Constants.expoConfig), que cada teste ajusta
const mockExpoConfig: { ios?: { appStoreUrl?: string } } = {}
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig
    },
  },
}))

function onPlatform(os: string, run: () => void) {
  const original = Platform.OS
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  try {
    run()
  } finally {
    Object.defineProperty(Platform, 'OS', {
      value: original,
      configurable: true,
    })
  }
}

describe('storeUrl', () => {
  it('aceita https da App Store e do Google Play', () => {
    expect(storeUrl('https://apps.apple.com/br/app/tms/id123')).toBe(
      'https://apps.apple.com/br/app/tms/id123'
    )
    expect(
      storeUrl('https://play.google.com/store/apps/details?id=com.tms.app')
    ).toBe('https://play.google.com/store/apps/details?id=com.tms.app')
  })

  it('recusa outro esquema, outro host e o que não é URL', () => {
    expect(storeUrl('http://apps.apple.com/app/id123')).toBeNull()
    expect(storeUrl('javascript:alert(1)')).toBeNull()
    expect(storeUrl('https://apps.apple.com.evil.example/app')).toBeNull()
    expect(storeUrl('https://evil.example/?apps.apple.com')).toBeNull()
    expect(storeUrl('itms-apps://apps.apple.com/app/id123')).toBeNull()
    expect(storeUrl('não é url')).toBeNull()
    expect(storeUrl(undefined)).toBeNull()
  })
})

describe('UnsupportedTemplate', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
  beforeEach(() => {
    jest.mocked(useRouter).mockReturnValue(router as never)
  })

  it('no app: "Atualize o app", "Voltar" e nenhuma loja sem link configurado', () => {
    render(<UnsupportedTemplate />)
    expect(screen.getByRole('header', { name: 'Atualize o app' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Recarregar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir a loja' })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(router.back).toHaveBeenCalled()
  })

  it('no app, "Voltar" usa a saída da tela quando ela é dada', () => {
    const onBack = jest.fn()
    render(<UnsupportedTemplate onBack={onBack} />)
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(onBack).toHaveBeenCalled()
    expect(router.back).not.toHaveBeenCalled()
  })

  it('no app, com o link da loja no app.json, "Abrir a loja" abre o link', () => {
    const url = 'https://apps.apple.com/br/app/tms/id123'
    mockExpoConfig.ios = { appStoreUrl: url }
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
    try {
      render(<UnsupportedTemplate />)
      fireEvent.press(screen.getByRole('button', { name: 'Abrir a loja' }))
      expect(open).toHaveBeenCalledWith(url)
    } finally {
      delete mockExpoConfig.ios
      open.mockRestore()
    }
  })

  it('no app, link de loja fora da lista não vira botão', () => {
    mockExpoConfig.ios = { appStoreUrl: 'https://evil.example/app' }
    try {
      render(<UnsupportedTemplate />)
      expect(screen.queryByRole('button', { name: 'Abrir a loja' })).toBeNull()
    } finally {
      delete mockExpoConfig.ios
    }
  })

  it('no web: "Recarregue a página" e "Recarregar" recarrega', () => {
    const reload = jest.fn()
    const page = globalThis as { location?: unknown }
    const location = page.location
    page.location = { reload }
    try {
      onPlatform('web', () => {
        render(<UnsupportedTemplate />)
        expect(
          screen.getByRole('header', { name: 'Recarregue a página' })
        ).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull()
        fireEvent.press(screen.getByRole('button', { name: 'Recarregar' }))
      })
      expect(reload).toHaveBeenCalled()
    } finally {
      page.location = location
    }
  })

  it('o texto curto segue a plataforma', () => {
    expect(unsupportedShort('ficha')).toBe(
      'Atualize o app para ver esta ficha.'
    )
    onPlatform('web', () => {
      expect(unsupportedShort('ficha')).toBe(
        'Recarregue a página para ver esta ficha.'
      )
      expect(unsupportedShort('regras')).toMatch(/^As regras .* Recarregue/)
    })
  })
})
