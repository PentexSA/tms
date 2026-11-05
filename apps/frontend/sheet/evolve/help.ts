import type { Help } from '@tms/ui'
import { fold } from './text'

// As frases de ajuda do template (R-19), sem tela: a do campo e a de um nome
// no mapa ao lado da lista (`catalogHelp`, `suggestionHelp`).

/** A ajuda do campo, se o template tiver frase (campo sem frase não mostra "?"). */
export function fieldHelp(def: {
  readonly label: string
  readonly help?: string
}): Help | null {
  return def.help ? { subject: def.label, text: def.help } : null
}

/**
 * A frase de um nome no mapa ao lado da lista. O nome casa como a busca e o
 * selo (sem acento e sem caixa, pelo `fold`), porque o item da ficha pode ter
 * sido digitado ("aliados"). Só propriedade própria: o nome vem do texto da
 * ficha. O assunto do "?" é o nome do mapa (o do template).
 */
export function nameHelp(
  map: Readonly<Record<string, string>> | undefined,
  name: string | undefined
): Help | null {
  if (!map || !name) return null
  const hit = (key: string): Help | null => {
    const text = map[key]
    return typeof text === 'string' && text ? { subject: key, text } : null
  }
  if (Object.hasOwn(map, name)) return hit(name)
  const key = fold(name)
  if (!key) return null
  for (const k of Object.keys(map)) if (fold(k) === key) return hit(k)
  return null
}
