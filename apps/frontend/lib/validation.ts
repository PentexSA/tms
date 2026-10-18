// Mesmas regras da API (apps/api/src/auth/routes.ts). Aqui são só para o
// aviso chegar antes; quem decide é o servidor.

export const USERNAME = /^[a-z0-9_]{3,24}$/
export const PASSWORD_MIN = 15
export const PASSWORD_MAX = 128

export interface RegisterInput {
  readonly email: string
  readonly username: string
  readonly password: string
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export function validateRegister(
  input: RegisterInput
): FieldErrors<RegisterInput> {
  const errors: FieldErrors<RegisterInput> = {}
  const email = input.email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    errors.email = 'Informe um e-mail válido'
  if (!USERNAME.test(input.username))
    errors.username = 'De 3 a 24 caracteres: letras minúsculas, números e _'
  if (input.password.length < PASSWORD_MIN)
    errors.password = `Pelo menos ${PASSWORD_MIN} caracteres`
  else if (input.password.length > PASSWORD_MAX)
    errors.password = `No máximo ${PASSWORD_MAX} caracteres`
  return errors
}
