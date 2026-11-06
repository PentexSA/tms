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

// U-11 (P16-D): seções que o narrador pode revelar ao dono, ficha a ficha, só
// em leitura. A regra sai das permissions do template, sem chave nova: a
// seção é lida pelo narrador e por nenhum outro papel, tem campos e todos são
// texto, e nenhum campo dela está numa seção que o dono não lê e que não seja
// revelável também. Nos templates do repositório, é a seção do narrador.
const TEXT_TYPES: ReadonlySet<string> = new Set(['text', 'longText'])

const storytellerOnly = (read: readonly RoleName[] | undefined) =>
  read !== undefined &&
  read.includes('storyteller') &&
  !read.includes('owner') &&
  !read.includes('viewer')

const revealableCache = new WeakMap<SheetModel, readonly string[]>()

export function revealableSections(model: SheetModel): readonly string[] {
  const cached = revealableCache.get(model)
  if (cached) return cached
  const owner = new Set<RoleName>(['owner'])
  const ids = new Set<string>()
  for (const s of model.sections.values()) {
    if (!storytellerOnly(s.def.permissions?.read)) continue
    if (s.fieldIds.length === 0) continue
    const textOnly = s.fieldIds.every(id =>
      TEXT_TYPES.has(model.fields.get(id)?.type ?? '')
    )
    if (textOnly) ids.add(s.id)
  }
  // Tira, até estabilizar, a seção com campo também citado numa seção que o
  // dono não lê e que não é revelável.
  let changed = true
  while (changed) {
    changed = false
    for (const id of ids) {
      const section = model.sections.get(id)
      const blocked = section?.fieldIds.some(fid =>
        (model.fields.get(fid)?.sectionIds ?? []).some(other => {
          if (ids.has(other)) return false
          const read = model.sections.get(other)?.def.permissions?.read
          return !allows(read ?? DEFAULT_READ, owner)
        })
      )
      if (blocked) {
        ids.delete(id)
        changed = true
      }
    }
  }
  const out = Object.freeze([...ids])
  revealableCache.set(model, out)
  return out
}

// As seções reveladas que valem: só as que o modelo deixa revelar. Id
// desconhecido ou seção não revelável não contam (fail secure).
const revealedSet = (
  model: SheetModel,
  revealed: Iterable<string> | undefined
): ReadonlySet<string> | null => {
  if (revealed === undefined) return null
  const allowed = revealableSections(model)
  const out = new Set<string>()
  for (const id of revealed) if (allowed.includes(id)) out.add(id)
  return out.size > 0 ? out : null
}

const readsSection = (
  model: SheetModel,
  sectionId: string,
  mine: Set<RoleName>,
  revealed: ReadonlySet<string> | null
): boolean => {
  const section = model.sections.get(sectionId)
  if (!section || mine.size === 0) return false
  if (allows(section.def.permissions?.read ?? DEFAULT_READ, mine)) return true
  // A revelação só abre ao dono: nunca ao viewer nem a papel desconhecido.
  return revealed !== null && mine.has('owner') && revealed.has(sectionId)
}

/**
 * `revealed`: as seções que o narrador revelou ao dono nesta ficha (U-11). Sem
 * ele, ou vazio, a regra é só por papel. Só o servidor (a rota da nota
 * revelada) e a aba "Sobre" do dono passam a lista; o `canWrite` nunca.
 */
export function canReadSection(
  model: SheetModel,
  sectionId: string,
  roles: Roles,
  revealed?: Iterable<string>
): boolean {
  return readsSection(
    model,
    sectionId,
    known(roles),
    revealedSet(model, revealed)
  )
}

const readsField = (
  model: SheetModel,
  fieldId: FieldId,
  mine: Set<RoleName>,
  revealed: ReadonlySet<string> | null
): boolean => {
  const field = model.fields.get(fieldId)
  if (!field || mine.size === 0) return false
  if (field.sectionIds.length === 0) return allows(DEFAULT_READ, mine)
  return field.sectionIds.every(s => readsSection(model, s, mine, revealed))
}

export function canRead(
  model: SheetModel,
  fieldId: FieldId,
  roles: Roles,
  revealed?: Iterable<string>
): boolean {
  return readsField(model, fieldId, known(roles), revealedSet(model, revealed))
}

export function canWrite(
  model: SheetModel,
  fieldId: FieldId,
  roles: Roles
): boolean {
  const field = model.fields.get(fieldId)
  const mine = known(roles)
  // Sem `revealed`, de propósito: a revelação nunca dá escrita (U-11).
  if (!field || field.readOnly || !readsField(model, fieldId, mine, null))
    return false
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
  roles: Roles,
  revealed?: Iterable<string>
): SheetData {
  const mine = known(roles)
  const open = revealedSet(model, revealed)
  const keep = (id: string) => readsField(model, id, mine, open)
  const values = Object.fromEntries(
    Object.entries(sheet.values ?? {}).filter(([id]) => keep(id))
  )
  const specialties = Object.fromEntries(
    Object.entries(sheet.specialties ?? {}).filter(([id]) => keep(id))
  )
  return { values, specialties }
}
