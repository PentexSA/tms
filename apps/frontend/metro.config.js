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

// S-01: o app roda o mesmo código que o Jest testa. Os pacotes do monorepo
// vêm do src, sem build e sem dist velho; os mapeamentos andam junto com os
// do Jest (jest.config.js e @tms/jest-config). Vem antes do withNativeWind,
// que embrulha este resolver.
const SOURCE = {
  '@tms/sheet-core': path.join(
    workspaceRoot,
    'packages/sheet-core/src/index.ts'
  ),
  '@tms/ui': path.join(workspaceRoot, 'packages/ui/src/index.ts'),
}
const upstream = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, name, platform) =>
  SOURCE[name]
    ? { type: 'sourceFile', filePath: SOURCE[name] }
    : (upstream ?? context.resolveRequest)(context, name, platform)

// Constants.expoConfig vem do manifesto que o Babel inlina no transform, e a
// chave do cache do Metro não olha o app.json: sem isto, o bundle sai com a versão
// anterior (no x-tms-client-version e no buster do cache persistido) em toda
// máquina com cache, a cada release.
config.cacheVersion = require('./app.json').expo.version

module.exports = withNativeWind(config, { input: './global.css' })
