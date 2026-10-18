// O app importa só o TIPO da API (Eden Treaty), e para isso o tsc lê o código
// de apps/api, que roda no Bun. Aqui ficam só as assinaturas do módulo 'bun'
// que a API usa; nada disso existe nem é empacotado no app.
declare module 'bun' {
  export const password: {
    hash(
      password: string,
      options?: { algorithm: 'argon2id' | 'argon2i' | 'argon2d' | 'bcrypt' }
    ): Promise<string>
    verify(password: string, hash: string): Promise<boolean>
  }
}
