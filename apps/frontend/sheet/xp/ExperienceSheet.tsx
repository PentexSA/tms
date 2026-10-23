import {
  costOf,
  type RoleName,
  type SheetData,
  type SheetModel,
  xpBalance,
  xpTargetKey,
} from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  Chip,
  Skeleton,
  Text,
  TextField,
  tokens,
  useTheme,
} from '@tms/ui'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { messageOf } from '../../lib/errors'
import { whenLabel } from '../../lib/format'
import { useOnline } from '../../lib/network'
import {
  useXpCommands,
  useXpLedger,
  useXpRequests,
  type XpEntryData,
  type XpRequestData,
} from '../../lib/queries/xp'
import type { SheetLifecycle } from '../policy'
import {
  costLabel,
  freeItemLists,
  type XpCandidate,
  xpCandidates,
} from './candidates'
import { AdjustForm, GrantForm, useCommand, xpCommand } from './forms'

// "Experiência" (doc/plano-v4.md, Etapa 8): saldo, pedidos e extrato da
// ficha. O jogador pede um nível por vez, vendo o custo antes de enviar; o
// traço só muda quando o narrador aprova (nada otimista). O narrador concede,
// ajusta ou estorna, e aprova ou recusa os pedidos. Tudo isso exige rede.

const STATUS: Readonly<Record<XpRequestData['status'], string>> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  stale: 'Desatualizado',
}

/** Por que o dono não pode pedir agora; null quando pode. */
export function requestBlock(lifecycle: SheetLifecycle): string | null {
  if (!lifecycle.member) return 'Você saiu desta crônica: a ficha é só leitura.'
  if (lifecycle.status === 'pending')
    return 'A ficha aguarda aprovação do narrador.'
  if (lifecycle.status !== 'active')
    return lifecycle.status === 'creating'
      ? 'Na criação, os pontos são distribuídos na ficha; pedidos de XP valem depois.'
      : 'Pedidos só valem em ficha ativa.'
  if (lifecycle.locked)
    return 'O narrador travou a ficha: pedidos novos não são enviados.'
  return null
}

const entryLabel = (e: XpEntryData): string => {
  if (e.kind === 'spend' && e.request)
    return `${e.request.label ?? 'Evolução'}${e.request.name ? `: ${e.request.name}` : ''} ${e.request.from} → ${e.request.to} · −${e.spentDelta} XP`
  if (e.kind === 'grant') return `+${e.totalDelta} XP · ${e.reason ?? ''}`
  const sign = e.totalDelta > 0 ? '+' : ''
  return `${e.reversesEntryId ? 'Estorno' : 'Ajuste'} ${sign}${e.totalDelta} XP · ${e.reason ?? ''}`
}

export function ExperienceSheet({
  characterId,
  chronicleId,
  model,
  sheet,
  roles,
  lifecycle,
  visible,
  onClose,
}: {
  readonly characterId: string
  readonly chronicleId: string
  readonly model: SheetModel
  // A ficha confirmada pelo servidor: o custo é o dela, nunca o do rascunho
  readonly sheet: SheetData
  readonly roles: readonly RoleName[]
  readonly lifecycle: SheetLifecycle
  readonly visible: boolean
  readonly onClose: () => void
}) {
  const { colors } = useTheme()
  const online = useOnline()
  const owner = roles.includes('owner')
  const storyteller = roles.includes('storyteller')
  const ledger = useXpLedger(characterId, visible)
  const requests = useXpRequests(characterId, visible)
  const commands = useXpCommands()
  const [panel, setPanel] = useState<'request' | 'grant' | 'adjust' | null>(
    null
  )
  const balance =
    ledger.data?.pages[0]?.balance ?? xpBalance(model, sheet) ?? null
  const entries = useMemo(
    () => ledger.data?.pages.flatMap(p => p.items) ?? [],
    [ledger.data]
  )
  const mine = commands.unconfirmed.filter(c => c.characterId === characterId)
  const block = requestBlock(lifecycle)
  const hasRules = Boolean(model.template.costs?.xp?.rules?.length)

  return (
    <BottomSheet
      visible={visible}
      title="Experiência"
      onClose={onClose}
      testID="xp-sheet"
    >
      <View style={styles.content}>
        {balance ? (
          <View
            accessible
            accessibilityLabel={`Saldo de XP: ${balance.available} disponível, ${balance.total} total, ${balance.spent} gasto`}
            testID="xp-balance"
          >
            <Text variant="fieldLabel">Disponível: {balance.available} XP</Text>
            <Text color="inkMuted">
              Total {balance.total} · Gasto {balance.spent}
            </Text>
          </View>
        ) : null}
        {!online ? (
          <Text color="inkMuted">
            Sem conexão: dá para consultar o que está em cache; pedir, conceder
            e decidir esperam a rede.
          </Text>
        ) : null}

        {mine.map(c => (
          <UnconfirmedRow
            key={c.key}
            label={c.label}
            disabled={!online}
            onRetry={() => void commands.run(c)}
          />
        ))}

        {owner ? (
          block ? (
            <Text color="inkMuted" testID="xp-request-block">
              {block}
            </Text>
          ) : hasRules ? (
            <Button
              title="Solicitar evolução"
              variant={panel === 'request' ? 'secondary' : 'primary'}
              testID="xp-request-open"
              onPress={() => setPanel(panel === 'request' ? null : 'request')}
            />
          ) : (
            <Text color="inkMuted">
              Este sistema ainda não tem custos de XP: não há evolução por
              pedido.
            </Text>
          )
        ) : null}
        {owner && !block && panel === 'request' ? (
          <RequestPicker
            chronicleId={chronicleId}
            characterId={characterId}
            model={model}
            sheet={sheet}
            available={balance?.available ?? 0}
            commands={commands}
            onDone={() => setPanel(null)}
          />
        ) : null}

        {storyteller ? (
          <View style={styles.row}>
            <Button
              title="Conceder XP"
              variant="secondary"
              testID="xp-grant-open"
              onPress={() => setPanel(panel === 'grant' ? null : 'grant')}
            />
            <Button
              title="Ajustar XP"
              variant="secondary"
              testID="xp-adjust-open"
              onPress={() => setPanel(panel === 'adjust' ? null : 'adjust')}
            />
          </View>
        ) : null}
        {storyteller && panel === 'grant' ? (
          <GrantForm
            chronicleId={chronicleId}
            characterIds={[characterId]}
            commands={commands}
            onDone={() => setPanel(null)}
          />
        ) : null}
        {storyteller && panel === 'adjust' ? (
          <AdjustForm
            chronicleId={chronicleId}
            characterId={characterId}
            grants={entries.filter(e => e.kind === 'grant')}
            commands={commands}
            onDone={() => setPanel(null)}
          />
        ) : null}

        <Text variant="fieldLabel">Pedidos</Text>
        {requests.isPending && visible ? (
          <Skeleton lines={2} label="Carregando os pedidos" />
        ) : requests.isError ? (
          <Text color="danger">{messageOf(requests.error)}</Text>
        ) : requests.data?.length ? (
          requests.data.map(r => (
            <RequestRow
              key={r.id}
              request={r}
              chronicleId={chronicleId}
              owner={owner}
              storyteller={storyteller}
              member={lifecycle.member}
              commands={commands}
            />
          ))
        ) : (
          <Text color="inkMuted">Nenhum pedido.</Text>
        )}

        <Text variant="fieldLabel">Extrato</Text>
        {ledger.isPending && visible ? (
          <Skeleton lines={3} label="Carregando o extrato" />
        ) : ledger.isError ? (
          <Text color="danger">{messageOf(ledger.error)}</Text>
        ) : entries.length ? (
          entries.map(e => (
            <View
              key={e.id}
              style={[styles.entry, { borderBottomColor: colors.borderSubtle }]}
              testID={`xp-entry-${e.id}`}
            >
              <Text>{entryLabel(e)}</Text>
              <Text variant="caption" color="inkMuted">
                {whenLabel(e.at)} · {e.by?.username ?? 'Conta excluída'}
              </Text>
            </View>
          ))
        ) : (
          <Text color="inkMuted">Nenhum lançamento.</Text>
        )}
        {ledger.hasNextPage ? (
          <Button
            title="Carregar mais"
            variant="ghost"
            busy={ledger.isFetchingNextPage}
            onPress={() => void ledger.fetchNextPage()}
          />
        ) : null}
      </View>
    </BottomSheet>
  )
}

function UnconfirmedRow({
  label,
  disabled,
  onRetry,
}: {
  readonly label: string
  readonly disabled: boolean
  readonly onRetry: () => void
}) {
  return (
    <View style={styles.entry} testID="xp-unconfirmed">
      <Text>Não confirmado: {label}</Text>
      <Text variant="caption" color="inkMuted">
        O servidor não respondeu. Reenviar usa a mesma chave: nada se repete.
        Este comando fica guardado até o servidor confirmar o resultado.
      </Text>
      <Button title="Reenviar" disabled={disabled} onPress={onRetry} />
    </View>
  )
}

function RequestPicker({
  chronicleId,
  characterId,
  model,
  sheet,
  available,
  commands,
  onDone,
}: {
  readonly chronicleId: string
  readonly characterId: string
  readonly model: SheetModel
  readonly sheet: SheetData
  readonly available: number
  readonly commands: ReturnType<typeof useXpCommands>
  readonly onDone: () => void
}) {
  const online = useOnline()
  const candidates = useMemo(() => xpCandidates(model, sheet), [model, sheet])
  const lists = useMemo(() => freeItemLists(model), [model])
  const [chosen, setChosen] = useState<XpCandidate | null>(null)
  const [list, setList] = useState(lists[0]?.id ?? null)
  const [custom, setCustom] = useState('')
  const run = useCommand(commands, false)
  // Item de nome livre: o mesmo core calcula o preço (sem desconto de
  // catálogo para um nome digitado)
  const typed = useMemo<XpCandidate | null>(() => {
    const def = lists.find(l => l.id === list)
    const name = custom.trim()
    if (!def || !name) return null
    const target = { field: def.id, name }
    return {
      key: xpTargetKey(target),
      target,
      label: `${def.label}: ${name} (novo)`,
      cost: costOf(model, sheet, target),
    }
  }, [custom, list, lists, model, sheet])
  const target = chosen ?? typed
  return (
    <View style={styles.form} testID="xp-request-picker">
      <Text color="inkMuted">
        Um nível por pedido. O custo é conferido de novo na aprovação.
      </Text>
      <View style={styles.chips}>
        {candidates.map(c => (
          <Chip
            key={c.key}
            label={`${c.label} · ${costLabel(c)}`}
            selected={chosen?.key === c.key}
            onPress={
              c.cost.ok
                ? () => {
                    setChosen(c)
                    setCustom('')
                    run.reset()
                  }
                : undefined
            }
          />
        ))}
      </View>
      {lists.length > 1 ? (
        <View style={styles.chips}>
          {lists.map(l => (
            <Chip
              key={l.id}
              label={l.label}
              selected={list === l.id}
              onPress={() => setList(l.id)}
            />
          ))}
        </View>
      ) : null}
      {lists.length ? (
        <TextField
          label={`Novo item em ${lists.find(l => l.id === list)?.label ?? ''} (nome)`}
          value={custom}
          maxLength={80}
          testID="xp-request-custom"
          onChangeText={t => {
            setCustom(t)
            setChosen(null)
            run.reset()
          }}
        />
      ) : null}
      {target ? (
        <PickedRequest
          key={target.key}
          candidate={target}
          available={available}
          online={online}
          busy={run.busy}
          error={run.error}
          onSend={(cost, to) =>
            void run
              .send(
                key =>
                  xpCommand('request', key, {
                    chronicleId,
                    characterId,
                    body: {
                      field: target.target.field,
                      ...(target.target.item && { item: target.target.item }),
                      ...(target.target.name && { name: target.target.name }),
                      to,
                      expectedCost: cost,
                    },
                    label: `Pedir ${target.label}`,
                  }),
                'O pedido não foi enviado.'
              )
              .then(outcome => {
                if (outcome?.status === 'done') onDone()
              })
          }
        />
      ) : null}
    </View>
  )
}

function PickedRequest({
  candidate,
  available,
  online,
  busy,
  error,
  onSend,
}: {
  readonly candidate: XpCandidate
  readonly available: number
  readonly online: boolean
  readonly busy: boolean
  readonly error: string | null
  readonly onSend: (cost: number, to: number) => void
}) {
  const cost = candidate.cost
  if (!cost.ok)
    return (
      <Text color="danger" accessibilityRole="alert">
        {costLabel(candidate)}: este traço não pode ser pedido agora.
      </Text>
    )
  const short = available < cost.cost
  return (
    <View style={styles.form}>
      <Text testID="xp-request-summary">
        {candidate.label}: {cost.from} → {cost.to}. Custo {cost.cost} XP
        (disponível {available}).
      </Text>
      {short ? (
        <Text color="inkMuted">
          Saldo insuficiente para esta evolução: o servidor vai recusar.
        </Text>
      ) : null}
      {error ? (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button
        title="Enviar pedido"
        testID="xp-request-send"
        busy={busy}
        disabled={!online}
        onPress={() => onSend(cost.cost, cost.to)}
      />
    </View>
  )
}

export function RequestRow({
  request: r,
  chronicleId,
  owner,
  storyteller,
  member,
  commands,
}: {
  readonly request: XpRequestData
  readonly chronicleId: string
  readonly owner: boolean
  readonly storyteller: boolean
  readonly member: boolean
  readonly commands: ReturnType<typeof useXpCommands>
}) {
  const { colors } = useTheme()
  const online = useOnline()
  const run = useCommand(commands, storyteller)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const pending = r.status === 'pending'
  const decide = (kind: 'approve' | 'reject' | 'cancel') =>
    void run.send(key =>
      xpCommand(kind, key, {
        chronicleId,
        characterId: r.characterId,
        requestId: r.id,
        body: kind === 'reject' ? { reason: reason.trim() } : {},
        label: `${kind === 'approve' ? 'Aprovar' : kind === 'reject' ? 'Recusar' : 'Cancelar'} ${r.label}`,
      })
    )
  return (
    <View
      style={[styles.entry, { borderBottomColor: colors.borderSubtle }]}
      testID={`xp-request-${r.id}`}
    >
      <Text>
        {r.label} {r.from} → {r.to} · {r.cost} XP · {STATUS[r.status]}
      </Text>
      {r.suspended ? (
        <Text variant="caption" color="inkMuted">
          Suspenso enquanto a ficha ou o vínculo estiver indisponível.
        </Text>
      ) : null}
      {r.status === 'rejected' && r.reason ? (
        <Text variant="caption" color="inkMuted">
          Motivo: {r.reason}
        </Text>
      ) : null}
      {r.status === 'stale' ? (
        <Text variant="caption" color="inkMuted">
          O traço ou o custo mudou. Faça um novo pedido.
        </Text>
      ) : null}
      {run.error ? (
        <Text color="danger" accessibilityRole="alert">
          {run.error}
        </Text>
      ) : null}
      {pending && storyteller ? (
        <View style={styles.form}>
          <View style={styles.row}>
            <Button
              title="Aprovar"
              testID={`xp-approve-${r.id}`}
              busy={run.busy}
              disabled={!online}
              onPress={() => decide('approve')}
            />
            <Button
              title="Recusar"
              variant="secondary"
              disabled={!online}
              onPress={() => setRejecting(v => !v)}
            />
          </View>
          {rejecting ? (
            <View style={styles.form}>
              <TextField
                label="Motivo da recusa"
                value={reason}
                maxLength={200}
                testID={`xp-reject-reason-${r.id}`}
                onChangeText={t => {
                  setReason(t)
                  run.reset()
                }}
              />
              <Button
                title="Confirmar recusa"
                variant="danger"
                testID={`xp-reject-${r.id}`}
                busy={run.busy}
                disabled={!online || !reason.trim()}
                onPress={() => decide('reject')}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {pending && owner && !storyteller && member ? (
        <Button
          title="Cancelar pedido"
          variant="ghost"
          testID={`xp-cancel-${r.id}`}
          busy={run.busy}
          disabled={!online}
          onPress={() => decide('cancel')}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { gap: tokens.space[3] },
  form: { gap: tokens.space[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  entry: {
    gap: tokens.space[1],
    paddingVertical: tokens.space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
