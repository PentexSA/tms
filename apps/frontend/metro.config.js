/* eslint-env node */
/* eslint @typescript-eslint/no-var-requires: "off" */

const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const symlinkResolver = require('@rnx-kit/metro-resolver-symlinks')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Garanta que o Metro enxerga o monorepo com pnpm (symlinks)
config.watchFolders = [workspaceRoot]

// Resolver que entende symlinks do pnpm
config.resolver = {
  ...config.resolver,
  resolveRequest: symlinkResolver(),
  // (opcional) ajuda quando há múltiplos node_modules no mono
  nodeModulesPaths: [
    path.join(projectRoot, 'node_modules'),
    path.join(workspaceRoot, 'node_modules'),
  ],
  // às vezes útil para libs antigas publicadas em .cjs
  sourceExts: [...config.resolver.sourceExts, 'cjs'],
}

module.exports = config
