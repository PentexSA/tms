import { Banner, BottomSheet, Button, ListItem, Text, tokens } from '@tms/ui'
import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  type HostInstance,
  Platform,
  StyleSheet,
  View,
} from 'react-native'

import { messageOf } from '../../lib/errors'
import { focusView } from '../../lib/focus'
import { hhmm, plural, shortDate } from '../../lib/format'
import { inviteLink, webOrigin } from '../../lib/invite/link'
import {
  canShareNatively,
  copyText,
  shareMessage,
} from '../../lib/invite/share'
import {
  formatInviteCode,
  useCreateInvite,
  useInvites,
  useRevokeInvite,
} from '../../lib/queries/chronicles'

/** Quanto o botão fica em "Copiado ✓". */
export const COPIED_MS = 2000

type Copied = 'link' | 'message' | 'code'

const COPIED_TEXT: Record<Copied, string> = {
  link: 'Link copiado.',
  message: 'Mensagem copiada.',
  code: 'Código copiado.',
}

const COPY_FAILED = 'Não foi possível copiar. Selecione o link acima e copie.'
const SHARE_FALLBACK =
  'O navegador não abriu o compartilhamento. A mensagem foi copiada.'

interface CreatedInvite {
  readonly id: string
  readonly code: string
  readonly expiresAt: string | Date
  readonly maxUses: number
}

/** "25/10 às 14:05", no fuso de quem lê. */
const when = (value: string | Date) => {
  const d = new Date(value)
  return `${shortDate(d)} às ${hhmm(d)}`
}

const HEADING = 'heading'

/** A mensagem pronta (texto do time, revisável): o link, o código e a validade. */
export function inviteMessage(
  chronicleName: string,
  invite: CreatedInvite,
  link: string
): string {
  return (
    `Você foi convidado para a crônica "${chronicleName}" no TMS. ` +
    `Abra o link para entrar: ${link} — ` +
    `No app TMS, toque em "Entrar com convite" e use o código ${formatInviteCode(invite.code)}. ` +
    `Vale até ${shortDate(invite.expiresAt)} e para até ${plural(invite.maxUses, 'pessoa', 'pessoas')}.`
  )
}

// Convites da crônica (só o narrador). O código aparece só ao ser gerado: a
// API guarda o hash e não consegue mostrá-lo de novo. Desde a D-14 (P12) o
// convite é um link (`<web>/join#<código>`), com a mensagem pronta; copiar
// responde no próprio botão ("Copiado ✓") e numa região viva, porque o
// aviso de baixo pode não estar à vista.
export function InviteSheet({
  chronicleId,
  chronicleName,
  visible,
  onClose,
}: {
  readonly chronicleId: string
  readonly chronicleName: string
  readonly visible: boolean
  readonly onClose: () => void
}) {
  const invites = useInvites(chronicleId, visible)
  const create = useCreateInvite(chronicleId)
  const revoke = useRevokeInvite(chronicleId)
  const [invite, setInvite] = useState<CreatedInvite | null>(null)
  const [copied, setCopied] = useState<Copied | null>(null)
  // A região viva fica sempre montada: só o texto muda
  const [said, setSaid] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  // "Revogar" pede confirmação na própria linha (T-45; DS: destrutivo raro,
  // foco inicial em Cancelar). Uma por vez. Na linha, e não numa folha nova
  // por cima desta: dois modais em transição falham no iOS
  const [confirming, setConfirming] = useState<string | null>(null)
  const [refocus, setRefocus] = useState<string | null>(null)
  const cancelButton = useRef<HostInstance>(null)
  const heading = useRef<HostInstance>(null)
  const triggers = useRef(new Map<string, HostInstance>())
  useEffect(() => {
    if (confirming) focusView(cancelButton.current)
  }, [confirming])
  useEffect(() => {
    if (!refocus) return
    setRefocus(null)
    focusView(
      refocus === HEADING
        ? heading.current
        : (triggers.current.get(refocus) ?? null)
    )
  }, [refocus])

  const link = invite ? inviteLink(invite.code, webOrigin()) : ''
  const message = invite ? inviteMessage(chronicleName, invite, link) : ''
  const native = canShareNatively(message)
  // O número do convite vem da lista (o app a busca de novo depois de gerar)
  const number = invite
    ? invites.data?.find(i => i.id === invite.id)?.number
    : undefined

  const say = (text: string) => {
    setSaid(text)
    // No iOS a região viva não fala sozinha; no web, o anúncio é vazio e a
    // região (aria-live) fala; no Android, a região fala
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text)
  }
  const done = (what: Copied, note?: string) => {
    setCopied(what)
    say(note ?? COPIED_TEXT[what])
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), COPIED_MS)
  }
  const copy = async (what: Copied, text: string) => {
    // O catch não vai ao error tracking: o texto copiado tem o código
    if (await copyText(text)) done(what)
    else say(COPY_FAILED)
  }
  const share = async () => {
    const outcome = await shareMessage(message)
    if (outcome === 'copied') done('message', SHARE_FALLBACK)
    else if (outcome === 'failed') say(COPY_FAILED)
  }

  const generate = () =>
    create.mutate(undefined, {
      onSuccess: created => {
        setCopied(null)
        setSaid('')
        setInvite(created)
      },
    })
  const close = () => {
    setConfirming(null)
    setInvite(null)
    setCopied(null)
    setSaid('')
    onClose()
  }
  const active = (invites.data ?? []).filter(i => i.active)

  const copyButton = (what: Copied, title: string, primary = false) => (
    <Button
      title={copied === what ? 'Copiado ✓' : title}
      accessibilityLabel={copied === what ? 'Copiado' : title}
      variant={primary ? 'primary' : 'secondary'}
      onPress={() =>
        copy(
          what,
          what === 'link'
            ? link
            : what === 'code'
              ? (invite?.code ?? '')
              : message
        )
      }
    />
  )

  return (
    <BottomSheet visible={visible} title="Convidar jogadores" onClose={close}>
      <View style={styles.body}>
        {create.isError || revoke.isError ? (
          <Banner
            tone="danger"
            message={messageOf(create.error ?? revoke.error)}
          />
        ) : null}
        {invite ? (
          <View style={styles.code}>
            <Text
              variant="fieldLabel"
              accessibilityRole="header"
              aria-level={3}
            >
              {number ? `Convite ${number}` : 'Convite novo'}
            </Text>
            <Text color="inkMuted">
              {`Mande o link para quem vai jogar. Ele vale até ${when(invite.expiresAt)} e para até ${plural(invite.maxUses, 'pessoa', 'pessoas')}, e só aparece agora: copie antes de fechar.`}
            </Text>
            <Text selectable testID="invite-link-value">
              {link}
            </Text>
            <Text
              variant="numberLg"
              selectable
              accessibilityLabel={`Código do convite: ${invite.code.split('').join(' ')}`}
              testID="invite-code-value"
            >
              {formatInviteCode(invite.code)}
            </Text>
            <View style={styles.row}>
              {copyButton('link', 'Copiar link', true)}
              {native ? (
                <Button
                  title={copied === 'message' ? 'Copiado ✓' : 'Compartilhar'}
                  accessibilityLabel={
                    copied === 'message' ? 'Copiado' : 'Compartilhar'
                  }
                  variant="secondary"
                  onPress={share}
                />
              ) : (
                copyButton('message', 'Copiar mensagem')
              )}
              {copyButton('code', 'Copiar código')}
            </View>
          </View>
        ) : (
          <Button
            title="Gerar convite"
            onPress={generate}
            busy={create.isPending}
          />
        )}
        <Text
          aria-live="polite"
          accessibilityLiveRegion="polite"
          testID="invite-copy-status"
          color="inkMuted"
        >
          {said}
        </Text>
        {/* Focável por programa: recebe o foco depois de revogar (T-45) */}
        <Text
          variant="title"
          accessibilityRole="header"
          aria-level={3}
          style={styles.heading}
          // O Text do @tms/ui não declara ref (React 19: vai como prop), como
          // no AnchorHeader; tabIndex -1: focável só por programa no web
          {...({ ref: heading, tabIndex: -1 } as object)}
        >
          Convites ativos
        </Text>
        {active.length === 0 ? (
          <Text color="inkMuted">Nenhum convite ativo.</Text>
        ) : (
          active.map(i => {
            const name = `Convite ${i.number}`
            if (confirming === i.id)
              return (
                <View
                  key={i.id}
                  style={styles.confirm}
                  testID={`invite-revoke-confirm-${i.number}`}
                >
                  <Text>
                    {`Revogar o convite ${i.number}? Quem ainda não entrou não vai conseguir usar o link nem o código.`}
                  </Text>
                  <View style={styles.row}>
                    <Button
                      ref={cancelButton}
                      title="Cancelar"
                      variant="secondary"
                      onPress={() => {
                        setConfirming(null)
                        setRefocus(i.id)
                      }}
                    />
                    <Button
                      title="Revogar convite"
                      variant="danger"
                      busy={revoke.isPending}
                      onPress={() =>
                        revoke.mutate(i.id, {
                          onSuccess: () => {
                            setConfirming(null)
                            setRefocus(HEADING)
                          },
                        })
                      }
                    />
                  </View>
                </View>
              )
            return (
              <ListItem
                key={i.id}
                title={`${name} · criado em ${when(i.createdAt)}`}
                // Os usos que restam, não os gastos (doc/plano-v3.md, Etapa 7)
                subtitle={`${plural(i.maxUses - i.uses, 'uso restante', 'usos restantes')} · vale até ${when(i.expiresAt)}`}
                trailing={
                  <Button
                    ref={view => {
                      if (view) triggers.current.set(i.id, view)
                      else triggers.current.delete(i.id)
                    }}
                    title="Revogar"
                    // Começa pelo título (WCAG 2.5.3) e diz qual convite
                    accessibilityLabel={`Revogar ${name.toLowerCase()}`}
                    variant="ghost"
                    onPress={() => {
                      revoke.reset()
                      setConfirming(i.id)
                    }}
                  />
                }
              />
            )
          })
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.space[3], paddingBottom: tokens.space[4] },
  code: { gap: tokens.space[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[3] },
  heading: { paddingVertical: tokens.space[2] },
  confirm: { gap: tokens.space[3], paddingVertical: tokens.space[2] },
})
