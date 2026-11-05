// Os valores marcados e o transporte falso dos testes de telemetria. O texto
// marcado não pode aparecer em lugar nenhum do envelope serializado, o que iria
// pela rede, nem nos campos que o SDK preenche.

export const EMAIL = 'pessoa.canario@example.test'
export const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcmlvIn0.c2VncmVkby1kby1jYW5hcmlv'
export const BEARER_TOKEN = 'tokencanario123'
export const DB_PASSWORD = 'senha-canario'
export const NOTE = 'o vampiro esconde a carta da Camarilla'
export const COOKIE = 'refresh=cookiecanario999'
export const HEADER_VALUE = 'headercanario888'
export const QUERY_VALUE = 'querycanario777'
export const BODY_VALUE = 'corpocanario666'
export const CANARIES = [
  EMAIL,
  JWT,
  BEARER_TOKEN,
  DB_PASSWORD,
  NOTE,
  'vampiro',
  'cookiecanario999',
  HEADER_VALUE,
  QUERY_VALUE,
  BODY_VALUE,
]

export const DSN = 'https://chave@o0.ingest.sentry.test/1'

/**
 * Um por arquivo: os módulos são compartilhados entre os arquivos do `bun test`,
 * e o que um arquivo envia não pode chegar à lista de outro.
 */
export function fakeTransport() {
  const sent: string[] = []
  const transport = () => ({
    send: async (envelope: unknown) => {
      sent.push(JSON.stringify(envelope))
      return {}
    },
    flush: async () => true,
  })
  return { sent, transport }
}
