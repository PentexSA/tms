import {
  type RoleName,
  type SheetData,
  type SheetModel,
  xpBalance,
} from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
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
import type { XpCandidate } from './candidates'
import { AdjustForm, GrantForm, useCommand, xpCommand } from './forms'
import { RequestFooter, RequestPicker } from './RequestPicker'

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
  // O pedido escolhido mora aqui: o resumo e o envio vão no rodapé da folha
  const [picked, setPicked] = useState<XpCandidate | null>(null)
  const [query, setQuery] = useState('')
  const request = useCommand(commands, false)
  const picking = owner && !block && panel === 'request'
  const choose = (c: XpCandidate | null) => {
    setPicked(c)
    request.reset()
  }
  const send = (target: XpCandidate, cost: number, to: number) =>
    void request
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
        if (outcome?.status !== 'done') return
        setPanel(null)
        setPicked(null)
        setQuery('')
      })

  return (
    <BottomSheet
      visible={visible}
      title="Experiência"
      onClose={onClose}
      testID="xp-sheet"
      footer={
        picking ? (
          <RequestFooter
            candidate={picked}
            available={balance?.available ?? 0}
            online={online}
            busy={request.busy}
            error={request.error}
            onSend={(cost, to) => {
              if (picked) send(picked, cost, to)
            }}
          />
        ) : undefined
      }
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
        {picking ? (
          <RequestPicker
            model={model}
            sheet={sheet}
            chosen={picked}
            onChoose={choose}
            query={query}
            onQuery={setQuery}
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
  entry: {
    gap: tokens.space[1],
    paddingVertical: tokens.space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
