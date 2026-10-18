import { Button } from '@tms/ui'
import { useState } from 'react'
import type { SheetStore } from '../store/sheetStore'
import { DiceSheet } from './DiceSheet'
import { canRoll, type DiceDeps } from './useDice'

/**
 * Entrada do sheet "Dados". Some quando o sistema não usa parada de dados
 * (`roll.model` diferente de pool-success) ou quando o papel não rola.
 */
export function DiceButton({
  characterId,
  store,
  ...deps
}: { readonly characterId: string; readonly store: SheetStore } & DiceDeps) {
  const [open, setOpen] = useState(false)
  if (!canRoll(store)) return null
  const label = store.getState().model.roll.label
  return (
    <>
      <Button title={label} variant="secondary" onPress={() => setOpen(true)} />
      {open ? (
        <DiceSheet
          characterId={characterId}
          store={store}
          visible={open}
          onClose={() => setOpen(false)}
          {...deps}
        />
      ) : null}
    </>
  )
}
