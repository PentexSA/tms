import { defineWorkspace } from 'vitest/config'

/**
 * Vitest Workspace Configuration
 *
 * Permite executar todos os testes do monorepo de uma vez com:
 * - pnpm test (via root)
 * - Merged coverage reports automáticos
 * - Melhor DX para desenvolvimento local
 *
 * Mantém compatibilidade com Turborepo para CI (cache per-package)
 *
 * Uso:
 * - `pnpm test` - Roda todos os testes via Turborepo (com cache)
 * - `vitest` (no root) - Roda workspace Vitest (sem Turborepo, útil para debug)
 * - `vitest --project api` - Roda apenas um projeto específico
 */
export default defineWorkspace([
  // Apps
  'apps/api/vitest.config.ts',
  // Adicione aqui quando implementar testes no frontend:
  // 'apps/frontend/vitest.config.ts',

  // Packages (quando tiverem testes)
  // 'packages/db/vitest.config.ts',
  // 'packages/config/vitest.config.ts',
  // 'packages/ui/vitest.config.ts',
])
