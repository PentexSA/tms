import { ChoiceEditor } from './ChoiceEditor'
import { NumberEditor } from './NumberEditor'
import { TextEditor } from './TextEditor'
import type { Editors } from './types'

export type { Editor, EditorProps, Editors } from './types'

// Editores por tipo. Os que faltam (resource, track, list...) entram no modo
// Evoluir (Etapa 18); a criação só usa campos de identidade.
export const editors: Editors = {
  text: TextEditor,
  longText: TextEditor,
  choice: ChoiceEditor,
  state: ChoiceEditor,
  number: NumberEditor,
  rating: NumberEditor,
}
