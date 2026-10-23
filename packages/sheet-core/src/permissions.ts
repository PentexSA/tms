import type { SheetModel } from './compile'
import type { FieldId, SheetData } from './contract'
import { REGISTRY, type RoleName } from './registry'

// Quem lê e escreve o quê (contrato §4 e §11). No servidor é a autoridade;
// no app só decide o que mostrar. Fail secure: papel desconhecido não conta,
// conjunto vazio não lê nada, e campo citado por várias seções obedece à mais
// restrita.
//
// Papéis na ficha: `owner` (dono), `storyteller` (narrador da crônica) e
// `viewer` (membro que recebeu a projeção completa de um NPC). Quem chama
// resolve os papéis no banco, nunca a partir do cliente. Viewer só lê seções
// públicas: mesmo uma seção sem permissions nunca fica gravável para ele.

export type Roles = Iterable<RoleName | string>

const DEFAULT_READ: readonly RoleName[] = ['owner', 'storyteller', 'viewer']
const DEFAULT_WRITE: readonly RoleName[] = ['owner', 'storyteller']

const known = (roles: Roles): Set<RoleName> => {
  const out = new Set<RoleName>()
  for (const r of roles)
    if ((REGISTRY.roles as readonly string[]).includes(r))
      out.add(r as RoleName)
  return out
}

const allows = (list: readonly RoleName[], roles: Set<RoleName>) =>
  list.some(r => roles.has(r))

export function canReadSection(
  model: SheetModel,
  sectionId: string,
  roles: Roles
): boolean {
  const section = model.sections.get(sectionId)
  const mine = known(roles)
  if (!section || mine.size === 0) return false
  return allows(section.def.permissions?.read ?? DEFAULT_READ, mine)
}

export function canRead(
  model: SheetModel,
  fieldId: FieldId,
  roles: Roles
): boolean {
  const field = model.fields.get(fieldId)
  const mine = known(roles)
  if (!field || mine.size === 0) return false
  if (field.sectionIds.length === 0) return allows(DEFAULT_READ, mine)
  return field.sectionIds.every(s => canReadSection(model, s, mine))
}

export function canWrite(
  model: SheetModel,
  fieldId: FieldId,
  roles: Roles
): boolean {
  const field = model.fields.get(fieldId)
  const mine = known(roles)
  if (!field || field.readOnly || !canRead(model, fieldId, mine)) return false
  if (field.sectionIds.length === 0) return allows(DEFAULT_WRITE, mine)
  return field.sectionIds.every(id => {
    const write = model.sections.get(id)?.def.permissions?.write
    return allows(write ?? DEFAULT_WRITE, mine)
  })
}

/**
 * A ficha sem o que os papéis não podem ler: valores e especializações. O
 * servidor aplica em toda saída (ficha, mesa, histórico, conflito); o
 * aparelho de quem não pode ler nunca recebe o dado.
 */
export function stripRestricted(
  model: SheetModel,
  sheet: SheetData,
  roles: Roles
): SheetData {
  const mine = known(roles)
  const keep = (id: string) => canRead(model, id, mine)
  const values = Object.fromEntries(
    Object.entries(sheet.values ?? {}).filter(([id]) => keep(id))
  )
  const specialties = Object.fromEntries(
    Object.entries(sheet.specialties ?? {}).filter(([id]) => keep(id))
  )
  return { values, specialties }
}
