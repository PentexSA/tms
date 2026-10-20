import { useQueryClient } from '@tanstack/react-query'
import {
  cryptoRandom,
  describePool,
  manualResult,
  type PoolOutcome,
  type PoolPlan,
  type PoolResult,
  planPool,
  poolOptions,
  poolPresets,
  poolRollOf,
  type RandomSource,
  rollPool,
} from '@tms/sheet-core'
import { getRandomValues, randomUUID } from 'expo-crypto'
import { useCallback, useMemo, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import { useStore } from 'zustand'

import { api } from '../../lib/api'
import { messageOf } from '../../lib/errors'
import { sheetKeys } from '../data'
import type { SheetStore } from '../store/sheetStore'
import { commitMessage } from '../useCommit'

// O estado do sheet "Dados" (doc/plano-v0.md, Etapa 21). A prévia e a parada
// saem do mesmo planPool do core que o servidor usa. Com rede, quem rola é o
// servidor (a API nunca aceita resultado do cliente); sem rede, o aparelho
// rola com o CSPRNG do expo-crypto, o resultado fica marcado como local e o
// custo (FdV) vai pela fila como qualquer lote. Um atalho do template
// ("Conjurar efeito") fixa os slots dele; escolher outra opção num desses
// slots desliga o atalho.

/** Uma rolagem desta sessão (a lista do sheet). */
export interface SessionRoll {
  readonly id: string
  readonly label: string
  readonly text: string
  readonly total: number
  readonly outcome: PoolOutcome
  readonly faces: readonly number[]
  readonly difficulty: number
  readonly manual: boolean
  // Rolada no aparelho, sem rede: não está no servidor.
  readonly local: boolean
  readonly announcement: string
}

export interface DiceDeps {
  readonly random?: RandomSource
  readonly uuid?: () => string
}

export interface ManualEntry {
  readonly successes: number
  readonly botch?: boolean
}

const deviceRandom = cryptoRandom(array => getRandomValues(array))

export function useDice(
  characterId: string,
  store: SheetStore,
  deps: DiceDeps = {}
) {
  const random = deps.random ?? deviceRandom
  const uuid = deps.uuid ?? randomUUID
  const queryClient = useQueryClient()
  const { model, roles } = store.getState()
  const roll = poolRollOf(model)
  const values = useStore(store, s => s.values)
  const resolved = useStore(store, s => s.resolved)

  const [slots, setSlots] = useState<Record<string, string>>({})
  const [preset, setPreset] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState(roll?.difficulty.default ?? 6)
  const [specialty, setSpecialty] = useState(false)
  const [boosts, setBoosts] = useState<readonly string[]>([])
  const [rolls, setRolls] = useState<readonly SessionRoll[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(
    () =>
      Object.fromEntries(
        (roll?.slots ?? []).map(slot => [
          slot.id,
          poolOptions(model, resolved, slot, roles),
        ])
      ),
    [model, resolved, roles, roll]
  )
  const presets = useMemo(
    () => poolPresets(model, resolved, roles),
    [model, resolved, roles]
  )
  const active = presets.find(p => p.id === preset) ?? null
  const plan: PoolPlan = useMemo(
    () =>
      planPool(
        model,
        values,
        {
          slots,
          difficulty,
          specialty,
          boosts,
          ...(preset ? { preset } : {}),
        },
        roles
      ),
    [model, values, slots, difficulty, specialty, boosts, preset, roles]
  )

  const record = useCallback((entry: SessionRoll) => {
    setRolls(list => [entry, ...list])
    AccessibilityInfo.announceForAccessibility(entry.announcement)
  }, [])

  const local = useCallback(
    (ready: Extract<PoolPlan, { ok: true }>, manual?: ManualEntry) => {
      const result: PoolResult | null = manual
        ? manualResult(manual.successes, manual.botch ?? false, ready.auto)
        : rollPool(ready, random)
      if (!result) {
        setError('Resultado manual inválido.')
        return
      }
      if (ready.events.length) {
        const paid = store
          .getState()
          .commit(ready.events, `${ready.label}: custo da rolagem`)
        if (!paid.ok) {
          setError(commitMessage(paid))
          return
        }
      }
      record({
        id: uuid(),
        label: ready.label,
        text: result.text,
        total: result.total,
        outcome: result.outcome,
        faces: result.faces,
        difficulty: ready.difficulty,
        manual: Boolean(manual),
        local: true,
        announcement: `${ready.label}: ${describePool(result)} Rolado no aparelho, sem rede.`,
      })
    },
    [random, record, store, uuid]
  )

  const submit = useCallback(
    async (manual?: ManualEntry) => {
      if (!plan.ok || busy) return
      setBusy(true)
      setError(null)
      try {
        const res = await api.characters({ id: characterId }).rolls.post({
          clientRollId: uuid(),
          slots,
          difficulty,
          specialty,
          boosts: [...boosts],
          ...(preset ? { preset } : {}),
          ...(manual ? { manual } : {}),
        })
        if (res.error) {
          setError(messageOf(res.error, 'Não foi possível rolar.'))
          return
        }
        const { roll: r, sheet, sheetVersion } = res.data
        // O custo (FdV) foi pago no servidor: a ficha nova entra no store e
        // no cache
        store.getState().received(sheet, sheetVersion)
        queryClient.setQueryData<{ sheet: unknown; sheetVersion: number }>(
          sheetKeys.character(characterId),
          old =>
            old && sheetVersion >= old.sheetVersion
              ? { ...old, sheet, sheetVersion }
              : old
        )
        const result = {
          faces: r.faces,
          text: r.text,
        } as PoolResult
        record({
          id: r.id,
          label: r.label,
          text: r.text,
          total: r.total,
          outcome: r.outcome as PoolOutcome,
          faces: r.faces,
          difficulty: r.difficulty,
          manual: r.manual,
          local: false,
          announcement: `${r.label}: ${describePool(result)}`,
        })
      } catch {
        // Sem rede: rola no aparelho
        local(plan, manual)
      } finally {
        setBusy(false)
      }
    },
    [
      plan,
      busy,
      characterId,
      uuid,
      slots,
      difficulty,
      specialty,
      boosts,
      preset,
      store,
      queryClient,
      record,
      local,
    ]
  )

  return {
    roll,
    options,
    plan,
    slots,
    presets,
    preset: active,
    // Ligar um atalho põe as opções dele nos slots; tocar de novo desliga
    togglePreset: (id: string) => {
      const next = presets.find(p => p.id === id && p.available)
      if (!next || preset === id) {
        setPreset(null)
        return
      }
      setPreset(id)
      setSlots(s => ({
        ...s,
        ...Object.fromEntries(
          Object.entries(next.slots).map(([slot, o]) => [slot, o.key])
        ),
      }))
    },
    choose: (slot: string, key: string | null) => {
      if (active && Object.hasOwn(active.slots, slot)) setPreset(null)
      setSlots(s => {
        const next = { ...s }
        if (key) next[slot] = key
        else delete next[slot]
        return next
      })
    },
    difficulty,
    setDifficulty,
    specialty,
    setSpecialty,
    boosts,
    toggleBoost: (id: string) =>
      setBoosts(b => (b.includes(id) ? b.filter(x => x !== id) : [...b, id])),
    rolls,
    busy,
    error,
    rollInApp: () => submit(),
    rolledByHand: (entry: ManualEntry) => submit(entry),
  }
}

/** Dados existe neste sistema e este papel pode rolar (dono e narrador). */
export const canRoll = (store: SheetStore): boolean => {
  const { model, roles } = store.getState()
  return (
    poolRollOf(model) !== null &&
    (roles.includes('owner') || roles.includes('storyteller'))
  )
}
