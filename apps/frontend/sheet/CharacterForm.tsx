import { canWrite, type SheetModel, validateSheet } from '@tms/sheet-core'
import { Banner, Button, tokens } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { editors } from './editors'

// Criação de ficha (Etapa 14): o formulário sai do template. São os campos de
// identidade que o dono pode escrever (model.identityFields); nenhum campo é
// fixo no código. O resto da ficha nasce vazio e é montado em Evoluir.

export interface ServerIssue {
  readonly path: string
  readonly message: string
}

export interface CharacterFormProps {
  readonly model: SheetModel
  readonly busy?: boolean
  readonly error?: string | null
  // Erros do servidor (422), no formato "/values/<campo>"
  readonly serverIssues?: readonly ServerIssue[]
  readonly onSubmit: (values: Record<string, unknown>) => void
}

const fieldOfPath = (path: string) =>
  path.replace(/^\/?values[./]/, '').split(/[./]/)[0] ?? ''

export function CharacterForm({
  model,
  busy,
  error,
  serverIssues = [],
  onSubmit,
}: CharacterFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const nameField = model.template.identity.name
  const fields = model.identityFields.filter(id => {
    const def = model.fields.get(id)?.def
    return (
      def && canWrite(model, id, ['owner']) && Object.hasOwn(editors, def.type)
    )
  })
  const fromServer = Object.fromEntries(
    serverIssues.map(i => [fieldOfPath(i.path), i.message])
  )

  const submit = () => {
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(values)) {
      const x = typeof v === 'string' ? v.trim() : v
      if (x !== '' && x !== undefined) clean[k] = x
    }
    const found: Record<string, string> = {}
    if (!clean[nameField]) found[nameField] = 'Informe o nome'
    for (const issue of validateSheet(model.template, {
      values: clean,
      specialties: {},
    })) {
      const id = fieldOfPath(issue.path)
      found[id] ??= issue.message
    }
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(clean)
  }

  return (
    <View style={styles.form}>
      {error ? <Banner tone="danger" message={error} /> : null}
      {fields.map(id => {
        const def = model.fields.get(id)?.def
        const Editor = def ? editors[def.type] : undefined
        if (!def || !Editor) return null
        return (
          <Editor
            key={id}
            id={id}
            def={def}
            value={values[id]}
            required={id === nameField}
            error={errors[id] ?? fromServer[id]}
            onChange={next => {
              setValues(v => ({ ...v, [id]: next }))
              setErrors(({ [id]: _, ...rest }) => rest)
            }}
          />
        )
      })}
      <Button title="Criar ficha" onPress={submit} busy={busy} />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: tokens.space[5] },
})
