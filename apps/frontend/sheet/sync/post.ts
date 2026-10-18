import { api } from '../../lib/api'
import { isNetworkError } from '../../lib/errors'
import type { QueuedBatch } from './outbox'
import type { PostOutcome } from './sender'

// O envio de um lote pela sessão (o fetch renova o token num 401). Só o lote
// vai: o rótulo do aviso fica no aparelho.
export async function postEvents(
  characterId: string,
  batch: QueuedBatch
): Promise<PostOutcome> {
  const res = await api.characters({ id: characterId }).events.post({
    clientBatchId: batch.clientBatchId,
    events: batch.events.map(e => ({ path: e.path, from: e.from, to: e.to })),
  })
  // Sem resposta HTTP, o Eden devolve 503 (lib/errors.ts): para a fila e o
  // indicador, isso é rede (status 0), não erro do servidor
  if (!res.response || isNetworkError(res.error))
    return { status: 0, body: null }
  const seconds = Number(new Headers(res.headers).get('retry-after') ?? '')
  return {
    status: res.status,
    body: res.error ? res.error.value : res.data,
    retryAfterMs:
      Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined,
  }
}
