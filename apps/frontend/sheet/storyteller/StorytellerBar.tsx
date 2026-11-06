import {
  type CompiledField,
  type FieldId,
  jsonEqual,
  type SheetMode,
  type SheetModel,
} from '@tms/sheet-core'
import { BottomSheet, Button, Text, tokens, useTheme } from '@tms/ui'
import { useId, useMemo, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'

import { useSheet, useSheetSelector } from '../context'
import { useCreation } from '../creation/CreationContext'
import { TextEditor } from '../editors/TextEditor'
import { useModeBarActions } from '../evolve/ModeBar'
import { useCommit } from '../useCommit'
import {
  ADJUST_HINT,
  barEdits,
  editorNotice,
  hiddenFromOwner,
  PRIVATE_NOTE_A11Y,
} from './privacy'

// O narrador abre a ficha de um jogador em Leitura; editar é explícito
// ("Editar como narrador", design/telas/prototipo.js) e fica assinado no
// histórico, que o servidor grava com o papel de quem mandou o lote. O modo é
// UX: quem decide se pode gravar é o applyBatch, aqui e no servidor.

/**
 * Textos que só o narrador escreve (as Notas do Narrador no Vampiro), pelas
 * permissões das seções do template: nada aqui conhece sistema.
 */
export function storytellerOnlyText(model: SheetModel): CompiledField[] {
  return [...model.fields.values()].filter(f => barEdits(model, f.id))
}

export const NARRATING_NOTICE = 'As alterações ficam assinadas no histórico.'

/**
 * Onde o "Editar como narrador" leva (T-33): a criação por pontos ativa
 * (creating ou pending) abre na Criação, com a conta; a criação livre em
 * creating, no Editar; a ficha em uso, no Jogo, para marcar dano na sessão
 * com um toque (o seletor "Jogo · Editar" fica à vista para trocar).
 */
export function narratorTarget(
  creation: { readonly active: boolean; readonly status: string } | null
): SheetMode {
  if (creation?.active) return 'create'
  if (creation?.status === 'creating') return 'evolve'
  return 'play'
}

export function StorytellerBar({ ownerName }: { readonly ownerName: string }) {
  const { model, roles, mode, store } = useSheet()
  const { colors } = useTheme()
  const actions = useModeBarActions()
  const creation = useCreation()
  const [editing, setEditing] = useState<FieldId | null>(null)
  const notes = useMemo(() => storytellerOnlyText(model), [model])
  // A ficha do próprio narrador é dele: vale o fluxo do dono
  if (!roles.has('storyteller') || roles.has('owner')) return null
  const narrating = mode !== 'read'
  // Pela barra de modos (T-33): entrar abre o rascunho; voltar com alterações
  // passa pelo resumo de salvar ou descartar
  const toggle = () => {
    if (narrating) {
      if (actions) actions.go('read')
      else store.getState().setMode('read')
      return
    }
    if (!actions) return
    AccessibilityInfo.announceForAccessibility(
      `Editando como narrador. ${NARRATING_NOTICE}`
    )
    actions.go(narratorTarget(creation))
  }
  return (
    <View
      role="region"
      aria-label={narrating ? 'Editando como narrador' : 'Modo Leitura'}
      style={[styles.bar, { borderBottomColor: colors.borderSubtle }]}
    >
      <View style={styles.text}>
        <Text variant="fieldLabel">{narrating ? 'Narrador' : 'Leitura'}</Text>
        <Text variant="caption" color="inkMuted">
          {narrating ? NARRATING_NOTICE : `Ficha de ${ownerName}.`}
        </Text>
      </View>
      <View style={styles.actions}>
        {narrating
          ? notes.map(f => (
              <Button
                key={f.id}
                title={`Editar ${f.def.label}`}
                variant="secondary"
                // O aviso no nome (começa pelo texto visível, WCAG 2.5.3):
                // a dica não chega ao DOM no web
                accessibilityLabel={
                  hiddenFromOwner(model, f.id)
                    ? `Editar ${f.def.label}. ${PRIVATE_NOTE_A11Y}`
                    : undefined
                }
                onPress={() => setEditing(f.id)}
              />
            ))
          : null}
        {/* Sem escrita (pela política), nada a editar: sem o botão */}
        {narrating || actions ? (
          <Button
            title={narrating ? 'Voltar à leitura' : 'Editar como narrador'}
            variant={narrating ? 'ghost' : 'secondary'}
            onPress={toggle}
          />
        ) : null}
      </View>
      {editing ? (
        <TextFieldSheet id={editing} onClose={() => setEditing(null)} />
      ) : null}
    </View>
  )
}

function TextFieldSheet({
  id,
  onClose,
}: {
  readonly id: FieldId
  readonly onClose: () => void
}) {
  const { model, roles } = useSheet()
  const commit = useCommit()
  const creating = useCreation()?.status === 'creating'
  const noticeId = `${useId()}-privacy`
  const field = model.fields.get(id)
  const stored = useSheetSelector(s => s.values.values[id])
  const npc = useSheetSelector(s => s.npc)
  // R-09 e U-10: privado (as Notas do Narrador) ou "O jogador lê este texto."
  const notice = editorNotice(model, id, roles, npc)
  const secret = hiddenFromOwner(model, id)
  const [text, setText] = useState(typeof stored === 'string' ? stored : '')
  if (!field) return null
  const save = () => {
    const from = stored ?? null
    // Apagar tudo volta o campo ao padrão (sem valor guardado)
    const to = text === '' ? null : text
    if (jsonEqual(from, to)) return onClose()
    if (commit([{ path: `values.${id}`, from, to }], field.def.label).ok)
      onClose()
  }
  return (
    <BottomSheet
      visible
      title={field.def.label}
      onClose={onClose}
      footer={
        <>
          <Button title="Cancelar" variant="ghost" onPress={onClose} />
          <Button title="Salvar" onPress={save} />
        </>
      }
    >
      {notice ? (
        <View style={styles.notice}>
          <Text variant="caption" nativeID={noticeId}>
            {notice}
          </Text>
          {creating && secret ? (
            <Text variant="caption" color="inkMuted">
              {ADJUST_HINT}
            </Text>
          ) : null}
        </View>
      ) : null}
      <TextEditor
        id={id}
        def={field.def}
        value={text}
        onChange={next => setText(String(next))}
        note={notice ? { id: noticeId, text: notice } : undefined}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
    borderBottomWidth: tokens.borderWidth.hair,
  },
  text: { flex: 1, minWidth: 160, gap: tokens.space['0.5'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  notice: { gap: tokens.space[1], marginBottom: tokens.space[3] },
})
