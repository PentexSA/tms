import { beforeEach } from 'vitest'
import { clearAllTables } from './helpers'

beforeEach(async () => {
  await clearAllTables()
})
