import { canWrite, type SheetModel, validateSheet } from '@tms/sheet-core'
import { Banner, Button, tokens } from '@tms/ui'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, type TextInputInstance, View } from 'react-native'
import { editors } from './editors'

// Criação de ficha (Etapa 14): o formulário sai do template. São os campos de
// identidade que o dono pode escrever (model.identityFields); nenhum campo é
// fixo no código. O resto da ficha nasce vazio e é montado em Evoluir.
// Ordem: o nome, os textos curtos em pares (Natureza | Comportamento,
// Conceito | Senhor) e o resto (o Clã, em grade), para rolar menos.

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
  // Algum campo preenchido (depois do trim): a tela segura a saída (T-56)
  readonly onDirtyChange?: (dirty: boolean) => void
  // O primeiro campo com erro, na ordem da tela (T-21): `y` da linha dele
  // dentro do formulário, para a tela rolar até ele antes do foco
  readonly onInvalid?: (y: number) => void
}

// Linhas do formulário: o nome sozinho, textos curtos de dois em dois e os
// demais campos, cada um na sua linha
function rowsOf(
  model: SheetModel,
  fields: readonly string[],
  nameField: string
): string[][] {
  const short = (id: string) =>
    id !== nameField && model.fields.get(id)?.def.type === 'text'
  const texts = fields.filter(short)
  const rows: string[][] = fields.includes(nameField) ? [[nameField]] : []
  for (let i = 0; i < texts.length; i += 2) rows.push(texts.slice(i, i + 2))
  for (const id of fields) if (id !== nameField && !short(id)) rows.push([id])
  return rows
}

const fieldOfPath = (path: string) =>
  path.replace(/^\/?values[./]/, '').split(/[./]/)[0] ?? ''

export function CharacterForm({
  model,
  busy,
  error,
  serverIssues = [],
  onSubmit,
  onDirtyChange,
  onInvalid,
}: CharacterFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = Object.values(values).some(v =>
    typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null
  )
  const notify = useRef(onDirtyChange)
  notify.current = onDirtyChange
  useEffect(() => {
    notify.current?.(dirty)
  }, [dirty])
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
  const rows = rowsOf(model, fields, nameField)
  // O `y` de cada linha e o campo de texto de cada editor (T-21)
  const rowY = useRef(new Map<string, number>())
  const inputs = useRef(new Map<string, TextInputInstance>())
  // Leva ao primeiro campo com erro, na ordem da tela: rola até a linha e
  // foca o campo, quando é de texto (no web, o foco também o traz à vista).
  // Nenhuma validação nova: só o caminho até o erro
  const goTo = (invalid: ReadonlySet<string>) => {
    const row = rows.find(r => r.some(id => invalid.has(id)))
    const id = row?.find(x => invalid.has(x))
    if (!row || !id) return
    onInvalid?.(rowY.current.get(row.join(':')) ?? 0)
    inputs.current.get(id)?.focus()
  }
  // O 422 do servidor (serverIssues) faz o mesmo ao chegar
  const serverKey = serverIssues.map(i => fieldOfPath(i.path)).join('|')
  const reach = useRef(goTo)
  reach.current = goTo
  useEffect(() => {
    if (serverKey) reach.current(new Set(serverKey.split('|')))
  }, [serverKey])

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
    else goTo(new Set(Object.keys(found)))
  }

  return (
    <View style={styles.form}>
      {error ? <Banner tone="danger" message={error} /> : null}
      {rows.map(row => (
        <View
          key={row.join(':')}
          style={styles.row}
          testID={`form-row-${row.join('-')}`}
          onLayout={e => {
            rowY.current.set(row.join(':'), e.nativeEvent.layout.y)
          }}
        >
          {row.map(id => {
            const def = model.fields.get(id)?.def
            const Editor = def ? editors[def.type] : undefined
            if (!def || !Editor) return null
            return (
              <View key={id} style={styles.cell}>
                <Editor
                  id={id}
                  def={def}
                  value={values[id]}
                  required={id === nameField}
                  properName={id === nameField}
                  inputRef={el => {
                    if (el) inputs.current.set(id, el)
                    else inputs.current.delete(id)
                  }}
                  error={errors[id] ?? fromServer[id]}
                  onChange={next => {
                    setValues(v => ({ ...v, [id]: next }))
                    setErrors(({ [id]: _, ...rest }) => rest)
                  }}
                />
              </View>
            )
          })}
        </View>
      ))}
      <Button title="Criar ficha" onPress={submit} busy={busy} />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: tokens.space[5] },
  row: { flexDirection: 'row', gap: tokens.space[3] },
  // minWidth 0: o texto longo quebra dentro da coluna, sem empurrar a outra
  cell: { flex: 1, minWidth: 0 },
})
