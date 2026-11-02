import type { FieldDef, FieldTypeName } from '@tms/sheet-core'
import type { ComponentType } from 'react'

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
  // Nome próprio (o nome do personagem): sem corretor nem sugestão do
  // teclado, que trocava "PO" por "PÔ" (T-38)
  readonly properName?: boolean
}

export type Editor = ComponentType<EditorProps>

export type Editors = Partial<Record<FieldTypeName, Editor>>
