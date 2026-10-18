// Senha com argon2id (Bun.password, sem dependência nova). Login com usuário
// inexistente verifica um hash fixo, para o tempo de resposta não revelar
// quais contas existem.
import { password as bunPassword } from 'bun'

let dummy: Promise<string> | undefined

export const hashPassword = (password: string): Promise<string> =>
  bunPassword.hash(password, { algorithm: 'argon2id' })

export async function verifyPassword(
  password: string,
  hash: string | null
): Promise<boolean> {
  dummy ??= hashPassword('tms: hash fixo para igualar o tempo de resposta')
  try {
    const ok = await bunPassword.verify(password, hash ?? (await dummy))
    return hash !== null && ok
  } catch {
    // Hash malformado no banco: nega
    return false
  }
}
