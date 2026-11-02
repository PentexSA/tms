import { isDraftMode, type SheetMode } from '@tms/sheet-core'
import { BottomSheet, Button, Text, tokens, useToast } from '@tms/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useStore } from 'zustand'
import { planDraftRestore, type RestorePlan } from './store/draftRestore'
import type { SheetActions, SheetState, SheetStore } from './store/sheetStore'
import type { DraftRecord, DraftStore } from './sync/draftStore'
import { unsavedLabel } from './sync/SyncIndicator'

// O rascunho de Criação/Editar no aparelho (T-03): grava a cada mudança e,
// ao reabrir a ficha, oferece "Recuperar". Antes, fechar o app, uma queda ou
// o F5 apagavam tudo, sem aviso.

const pad = (n: number) => String(n).padStart(2, '0')
const when = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Uma gravação em voo e a última pendente, sem timer: a última vence
function createRunner() {
  let running = false
  let next: (() => Promise<void>) | null = null
  const pump = async () => {
    running = true
    while (next) {
      const job = next
      next = null
      try {
        await job()
      } catch {
        // O storage falhou: o registro anterior fica; nada vai para log
      }
    }
    running = false
  }
  return (job: () => Promise<void>) => {
    next = job
    if (!running) void pump()
  }
}

type Phase = 'loading' | 'paused' | 'active'

export interface DraftPersistence {
  // O registro guardado que espera a decisão da pessoa
  readonly offer: DraftRecord | null
  /**
   * Recupera com o plano já calculado (o que a oferta mostrou). Devolve null
   * quando a política não deixa editar: o registro fica.
   */
  recover(plan?: RestorePlan): RestorePlan | null
  discard(): void
  // Fechar a oferta: o registro fica e o rascunho continua pausado
  later(): void
}

/**
 * Liga o rascunho do store ao registro do aparelho. Enquanto a leitura não
 * volta, nada é gravado nem apagado. Com registro e o rascunho em memória
 * vazio, oferece recuperar e fica pausado até a decisão, para não apagar o
 * registro com o rascunho vazio que a Criação abre. Depois de "Salvar", o
 * registro só some quando o lote está no outbox.
 */
export function useDraftPersistence({
  store,
  drafts,
  characterId,
  templateVersion,
  idleMode,
  onLost,
}: {
  readonly store: SheetStore
  readonly drafts: DraftStore
  readonly characterId: string
  readonly templateVersion: string
  // O modo de "decidir depois" (o da política, ou o padrão do papel)
  readonly idleMode: SheetMode
  // O rascunho não coube no aparelho: não será recuperável
  readonly onLost?: () => void
}): DraftPersistence {
  const [offer, setOffer] = useState<DraftRecord | null>(null)
  const phase = useRef<Phase>('loading')
  const record = useRef<DraftRecord | null>(null)
  const run = useRef(createRunner()).current
  const idle = useRef(idleMode)
  idle.current = idleMode
  const lost = useRef(onLost)
  lost.current = onLost

  const persist = useRef((s: SheetState & SheetActions) => {
    if (s.draft?.size) {
      const next: DraftRecord = {
        v: 1,
        characterId,
        templateVersion,
        baseVersion: s.sheetVersion,
        mode: s.mode === 'create' ? 'create' : 'evolve',
        savedAt: Date.now(),
        edits: s.draftEvents(),
      }
      run(async () => {
        if (!(await drafts.write(next))) lost.current?.()
      })
      return
    }
    const exit = s.draftExit
    run(async () => {
      // Salvo: só apaga quando o lote está no outbox. Se não entrou, o
      // registro fica e a próxima abertura oferece recuperar
      if (exit?.kind === 'saved' && !(await exit.queued)) return
      if (store.getState().draft?.size) return
      await drafts.remove(characterId)
    })
  }).current

  useEffect(() => {
    let alive = true
    phase.current = 'loading'
    drafts.read(characterId).then(
      found => {
        if (!alive) return
        const s = store.getState()
        if (found && !s.draft?.size) {
          record.current = found
          phase.current = 'paused'
          setOffer(found)
          return
        }
        // Sem registro, ou já há edição nesta abertura: vale a da memória
        phase.current = 'active'
        if (s.draft?.size) persist(s)
      },
      () => {
        if (alive) phase.current = 'active'
      }
    )
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.draft === prev.draft && s.draftExit === prev.draftExit) return
      if (phase.current === 'active') persist(s)
      // Pausado: entrar de novo em Criação/Editar oferece de novo, para não
      // existirem dois rascunhos
      else if (phase.current === 'paused' && s.draft && !prev.draft)
        setOffer(record.current)
    })
    // O "Salvar" recusado com a ficha sem edição volta guardado (sync.ts):
    // a ficha aberta passa a oferecer "Recuperar", e nada o sobrescreve
    const unpark = drafts.onParked(parked => {
      if (parked !== characterId) return
      phase.current = 'loading'
      void drafts.read(characterId).then(found => {
        if (!alive) return
        if (!found) {
          phase.current = 'active'
          return
        }
        record.current = found
        phase.current = 'paused'
        setOffer(found)
      })
    })
    return () => {
      alive = false
      unsubscribe()
      unpark()
    }
  }, [store, drafts, characterId, persist])

  return {
    offer,
    recover(ready) {
      const found = record.current
      if (!found) return null
      const s = store.getState()
      const plan = ready ?? planDraftRestore(s.model, s.values, s.roles, found)
      // O modo do registro, se ainda vale; sem permissão de edição, nada
      // muda e o registro continua guardado
      if (plan.events.length && !s.restoreDraft(plan, found.mode)) return null
      record.current = null
      phase.current = 'active'
      setOffer(null)
      persist(store.getState())
      return plan
    },
    discard() {
      record.current = null
      phase.current = 'active'
      setOffer(null)
      run(() => drafts.remove(characterId))
    },
    later() {
      setOffer(null)
      // Decidir depois: a ficha sai do rascunho vazio, e o registro fica
      const s = store.getState()
      if (isDraftMode(s.mode) && !s.draft?.size) {
        s.discardDraft()
        s.setMode(idle.current)
      }
    },
  }
}

/** A oferta "Alterações não salvas" ao reabrir a ficha. */
export function DraftRecovery({
  persistence,
  store,
  blocked,
}: {
  readonly persistence: DraftPersistence
  readonly store: SheetStore
  // A política não deixa editar (travada, arquivada, de quem saiu)
  readonly blocked: boolean
}) {
  const toast = useToast()
  const { offer } = persistence
  // O plano muda só com a oferta e com os valores da ficha: o mesmo que a
  // tela mostra é o que "Recuperar" aplica
  const values = useStore(store, s => s.values)
  const plan = useMemo(() => {
    if (!offer) return null
    const { model, roles } = store.getState()
    return planDraftRestore(model, values, roles, offer)
  }, [offer, values, store])
  if (!offer || !plan) return null
  const s = store.getState()
  const n = offer.edits.length
  // Só sobra "Descartar", com o motivo, quando não há o que recuperar
  const reason = blocked
    ? 'A ficha não pode ser editada agora.'
    : offer.templateVersion !== s.model.version
      ? 'A ficha passou para outra versão do sistema desde então.'
      : !plan.events.length
        ? plan.applied === n
          ? 'Essas alterações já estão salvas.'
          : 'Nenhuma dessas alterações vale mais para esta ficha.'
        : null
  const recover = () => {
    const done = persistence.recover(plan)
    if (!done) return
    const restored = done.events.length
    const notes = [
      done.conflicts.length
        ? `${done.conflicts.length} ${done.conflicts.length === 1 ? 'campo mudou' : 'campos mudaram'} desde então`
        : null,
      done.dropped
        ? `${done.dropped} não ${done.dropped === 1 ? 'pôde' : 'puderam'} voltar`
        : null,
    ].filter(Boolean)
    toast.show({
      message: `${restored === 1 ? '1 alteração recuperada' : `${restored} alterações recuperadas`}${notes.length ? ` (${notes.join('; ')})` : ''}.`,
    })
  }
  return (
    <BottomSheet
      visible
      title="Alterações não salvas"
      onClose={persistence.later}
      testID="draft-recovery"
      footer={
        <>
          <View style={reason ? undefined : styles.secondary}>
            <Button
              title="Descartar"
              variant={reason ? 'primary' : 'ghost'}
              accessibilityHint={`Apaga ${n === 1 ? 'a alteração guardada' : `as ${n} alterações guardadas`} neste aparelho`}
              onPress={persistence.discard}
            />
          </View>
          {reason ? null : <Button title="Recuperar" onPress={recover} />}
        </>
      }
    >
      <View style={styles.body}>
        <Text>
          {`Você tem ${unsavedLabel(n)} nesta ficha, de ${when(offer.savedAt)}.`}
          {reason ? '' : ' Recuperar?'}
        </Text>
        {reason ? <Text color="inkMuted">{reason}</Text> : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.space[2] },
  secondary: { flex: 1, alignItems: 'flex-start' },
})
