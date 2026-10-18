import type { SheetValue } from '../contract'
import type { FieldTypeName } from '../registry'
import type { ResolvedOf, ResolvedSheet } from '../resolve'

// Comportamento de um tipo de campo, sem tela (doc/arquitetura §6.2). A view do
// app traduz isto em componentes; o servidor e os testes usam o mesmo texto.
export interface FieldType<T extends FieldTypeName> {
  // Texto curto do valor: dock, mesa, lista compacta ("9/15", "Machucado −1").
  short(r: ResolvedOf<T>, sheet: ResolvedSheet): string
  // Frase acessível, com o rótulo ("Destreza, 2 de 5"). Alimenta o leitor de tela.
  describe(r: ResolvedOf<T>, sheet: ResolvedSheet): string
  // Texto do valor sem rótulo, para a identidade e os resumos ("Tremere").
  plain(r: ResolvedOf<T>, sheet: ResolvedSheet): string
  // Valor no formato de sheet_data, com os padrões preenchidos: é a base de
  // qualquer edição. undefined para o que nunca é guardado (derivados).
  stored(r: ResolvedOf<T>): SheetValue | undefined
}
