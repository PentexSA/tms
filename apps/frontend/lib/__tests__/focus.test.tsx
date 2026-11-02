import { render } from '@testing-library/react-native'
import { useFocusEffect } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import { useRefetchOnFocus } from '../queries/focus'

// T-06: no web, voltar à janela rebusca (duas janelas lado a lado não
// disparam `visibilitychange`); no nativo, só o foco da tela

const original = Platform.OS
const setOS = (os: typeof Platform.OS) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })

type Listener = () => void
const page = globalThis as unknown as {
  addEventListener?: (type: string, listener: Listener) => void
  removeEventListener?: (type: string, listener: Listener) => void
}
const listeners = new Set<Listener>()
const { addEventListener, removeEventListener } = page

beforeEach(() => {
  // O foco da tela, como o expo-router: roda ao montar e limpa ao desmontar
  jest
    .mocked(useFocusEffect)
    .mockImplementation(effect => useEffect(effect, [effect]))
  page.addEventListener = jest.fn((type, l) => {
    if (type === 'focus') listeners.add(l)
  })
  page.removeEventListener = jest.fn((type, l) => {
    if (type === 'focus') listeners.delete(l)
  })
})
afterEach(() => {
  setOS(original)
  listeners.clear()
  page.addEventListener = addEventListener
  page.removeEventListener = removeEventListener
})

function Probe({ refetch }: { readonly refetch: () => unknown }) {
  useRefetchOnFocus(refetch)
  return null
}

it('no web, o foco da janela rebusca; ao desmontar, o ouvinte sai', () => {
  setOS('web')
  const refetch = jest.fn()
  const view = render(<Probe refetch={refetch} />)
  // O foco da tela, ao montar
  expect(refetch).toHaveBeenCalledTimes(1)
  expect(listeners.size).toBe(1)
  for (const l of listeners) l()
  expect(refetch).toHaveBeenCalledTimes(2)
  view.unmount()
  expect(listeners.size).toBe(0)
})

it('no nativo, só o foco da tela', () => {
  setOS('android')
  const refetch = jest.fn()
  render(<Probe refetch={refetch} />)
  expect(refetch).toHaveBeenCalledTimes(1)
  expect(page.addEventListener).not.toHaveBeenCalled()
})

it('no web sem janela (renderização no servidor), só o foco da tela', () => {
  setOS('web')
  page.addEventListener = undefined
  const refetch = jest.fn()
  render(<Probe refetch={refetch} />)
  expect(refetch).toHaveBeenCalledTimes(1)
})
