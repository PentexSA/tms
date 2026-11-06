// Android: o tamanho da tela (densidade) e o da fonte do sistema mudam sem
// recriar a Activity. Com a Activity recriada, o Expo adia o onDestroy da
// antiga, e por um instante há duas raízes do app montadas: o Expo Router
// acusa dois linkings e duas filas de rotas, e a navegação por `router.push`
// chegou a falhar (onda-5.md §11.6). O React Native trata as duas mudanças
// sem recriar: o `onConfigurationChanged` relê as métricas da tela
// (`DisplayMetricsHolder`) e refaz o layout com a fonte nova
// (`enableFontScaleChangesUpdatingLayout`, ligado por padrão).
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins')

const EXTRA = ['density', 'fontScale']

/** Acrescenta EXTRA ao `android:configChanges` da MainActivity, sem repetir. */
function addConfigChanges(manifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest)
  const current = (activity.$['android:configChanges'] ?? '')
    .split('|')
    .filter(Boolean)
  const next = [...current, ...EXTRA.filter(x => !current.includes(x))]
  activity.$['android:configChanges'] = next.join('|')
  return manifest
}

const withConfigChanges = config =>
  withAndroidManifest(config, mod => {
    mod.modResults = addConfigChanges(mod.modResults)
    return mod
  })

module.exports = withConfigChanges
module.exports.addConfigChanges = addConfigChanges
