import {
  applyBatch,
  type RoleName,
  type SheetData,
  type SheetMode,
  type SheetModel,
} from '@tms/sheet-core'
import { useEffect, useState } from 'react'
import { SheetView } from '../sheet/SheetView'
import { createSheetStore, type SheetStore } from '../sheet/store/sheetStore'
import type { QueuedBatch } from '../sheet/sync/outbox'
import { useSync } from '../sheet/sync/SyncProvider'
import type { PostOutcome } from '../sheet/sync/sender'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from './session'

// A ficha viva dos testes de tela: store por ficha ligado à fila de teste,
// com o modo inicial e os papéis que o teste quiser.

export const LIVE_ID = '00000000-0000-4000-8000-00000000c001'

export interface LiveProps {
  readonly model: SheetModel
  readonly sheet: SheetData
  readonly roles?: readonly RoleName[]
  readonly mode?: SheetMode
  readonly onStore?: (store: SheetStore) => void
}

export function Live({
  model,
  sheet,
  roles = ['owner'],
  mode,
  onStore,
}: LiveProps) {
  const sync = useSync()
  const [store] = useState(() => {
    const created = createSheetStore({
      characterId: LIVE_ID,
      model,
      sheet,
      sheetVersion: 1,
      roles,
      mode,
      sync,
    })
    if (mode === 'evolve') created.getState().startDraft()
    return created
  })
  useEffect(() => sync.register(LIVE_ID, store), [sync, store])
  onStore?.(store)
  return <SheetView store={store} editable />
}

/** Um servidor que aplica o lote como o de verdade (o mesmo applyBatch). */
export function fakeServer(model: SheetModel, start: SheetData) {
  let sheet = start
  let version = 1
  const sent: QueuedBatch[] = []
  const post = jest.fn(
    async (_id: string, batch: QueuedBatch): Promise<PostOutcome> => {
      sent.push(batch)
      const r = applyBatch(model, sheet, batch, ['owner'])
      if (!r.ok) return { status: 422, body: { issues: r.issues } }
      sheet = r.sheet
      version++
      return { status: 200, body: { sheetVersion: version, sheet } }
    }
  )
  return { post, sent, current: () => sheet }
}

export async function renderLive(
  props: LiveProps,
  post: (id: string, batch: QueuedBatch) => Promise<PostOutcome>
) {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  let store: SheetStore | undefined
  const result = renderWithSession(
    <Live
      {...props}
      onStore={s => {
        store = s
        props.onStore?.(s)
      }}
    />,
    session,
    { post }
  )
  return {
    ...result,
    store: () => {
      if (!store) throw new Error('store não criado')
      return store
    },
  }
}
