import { t } from 'elysia'

// Ids de rota são UUID: um id malformado nunca chega ao Postgres (que
// responderia com erro de sintaxe, um 500).
export const uuid = t.String({ format: 'uuid' })
export const idParams = t.Object({ id: uuid })
