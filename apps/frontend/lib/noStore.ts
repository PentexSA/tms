// No web, nada: o navegador já respeita o no-store da resposta da API, e um
// cache-control na requisição deixaria de ser cabeçalho "safelisted" (teria
// de entrar no CORS e geraria preflight em toda chamada). O nativo usa
// noStore.native.ts; o Metro escolhe pelo sufixo.
export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {}
