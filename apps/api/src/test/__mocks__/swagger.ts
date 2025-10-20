/**
 * Mock for @elysiajs/swagger
 *
 * Este mock é necessário porque @elysiajs/swagger importa módulos ESM
 * que não são compatíveis com Jest. Como o Swagger UI não é necessário
 * para os testes da API (apenas para documentação), podemos mocká-lo
 * com segurança.
 */

/**
 * Mock da função swagger que retorna um plugin Elysia vazio
 * Usa 'unknown' para evitar problemas de tipos complexos do Elysia com plugins
 */
export const swagger = () => {
  // biome-ignore lint/suspicious/noExplicitAny: Mock function requires any for flexibility
  return (app: any) => app
}
