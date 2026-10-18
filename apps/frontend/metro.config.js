/* eslint-env node */
/* eslint @typescript-eslint/no-var-requires: "off" */

const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Garanta que o Metro enxerga o monorepo. Com nodeLinker: hoisted não há
// symlinks do pnpm a resolver: o resolver padrão do Expo basta (o
// @rnx-kit/metro-resolver-symlinks quebra no Metro 0.84 do SDK 57).
config.watchFolders = [workspaceRoot]

config.resolver = {
  ...config.resolver,
  // (opcional) ajuda quando há múltiplos node_modules no mono
  nodeModulesPaths: [
    path.join(projectRoot, 'node_modules'),
    path.join(workspaceRoot, 'node_modules'),
  ],
  // às vezes útil para libs antigas publicadas em .cjs
  sourceExts: [...config.resolver.sourceExts, 'cjs'],
}

module.exports = withNativeWind(config, { input: './global.css' })
