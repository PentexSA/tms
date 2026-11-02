import type { CompiledSection, FieldId, SheetModel } from '@tms/sheet-core'
import { createContext, useContext } from 'react'
import { fold } from '../evolve/text'

// Um título e um contador por bloco (T-58). Quando o bloco (seção ou grupo)
// tem um campo só, de lista, com o rótulo igual ao título do bloco, o
// cabeçalho do bloco já diz o nome e a conta: o editor da lista não repete
// o próprio cabeçalho. A regra compara os textos do template, sem conhecer
// sistema ("Disciplinas" no V20, "Dons" no W20, "Magias" num outro).

/** O campo de lista que o título do bloco já nomeia, se houver. */
export function titledList(
  model: SheetModel,
  fieldIds: readonly FieldId[],
  title: string | null | undefined
): FieldId | undefined {
  const [id] = fieldIds
  if (!title || !id || fieldIds.length !== 1) return undefined
  const def = model.fields.get(id)?.def
  return def?.type === 'list' && fold(def.label) === fold(title)
    ? id
    : undefined
}

/** O título do bloco é o mesmo da seção que já está à vista. */
export const sameTitle = (a: string, b: string): boolean => fold(a) === fold(b)

/**
 * A seção de grupos com um grupo só, de mesmo nome (W20 "Dons", M20
 * "Antecedentes"): com o título da seção à vista, o grupo não o repete.
 */
export function echoesSection(section: CompiledSection): boolean {
  const groups = section.groups ?? []
  const [only] = groups
  return (
    section.def.layout === 'groups' &&
    groups.length === 1 &&
    Boolean(only) &&
    sameTitle(only?.title ?? '', section.def.title)
  )
}

/** A lista que o cabeçalho da seção intitula (o grupo de mesmo nome some). */
export const sectionList = (
  model: SheetModel,
  section: CompiledSection
): FieldId | undefined =>
  echoesSection(section)
    ? titledList(model, section.fieldIds, section.def.title)
    : undefined

/** A lista que o cabeçalho de fora já intitula (o GroupsLayout informa). */
export const HeadedList = createContext<FieldId | null>(null)

/** O editor desta lista deixa o cabeçalho para o bloco. */
export const useHeadedList = (id: FieldId): boolean =>
  useContext(HeadedList) === id
