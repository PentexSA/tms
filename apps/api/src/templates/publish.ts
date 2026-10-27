import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canonicalJson, type DB, storeTemplate } from '@tms/db'
import {
  compileTemplate,
  type Issue,
  PALETTE,
  UnsupportedTemplateError,
  validateTemplate,
} from '@tms/sheet-core'
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020'
import type { Kysely } from 'kysely'

// Publicação de template (doc/plano-v0.md, Etapa 6). Só o dono do app publica,
// por script; não existe rota de escrita de template. As duas camadas do
// contrato rodam juntas: schema.json (forma) e validateTemplate (referências).
//
// O Ajv gera código com `new Function`: fica só aqui (servidor e CI) e nunca
// entra no bundle do app, que teria de liberar `unsafe-eval` na CSP.

export type PublishStage = 'json' | 'schema' | 'contract' | 'version'

export interface PublishIssue extends Issue {
  readonly stage: PublishStage
}

export class PublishError extends Error {
  readonly issues: readonly PublishIssue[]

  constructor(issues: readonly PublishIssue[]) {
    super('template recusado')
    this.name = 'PublishError'
    this.issues = issues
  }
}

export interface PublishResult {
  readonly status: 'published' | 'unchanged'
  readonly system: string
  readonly version: string
  // sha256 do JSON canônico: o mesmo conteúdo dá o mesmo hash.
  readonly hash: string
}

export const SCHEMA_PATH = join(
  import.meta.dir,
  '../../../../design/templates/schema.json'
)

let validateSchema: ValidateFunction | undefined

function schema(): ValidateFunction {
  // strictTypes e strictRequired são checagens de estilo do autor do schema e
  // não aceitam o if/then que o contrato usa; o resto do modo estrito fica
  // ligado (palavra-chave desconhecida no schema é erro).
  validateSchema ??= new Ajv2020({
    strict: true,
    strictTypes: false,
    strictRequired: false,
    allErrors: true,
  }).compile(JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')))
  return validateSchema
}

export function schemaIssues(json: unknown): PublishIssue[] {
  const validate = schema()
  if (validate(json)) return []
  const seen = new Set<string>()
  const issues: PublishIssue[] = []
  for (const e of validate.errors ?? []) {
    const path = e.instancePath || '/'
    const message = e.message ?? 'inválido'
    const key = `${path} ${message}`
    if (seen.has(key)) continue
    seen.add(key)
    issues.push({ stage: 'schema', path, message })
  }
  return issues
}

export { canonicalJson }

export async function publishTemplate(
  db: Kysely<DB>,
  json: unknown
): Promise<PublishResult> {
  if (json === null || typeof json !== 'object' || Array.isArray(json))
    throw new PublishError([
      { stage: 'json', path: '', message: 'o template precisa ser um objeto' },
    ])

  const shape = schemaIssues(json)
  if (shape.length) throw new PublishError(shape)

  const contract = validateTemplate(json, PALETTE)
  if (contract.length)
    throw new PublishError(contract.map(i => ({ ...i, stage: 'contract' })))
  try {
    compileTemplate(json)
  } catch (e) {
    if (!(e instanceof UnsupportedTemplateError)) throw e
    throw new PublishError(e.issues.map(i => ({ ...i, stage: 'contract' })))
  }

  return db.transaction().execute(async trx => {
    const stored = await storeTemplate(trx, json)
    // Versão publicada é imutável: o erro desfaz também o nome do sistema
    if (stored.status === 'conflict')
      throw new PublishError([
        {
          stage: 'version',
          path: 'templateVersion',
          message: `${stored.system}@${stored.version} já foi publicado com outro conteúdo: suba o templateVersion`,
        },
      ])
    return { ...stored, status: stored.status }
  })
}
