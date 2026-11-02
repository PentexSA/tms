// T-13, defesa em profundidade no aparelho: toda requisição à API pede
// no-store. O OkHttp (Android) não grava a resposta de uma requisição que
// pede no-store, mesmo que a resposta venha sem o cabeçalho (erro de
// proxy). O que garante no iOS é a resposta da API e o módulo http-cache.
export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-store',
}
