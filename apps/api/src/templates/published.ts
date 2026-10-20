import { join } from 'node:path'

// Os templates do produto, na ordem de publicação (plano-v1, Etapa 7). Os
// outros de design/templates são fixtures de teste e nunca vão ao banco. Um
// template só entra aqui depois que a versão do app que o desenha estiver no
// ar (doc/arquitetura §5.3): o app antigo abriria a ficha, mas sem as regras.
export const PUBLISHED_SYSTEMS = ['vtm-v20', 'mta-m20'] as const

const ROOT = join(import.meta.dir, '../../../..')

/** O caminho de cada template publicado, a partir da raiz do repo. */
export const publishedFiles = (): string[] =>
  PUBLISHED_SYSTEMS.map(s => join(ROOT, 'design/templates', `${s}.json`))
