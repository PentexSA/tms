/**
 * Re-export all migrations for use in different contexts
 * This ensures migrations can be imported and used from anywhere in the monorepo
 * without duplicating migration code
 */

export {
  down as migration_0001_init_down,
  up as migration_0001_init_up,
} from './migrations/0001_init'
export {
  down as migration_0002_users_down,
  up as migration_0002_users_up,
} from './migrations/0002_users'
export {
  down as migration_0003_game_systems_down,
  up as migration_0003_game_systems_up,
} from './migrations/0003_game_systems'
export {
  down as migration_0004_chronicles_down,
  up as migration_0004_chronicles_up,
} from './migrations/0004_chronicles'
export {
  down as migration_0005_characters_down,
  up as migration_0005_characters_up,
} from './migrations/0005_characters'
export {
  down as migration_0006_trait_templates_down,
  up as migration_0006_trait_templates_up,
} from './migrations/0006_trait_templates'
