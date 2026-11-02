// O src do @tms/ui (que o Metro e o Jest leem desde o S-01) compila com o JSX
// do React, como o dist do tsc compilava. Com o JSX do NativeWind, o Pressable
// do @tms/ui perdia no nativo o style em função (estado pressionado): botões
// sem fundo nem padding, linhas sem layout e alvo sem os 44/48 dp. O web não
// mostrava o defeito. O @tms/ui não usa className.
// Função, não RegExp: o transformer do Expo carrega este config sem nome de
// arquivo para a chave de cache, e o Babel recusa RegExp sem nome de arquivo
const UI_SRC = /[\\/]packages[\\/]ui[\\/]src[\\/]/
const uiSource = filename =>
  typeof filename === 'string' && UI_SRC.test(filename)

module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    overrides: [
      {
        exclude: uiSource,
        presets: [
          ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
          'nativewind/babel',
        ],
      },
    ],
  }
}
