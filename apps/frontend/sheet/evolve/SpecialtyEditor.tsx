import { BottomSheet, Button, Pressable, Text, TextField } from '@tms/ui'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { useSetDraft } from './hooks'

// Especialização de um campo com `specialty: true` (contrato §3): texto curto
// guardado em `specialties.<campo>`. O histórico registra só "atualizada".
export const SPECIALTY_MAX = 80

export function SpecialtyEditor({
  id,
  label,
  specialty,
}: {
  readonly id: string
  readonly label: string
  readonly specialty: string | undefined
}) {
  const set = useSetDraft()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = (value: string | null) => {
    const clean = value?.trim() ?? ''
    const err = set(`specialties.${id}`, clean ? clean : null)
    setError(err)
    if (!err) setOpen(false)
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          specialty
            ? `Especialização: ${specialty}, ${label}`
            : `Adicionar especialização em ${label}`
        }
        onPress={() => {
          setText(specialty ?? '')
          setError(null)
          setOpen(true)
        }}
        style={styles.link}
      >
        <Text
          variant="caption"
          color={specialty ? 'inkMuted' : 'action'}
          style={specialty ? styles.italic : undefined}
        >
          {specialty
            ? `Especialização: ${specialty}`
            : 'Adicionar especialização'}
        </Text>
      </Pressable>
      <BottomSheet
        visible={open}
        title={`Especialização · ${label}`}
        onClose={() => setOpen(false)}
        footer={
          <>
            {specialty ? (
              <Button
                title="Remover"
                variant="ghost"
                onPress={() => save(null)}
              />
            ) : null}
            <Button title="Aplicar" onPress={() => save(text)} />
          </>
        }
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TextField
            label="Especialização"
            value={text}
            onChangeText={setText}
            maxLength={SPECIALTY_MAX}
            error={error}
            autoFocus
          />
        </KeyboardAvoidingView>
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', justifyContent: 'center' },
  italic: { fontStyle: 'italic' },
})
