import type { Migration, MigrationProvider } from 'kysely'
import * as m0001 from './migrations/0001_init'
import * as m0002 from './migrations/0002_users'
import * as m0003 from './migrations/0003_game_systems'
import * as m0004 from './migrations/0004_chronicles'
import * as m0005 from './migrations/0005_characters'
import * as m0006 from './migrations/0006_trait_templates'
import * as m0007 from './migrations/0007_drop_todos'
import * as m0008 from './migrations/0008_template_versions'
import * as m0009 from './migrations/0009_auth'
import * as m0010 from './migrations/0010_chronicle_members'
import * as m0011 from './migrations/0011_character_sync'
import * as m0012 from './migrations/0012_rolls'
import * as m0013 from './migrations/0013_account_deletion'
import * as m0014 from './migrations/0014_character_status'
import * as m0015 from './migrations/0015_chronicle_operations'
import * as m0016 from './migrations/0016_character_creation'
import * as m0017 from './migrations/0017_xp_ledger'
import * as m0018 from './migrations/0018_xp_requests'
import * as m0019 from './migrations/0019_backstage'
import * as m0020 from './migrations/0020_product_templates'

/**
 * Fonte única das migrations, em ordem. O `migrate.ts` (Postgres) e o PGLite
 * dos testes usam esta lista; um teste confere que todo arquivo de
 * `migrations/` está aqui.
 */
export const migrations: Readonly<Record<string, Migration>> = {
  '0001_init': m0001,
  '0002_users': m0002,
  '0003_game_systems': m0003,
  '0004_chronicles': m0004,
  '0005_characters': m0005,
  '0006_trait_templates': m0006,
  '0007_drop_todos': m0007,
  '0008_template_versions': m0008,
  '0009_auth': m0009,
  '0010_chronicle_members': m0010,
  '0011_character_sync': m0011,
  '0012_rolls': m0012,
  '0013_account_deletion': m0013,
  '0014_character_status': m0014,
  '0015_chronicle_operations': m0015,
  '0016_character_creation': m0016,
  '0017_xp_ledger': m0017,
  '0018_xp_requests': m0018,
  '0019_backstage': m0019,
  '0020_product_templates': m0020,
}

export const migrationProvider: MigrationProvider = {
  getMigrations: async () => ({ ...migrations }),
}
