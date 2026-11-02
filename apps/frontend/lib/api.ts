import { treaty } from '@elysiajs/eden'
import type { App } from '../../api/src/index'
import { API_URL } from './env'
import { createAuthFetch } from './http'
import { session } from './session'

export { fetchWithTimeout, REQUEST_TIMEOUT_MS } from './http'

/**
 * `parseDate: false`: por padrão, o Eden troca por `Date` todo texto da
 * resposta com forma de data. A data civil da sessão ("2026-11-01") vira
 * meia-noite UTC, que é o dia anterior no Brasil, e até texto livre vira
 * `Date` ("01/11/2026" num título). Sem a conversão, toda data chega como
 * texto, como o cache persistido já devolve (T-16).
 *
 * Para mostrar: `civilDate` nas colunas `date`; `shortDate` e `whenLabel`
 * nos instantes. Os tipos inferidos ainda dizem `Date` nos `timestamptz`, então
 * passe por `new Date(x)` antes de chamar qualquer método de data.
 */
export const api = treaty<App>(API_URL, {
  fetcher: createAuthFetch(session) as typeof fetch,
  parseDate: false,
})

/**
 * Eden não lança erro em respostas HTTP de erro (retorna { data, error }).
 * O TanStack Query precisa de uma Promise rejeitada para marcar a query como erro.
 */
export const unwrap = <T>({ data, error }: { data: T; error: unknown }) => {
  if (error) throw error
  return data as NonNullable<T>
}
