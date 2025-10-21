import type { Insertable, Selectable, Updateable } from 'kysely'
import type { Todos } from './types'

export { db } from './client'
export type { DB } from './types'

export type Todo = Selectable<Todos>
export type NewTodo = Insertable<Todos>
export type TodoUpdate = Updateable<Todos>

// Export migrations for reuse in test environments
export {
  migration_0001_init_down,
  migration_0001_init_up,
  migration_0002_users_down,
  migration_0002_users_up,
  migration_0003_game_systems_down,
  migration_0003_game_systems_up,
  migration_0004_chronicles_down,
  migration_0004_chronicles_up,
  migration_0005_characters_down,
  migration_0005_characters_up,
  migration_0006_trait_templates_down,
  migration_0006_trait_templates_up,
} from './migrations'
