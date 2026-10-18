import type { ResolvedText } from '../resolve'

// text e longText: o conteúdo é do jogador e nunca vai para log (§11). A frase
// acessível lê o texto, porque é o que está na tela.
const textLike = {
  short: (r: ResolvedText) => r.value,
  plain: (r: ResolvedText) => r.value,
  describe: (r: ResolvedText) => {
    const f = r.field.def
    const label =
      f.type === 'text' && f.aspect ? `Aspecto, ${f.label}` : f.label
    return `${label}: ${r.value || 'vazio'}`
  },
  stored: (r: ResolvedText) => r.value,
}

// Mesmo comportamento nos dois tipos (o TS mede a variância de FieldType<T>
// pelo nome do tipo, por isso não dá para atribuir um ao outro direto).
export const text = textLike
export const longText = textLike
