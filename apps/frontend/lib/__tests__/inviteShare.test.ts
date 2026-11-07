import * as Clipboard from 'expo-clipboard'
import { Platform, Share } from 'react-native'

import { canShareNatively, copyText, shareMessage } from '../invite/share'

// P12, T-44: compartilhar em qualquer navegador, sem rejeição solta.
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))

const MESSAGE = 'Você foi convidado para a crônica "Teste" no TMS.'
const os = Platform.OS
const page = globalThis as { navigator?: unknown }
const originalNavigator = page.navigator
const setOS = (value: typeof Platform.OS) =>
  Object.defineProperty(Platform, 'OS', { value, configurable: true })
const withError = (name: string) =>
  Object.assign(new Error(name), { name }) as Error

afterEach(() => {
  setOS(os)
  page.navigator = originalNavigator
  jest.restoreAllMocks()
  jest.mocked(Clipboard.setStringAsync).mockReset()
})

describe('canShareNatively', () => {
  it('no app, sempre', () => {
    setOS('android')
    expect(canShareNatively()).toBe(true)
  })

  it('no web, só com navigator.share e canShare que não recusa', () => {
    setOS('web')
    page.navigator = {}
    expect(canShareNatively(MESSAGE)).toBe(false)
    page.navigator = { share: jest.fn() }
    expect(canShareNatively(MESSAGE)).toBe(true)
    page.navigator = { share: jest.fn(), canShare: () => false }
    expect(canShareNatively(MESSAGE)).toBe(false)
    page.navigator = {
      share: jest.fn(),
      canShare: () => {
        throw new TypeError('x')
      },
    }
    expect(canShareNatively(MESSAGE)).toBe(false)
  })
})

describe('shareMessage no web', () => {
  // Uma rejeição sem tratamento viraria pageerror
  const unhandled = jest.fn()
  beforeAll(() => process.on('unhandledRejection', unhandled))
  afterAll(() => process.off('unhandledRejection', unhandled))
  beforeEach(() => {
    unhandled.mockClear()
    setOS('web')
  })

  it('com Web Share: só o texto', async () => {
    const share = jest.fn().mockResolvedValue(undefined)
    page.navigator = { share }
    expect(await shareMessage(MESSAGE)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: MESSAGE })
  })

  it('a pessoa fecha (AbortError): nada a fazer, sem copiar', async () => {
    page.navigator = {
      share: jest.fn().mockRejectedValue(withError('AbortError')),
    }
    expect(await shareMessage(MESSAGE)).toBe('dismissed')
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
  })

  it('NotAllowedError: copia a mensagem', async () => {
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true)
    page.navigator = {
      share: jest.fn().mockRejectedValue(withError('NotAllowedError')),
    }
    expect(await shareMessage(MESSAGE)).toBe('copied')
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(MESSAGE)
  })

  it('sem Web Share e sem cópia: "failed", nunca rejeita', async () => {
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(false)
    page.navigator = {}
    expect(await shareMessage(MESSAGE)).toBe('failed')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(unhandled).not.toHaveBeenCalled()
  })
})

describe('shareMessage no app', () => {
  it('Share.share com a mensagem; fechar é "dismissed"', async () => {
    setOS('ios')
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValueOnce({
        action: 'sharedAction',
        activityType: undefined,
      })
      .mockResolvedValueOnce({
        action: Share.dismissedAction,
        activityType: undefined,
      })
    expect(await shareMessage(MESSAGE)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ message: MESSAGE })
    expect(await shareMessage(MESSAGE)).toBe('dismissed')
  })

  it('erro do sistema: copia', async () => {
    setOS('android')
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('x'))
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true)
    expect(await shareMessage(MESSAGE)).toBe('copied')
  })
})

describe('copyText', () => {
  it('true, false ou erro', async () => {
    jest.mocked(Clipboard.setStringAsync).mockResolvedValueOnce(true)
    expect(await copyText('x')).toBe(true)
    jest.mocked(Clipboard.setStringAsync).mockResolvedValueOnce(false)
    expect(await copyText('x')).toBe(false)
    jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error('x'))
    expect(await copyText('x')).toBe(false)
  })
})
