import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react-native'
import { hasNativeHttpCache, purgeHttpCache } from '../../modules/http-cache'
import { json, memoryStore, testSession, tokens } from '../../test/session'
import { createAuthFetch } from '../http'
import { SessionProvider } from '../session/SessionProvider'

// T-13: o NSURLCache (iOS) e o OkHttp (Android) gravavam em disco, em
// claro, as respostas da API com tokens e dados ocultos, e elas ficavam
// depois do logout (QAA-02).

describe('no-store na requisição', () => {
  it('no nativo, toda requisição da sessão pede no-store', async () => {
    const { session, fetch } = testSession(() => json(200, tokens()))
    await session.login('ana@example.test', 'senha longa o bastante')
    await session.logout()
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [, init] of fetch.mock.calls as [string, RequestInit][])
      expect(new Headers(init.headers).get('cache-control')).toBe('no-store')
  })

  it('no nativo, toda chamada à API pede no-store', async () => {
    const base = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 200 })
    )
    const authFetch = createAuthFetch(
      {
        headers: () => ({ authorization: 'Bearer a1' }),
        credentials: 'omit',
        refresh: async () => true,
      },
      base
    )
    await authFetch('http://api.test/chronicles', { method: 'GET' })
    const init = base.mock.calls[0]?.[1] as RequestInit | undefined
    expect(new Headers(init?.headers).get('cache-control')).toBe('no-store')
  })

  it('no web, não (o header sairia do safelist e pediria preflight)', () => {
    // O jest-expo resolve './noStore' para o .native; o web é o .ts puro
    const { NO_STORE_HEADERS } = require('../noStore.ts') as {
      NO_STORE_HEADERS: Record<string, string>
    }
    expect(NO_STORE_HEADERS).toEqual({})
  })
})

describe('purga do cache HTTP do aparelho', () => {
  it('sair purga o cache HTTP', async () => {
    const { session } = testSession(
      url =>
        url.endsWith('/auth/logout')
          ? new Response(null, { status: 204 })
          : json(200, tokens()),
      memoryStore(true, 'refresh-0')
    )
    const purge = jest.fn(async () => undefined)
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider session={session} purgeHttpCache={purge}>
          {null}
        </SessionProvider>
      </QueryClientProvider>
    )
    await waitFor(() => expect(session.getState().status).toBe('signedIn'))
    expect(purge).not.toHaveBeenCalled()
    await session.logout()
    expect(purge).toHaveBeenCalledTimes(1)
  })

  it('sem o módulo nativo (web, Expo Go, Jest), a purga é no-op', async () => {
    expect(hasNativeHttpCache).toBe(false)
    await expect(purgeHttpCache()).resolves.toBeUndefined()
  })

  it('o módulo existe para iOS e Android e roda na abertura', () => {
    const dir = join(__dirname, '../../modules/http-cache')
    const config = JSON.parse(
      readFileSync(join(dir, 'expo-module.config.json'), 'utf8')
    ) as {
      platforms: string[]
      apple: { modules: string[]; appDelegateSubscribers: string[] }
      android: { modules: string[] }
    }
    expect(config.platforms).toEqual(['apple', 'android'])
    expect(config.apple.appDelegateSubscribers).toEqual([
      'HttpCacheAppDelegateSubscriber',
    ])
    const swift = readFileSync(join(dir, 'ios/HttpCache.swift'), 'utf8')
    expect(swift).toContain('diskCapacity: 0')
    expect(swift).toContain('removeAllCachedResponses()')
    const kotlin = readFileSync(
      join(dir, 'android/src/main/java/expo/modules/tmshttpcache/HttpCache.kt'),
      'utf8'
    )
    // O OkHttp sem Cache (o construtor sem Context) e a pasta apagada
    expect(kotlin).toContain('createClientBuilder().build()')
    expect(kotlin).toContain('"http-cache"')
    const packageKt = readFileSync(
      join(
        dir,
        'android/src/main/java/expo/modules/tmshttpcache/HttpCachePackage.kt'
      ),
      'utf8'
    )
    expect(packageKt).toContain('override fun onCreate')
  })
})
