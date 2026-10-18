import {
  Banner,
  BottomSheet,
  Button,
  ListItem,
  SectionHeader,
  Text,
  tokens,
  useToast,
} from '@tms/ui'
import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { Share, StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import { shortDate } from '../../lib/format'
import {
  formatInviteCode,
  useCreateInvite,
  useInvites,
  useRevokeInvite,
} from '../../lib/queries/chronicles'

// Convites da crônica (só o narrador). O código aparece só ao ser gerado: a
// API guarda o hash e não consegue mostrá-lo de novo.
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
  const toast = useToast()
  const invites = useInvites(chronicleId, visible)
  const create = useCreateInvite(chronicleId)
  const revoke = useRevokeInvite(chronicleId)
  const [code, setCode] = useState<string | null>(null)
  const formatted = code ? formatInviteCode(code) : ''

  const generate = () =>
    create.mutate(undefined, { onSuccess: invite => setCode(invite.code) })
  const copy = async () => {
    if (!code) return
    await Clipboard.setStringAsync(code)
    toast.show({ message: 'Código copiado' })
  }
  const share = () =>
    Share.share({
      message: `Entre na crônica "${chronicleName}" no TMS com o código ${formatted}`,
    })
  const close = () => {
    setCode(null)
    onClose()
  }
  const active = (invites.data ?? []).filter(i => i.active)

  return (
    <BottomSheet visible={visible} title="Convidar jogadores" onClose={close}>
      <View style={styles.body}>
        {create.isError || revoke.isError ? (
          <Banner
            tone="danger"
            message={messageOf(create.error ?? revoke.error)}
          />
        ) : null}
        {code ? (
          <View style={styles.code}>
            <Text color="inkMuted">
              Mande este código para quem vai jogar. Ele vale 7 dias e até 10
              pessoas, e só aparece agora: copie antes de fechar.
            </Text>
            <Text
              variant="numberLg"
              selectable
              accessibilityLabel={`Código do convite: ${code.split('').join(' ')}`}
              testID="invite-code-value"
            >
              {formatted}
            </Text>
            <View style={styles.row}>
              <Button title="Copiar código" onPress={copy} />
              <Button
                title="Compartilhar"
                variant="secondary"
                onPress={share}
              />
            </View>
          </View>
        ) : (
          <Button
            title="Gerar convite"
            onPress={generate}
            busy={create.isPending}
          />
        )}
        <SectionHeader title="Convites ativos" level="group" />
        {active.length === 0 ? (
          <Text color="inkMuted">Nenhum convite ativo.</Text>
        ) : (
          active.map(i => (
            <ListItem
              key={i.id}
              title={`Criado em ${shortDate(i.createdAt)}`}
              subtitle={`Usado ${i.uses} de ${i.maxUses} · vale até ${shortDate(i.expiresAt)}`}
              trailing={
                <Button
                  title="Revogar"
                  variant="ghost"
                  onPress={() => revoke.mutate(i.id)}
                  accessibilityHint={`Revoga o convite criado em ${shortDate(i.createdAt)}`}
                />
              }
            />
          ))
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.space[3], paddingBottom: tokens.space[4] },
  code: { gap: tokens.space[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[3] },
})
