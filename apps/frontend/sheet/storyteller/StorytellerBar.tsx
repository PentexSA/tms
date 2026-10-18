import {
  type CompiledField,
  canWrite,
  type FieldId,
  jsonEqual,
  type SheetModel,
} from '@tms/sheet-core'
import { BottomSheet, Button, Text, tokens, useTheme } from '@tms/ui'
import { useMemo, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'

import { useSheet, useSheetSelector } from '../context'
import { TextEditor } from '../editors/TextEditor'
import { useCommit } from '../useCommit'

// O narrador abre a ficha de um jogador em Leitura; editar é explícito
// ("Editar como narrador", design/telas/prototipo.js) e fica assinado no
// histórico, que o servidor grava com o papel de quem mandou o lote. O modo é
// UX: quem decide se pode gravar é o applyBatch, aqui e no servidor.

/**
 * Textos que só o narrador escreve (as Notas do Narrador no Vampiro), pelas
 * permissões das seções do template: nada aqui conhece sistema.
 */
export function storytellerOnlyText(model: SheetModel): CompiledField[] {
  return [...model.fields.values()].filter(
    f =>
      (f.type === 'text' || f.type === 'longText') &&
      canWrite(model, f.id, ['storyteller']) &&
      !canWrite(model, f.id, ['owner'])
  )
}

export const NARRATING_NOTICE = 'As alterações ficam assinadas no histórico.'

export function StorytellerBar({ ownerName }: { readonly ownerName: string }) {
  const { model, roles, mode, store } = useSheet()
  const { colors } = useTheme()
  const [editing, setEditing] = useState<FieldId | null>(null)
  const notes = useMemo(() => storytellerOnlyText(model), [model])
  // A ficha do próprio narrador é dele: vale o fluxo do dono
  if (!roles.has('storyteller') || roles.has('owner')) return null
  const narrating = mode !== 'read'
  const toggle = () => {
    store.getState().setMode(narrating ? 'read' : 'play')
    if (!narrating)
      AccessibilityInfo.announceForAccessibility(
        `Editando como narrador. ${NARRATING_NOTICE}`
      )
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
                onPress={() => setEditing(f.id)}
              />
            ))
          : null}
        <Button
          title={narrating ? 'Voltar à leitura' : 'Editar como narrador'}
          variant={narrating ? 'ghost' : 'secondary'}
          onPress={toggle}
        />
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
  const { model } = useSheet()
  const commit = useCommit()
  const field = model.fields.get(id)
  const stored = useSheetSelector(s => s.values.values[id])
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
      <TextEditor
        id={id}
        def={field.def}
        value={text}
        onChange={next => setText(String(next))}
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
})
