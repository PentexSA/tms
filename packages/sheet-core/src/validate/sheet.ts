import { DERIVE, isDeriveName } from '../derive'
import type { Issue } from './issues'
import {
  asArray,
  flat1,
  get,
  isListItemRef,
  isObj,
  listItemValue,
  NUM_LIMIT,
  numOr,
  type Obj,
  own,
  rec,
} from './util'

// Porta de validateSheet (design/scripts/validate.mjs) com as mesmas mensagens
// e caminhos. Valida sheet_data contra o template: o servidor aplica isto a
// cada escrita; o cliente, antes de enfileirar (conveniência).
//
// O template já passou por validateTemplate. Fail secure: chave desconhecida,
// tipo sem validador ou valor malformado viram erro, nunca exceção nem "passa".
//
// Diferença deliberada, mais estrita: `meta` num item de lista sem `item.meta`
// é rejeitado com mensagem própria (a referência rejeita por exceção).

export function validateSheet(template: unknown, sheet: unknown): Issue[] {
  if (!isObj(sheet) || !isObj(sheet.values))
    return [
      {
        path: '',
        message: 'sheet_data malformado (esperado { values, specialties })',
      },
    ]
  const issues: Issue[] = []
  const err = (path: string, message: string) => {
    issues.push({ path, message })
  }
  try {
    check(rec(template) ?? {}, sheet, sheet.values, err)
  } catch {
    issues.push({ path: '', message: 'sheet_data malformado' })
  }
  return issues
}

function check(
  t: Obj,
  sheet: Obj,
  values: Obj,
  err: (path: string, message: string) => void
): void {
  for (const k of Object.keys(sheet))
    if (k !== 'values' && k !== 'specialties')
      err(k, 'chave desconhecida (rejeitada)')
  const fields = rec(t.fields) ?? {}
  const markStates = rec(t.markStates) ?? {}

  const int = (p: string, v: unknown, min: unknown, max: unknown) => {
    if (typeof v !== 'number' || !Number.isInteger(v))
      return err(p, 'precisa ser inteiro')
    if (typeof min === 'number' && v < min) err(p, `abaixo do mínimo ${min}`)
    if (typeof max === 'number' && v > max) err(p, `acima do máximo ${max}`)
  }
  const str = (p: string, v: unknown, max: number) => {
    if (typeof v !== 'string') return err(p, 'precisa ser texto')
    if (v.length > max) err(p, `acima de ${max} caracteres`)
  }
  const onlyKeys = (
    p: string,
    v: unknown,
    allowed: readonly unknown[]
  ): v is Obj => {
    if (!isObj(v)) {
      err(p, 'precisa ser objeto')
      return false
    }
    for (const k of Object.keys(v))
      if (!allowed.includes(k))
        err(`${p}.${k}`, 'chave desconhecida (rejeitada)')
    return true
  }
  const ids = (list: unknown): unknown[] => asArray(list).map(o => rec(o)?.id)

  for (const [id, v] of Object.entries(values)) {
    const p = `values.${id}`
    if (!own(fields, id)) {
      err(p, 'campo não existe no template (rejeitado)')
      continue
    }
    const f = rec(fields[id])
    if (!f) {
      err(p, 'campo malformado no template (rejeitado)')
      continue
    }
    if (f.readOnly) {
      err(p, 'campo derivado: o servidor calcula, o cliente não grava')
      continue
    }
    try {
      switch (f.type) {
        case 'rating':
          int(p, v, numOr(f.min, 0), numOr(f.max, 5))
          break
        case 'number':
          int(p, v, numOr(f.min, -NUM_LIMIT), numOr(f.max, NUM_LIMIT))
          break
        case 'percent':
          int(p, v, 0, numOr(f.max, 99))
          break
        case 'text':
        case 'longText':
          str(p, v, numOr(f.maxLength, f.type === 'longText' ? 4000 : 200))
          break
        case 'choice':
          if (!ids(f.options).includes(v)) err(p, 'opção inexistente')
          break
        case 'state':
          if (!ids(f.options).includes(v)) err(p, 'estado inexistente')
          break
        case 'mark':
          if (!ids(get(markStates, f.states)).includes(v))
            err(p, 'marca inexistente')
          break
        case 'tags': {
          const options = ids(f.options)
          if (
            !Array.isArray(v) ||
            v.length > options.length ||
            new Set(v).size !== v.length ||
            v.some(x => !options.includes(x))
          )
            err(p, 'tags inválidas')
          break
        }
        case 'resource': {
          if (!onlyKeys(p, v, ['current', 'max', 'permanent', 'temp'])) break
          int(`${p}.current`, v.current, 0, 9999)
          if (f.permanent) {
            const permanent = rec(f.permanent)
            int(`${p}.permanent`, v.permanent, permanent?.min, permanent?.max)
            if (
              !f.tempUncapped &&
              typeof v.current === 'number' &&
              typeof v.permanent === 'number' &&
              v.current > v.permanent
            )
              err(`${p}.current`, 'acima do permanente')
          } else if (v.permanent != null)
            err(`${p}.permanent`, 'campo sem permanente')
          if (f.temp) {
            if (v.temp != null) int(`${p}.temp`, v.temp, 0, 9999)
          } else if (v.temp != null) err(`${p}.temp`, 'campo sem temporário')
          const max = rec(f.max)
          if (max?.stored) int(`${p}.max`, v.max, max.min, max.max)
          else if (v.max != null)
            err(`${p}.max`, 'o máximo é derivado: o cliente não grava')
          // Teto efetivo: permanente, número fixo, máximo gravado, outro campo ou derivação.
          const cap = resourceCap(fields, values, f, v)
          if (
            cap != null &&
            typeof v.current === 'number' &&
            Number.isInteger(v.current) &&
            v.current > cap
          )
            err(`${p}.current`, `acima do máximo (${cap})`)
          break
        }
        case 'track':
          if (f.rule === 'wod-stacking') {
            const kinds = ids(f.types)
            const levels = asArray(f.levels).length
            if (!onlyKeys(p, v, kinds)) break
            for (const k of kinds) int(`${p}.${k}`, get(v, k) ?? 0, 0, levels)
            const total = kinds.reduce<number>(
              (n, k) => n + numOr(get(v, k), 0),
              0
            )
            if (total > levels) err(p, 'mais dano que níveis')
          } else {
            const rows = asArray(f.rows).map(rec)
            if (
              !onlyKeys(
                p,
                v,
                rows.map(r => r?.id)
              )
            )
              break
            for (const r of rows) {
              const boxes = get(v, r?.id)
              if (
                !Array.isArray(boxes) ||
                boxes.length !== r?.boxes ||
                boxes.some(b => typeof b !== 'boolean')
              )
                err(`${p}.${r?.id}`, `precisa de ${r?.boxes} caixas booleanas`)
            }
          }
          break
        case 'clock': {
          const fills = ids(f.fills)
          if (!onlyKeys(p, v, fills)) break
          for (const x of fills) int(`${p}.${x}`, get(v, x) ?? 0, 0, f.segments)
          const total = fills.reduce<number>(
            (n, x) => n + numOr(get(v, x), 0),
            0
          )
          if (total > numOr(f.segments, 0))
            err(p, 'preenchimentos acima do número de casas')
          break
        }
        case 'slots':
          if (!isObj(v)) {
            err(p, 'precisa ser objeto')
            break
          }
          for (const [lvl, s] of Object.entries(v)) {
            if (!/^[1-9]$/.test(lvl) || Number(lvl) > numOr(f.levels, 0)) {
              err(`${p}.${lvl}`, 'nível inexistente')
              continue
            }
            if (!onlyKeys(`${p}.${lvl}`, s, ['max', 'used'])) continue
            int(`${p}.${lvl}.max`, s.max, 0, 9)
            int(`${p}.${lvl}.used`, s.used, 0, s.max)
          }
          break
        case 'list': {
          if (!Array.isArray(v)) {
            err(p, 'precisa ser lista')
            break
          }
          if (v.length > 200) err(p, 'lista grande demais')
          const item = rec(f.item)
          const meta = asArray(item?.meta)
            .map(rec)
            .filter(m => m !== undefined)
          const metaIds = meta.map(m => m.id)
          const fixedIds = Array.isArray(f.fixed) ? ids(f.fixed) : undefined
          const seen = new Set<unknown>()
          for (const [i, it] of v.entries()) {
            const q = `${p}.${i}`
            if (
              !onlyKeys(q, it, [
                'id',
                'name',
                'text',
                'value',
                'specialty',
                'notes',
                'meta',
              ])
            )
              continue
            str(`${q}.id`, it.id, 40)
            if (seen.has(it.id)) err(`${q}.id`, 'id repetido')
            seen.add(it.id)
            if (fixedIds && !fixedIds.includes(it.id))
              err(`${q}.id`, 'item fixo inexistente')
            if (it.name != null) str(`${q}.name`, it.name, 80)
            if (it.text != null) str(`${q}.text`, it.text, 200)
            if (it.notes != null) {
              if (!item?.notes) err(`${q}.notes`, 'lista sem notas')
              else str(`${q}.notes`, it.notes, 2000)
            }
            if (it.specialty != null) {
              if (!item?.specialty)
                err(`${q}.specialty`, 'lista sem especialização')
              else str(`${q}.specialty`, it.specialty, 80)
            }
            if (it.value != null) {
              const value = rec(item?.value)
              if (!item?.value) err(`${q}.value`, 'lista sem valor')
              else
                int(
                  `${q}.value`,
                  it.value,
                  numOr(value?.min, 0),
                  numOr(value?.max, 5)
                )
            }
            const itemMeta = it.meta
            if (itemMeta != null && !item?.meta)
              err(`${q}.meta`, 'lista sem meta')
            else if (
              itemMeta != null &&
              onlyKeys(`${q}.meta`, itemMeta, metaIds)
            ) {
              for (const m of meta) {
                const mv = get(itemMeta, m.id)
                if (mv == null) continue
                if (m.type === 'number')
                  int(
                    `${q}.meta.${m.id}`,
                    mv,
                    numOr(m.min, -NUM_LIMIT),
                    numOr(m.max, NUM_LIMIT)
                  )
                else str(`${q}.meta.${m.id}`, mv, 80)
              }
            }
          }
          break
        }
        default:
          err(p, `tipo '${f.type}' sem validador (rejeitado)`)
      }
    } catch {
      err(p, 'valor malformado')
    }
  }

  const specialties = sheet.specialties
  if (specialties != null) {
    if (!isObj(specialties)) err('specialties', 'precisa ser objeto')
    else
      for (const [id, s] of Object.entries(specialties)) {
        if (!own(fields, id) || !rec(fields[id])?.specialty)
          err(`specialties.${id}`, 'campo não aceita especialização')
        str(`specialties.${id}`, s, 80)
      }
  }
}

// Número de um campo a partir dos valores gravados (sem modificadores de estado).
function numberOf(fields: Obj, values: Obj, id: unknown, depth = 0): number {
  const f = own(fields, id) ? rec(fields[id as string]) : undefined
  if (!f || depth > 4) return 0
  if (f.readOnly && f.derive && isDeriveName(f.derive))
    return DERIVE[f.derive](
      ...flat1(f.from).map(x =>
        isListItemRef(x)
          ? listItemValue(get(values, x.list), x.item)
          : numberOf(fields, values, x, depth + 1)
      )
    )
  const v = get(values, id)
  if (typeof v === 'number' && Number.isInteger(v)) return v
  if (isObj(v)) {
    const n = v.permanent ?? v.current
    if (typeof n === 'number' && Number.isInteger(n)) return n
  }
  return numOr(f.default, numOr(f.min, 0))
}

// Teto do valor atual de um resource; null quando não há teto conhecido.
function resourceCap(fields: Obj, values: Obj, f: Obj, v: Obj): number | null {
  const asNumber = (x: unknown) => (typeof x === 'number' ? x : null)
  if (f.permanent && !f.tempUncapped) return asNumber(v.permanent)
  if (f.overMax) return null
  if (typeof f.max === 'number') return f.max
  const max = rec(f.max)
  if (max?.stored) return asNumber(v.max)
  if (max?.field) return numberOf(fields, values, max.field)
  if (max?.derive && isDeriveName(max.derive))
    return DERIVE[max.derive](
      ...flat1(max.from).map(x =>
        isListItemRef(x)
          ? listItemValue(get(values, x.list), x.item)
          : numberOf(fields, values, x)
      )
    )
  return null
}
