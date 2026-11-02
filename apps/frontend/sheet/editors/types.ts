import type { FieldDef, FieldTypeName } from '@tms/sheet-core'
import type { ComponentType, Ref } from 'react'
import type { TextInputInstance } from 'react-native'

// Editor de um campo (variante "editor"): criação de ficha e modo Evoluir.
// Recebe o valor no formato de sheet_data e devolve o valor novo; quem chama
// decide o que fazer com ele (formulário, rascunho, evento).
export interface EditorProps<V = unknown> {
  readonly id: string
  readonly def: FieldDef
  readonly value: V | undefined
  readonly onChange: (next: V) => void
  readonly error?: string | null
  readonly required?: boolean
  // "Próximo" entre os campos de texto do formulário (T-26): com `next`, o
  // Enter foca o campo seguinte; sem ele, é o último ("concluído") e não
  // envia nada. Só os editores de texto de uma linha usam.
  readonly chain?: { readonly next?: () => void }
  // Nome próprio (o nome do personagem): sem corretor nem sugestão do
  // teclado, que trocava "PO" por "PÔ" (T-38)
  readonly properName?: boolean
  // O campo de texto do editor, para focar
  readonly inputRef?: Ref<TextInputInstance>
}

export type Editor = ComponentType<EditorProps>

export type Editors = Partial<Record<FieldTypeName, Editor>>
