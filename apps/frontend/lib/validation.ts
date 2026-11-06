// Mesmas regras da API (apps/api/src/auth/routes.ts). Aqui são só para o
// aviso chegar antes; quem decide é o servidor.

export const USERNAME = /^[a-z0-9_]{3,24}$/
export const PASSWORD_MIN = 15
export const PASSWORD_MAX = 128

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface RegisterInput {
  readonly email: string
  readonly username: string
  readonly password: string
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export function emailError(raw: string): string | undefined {
  const email = raw.trim()
  if (!EMAIL.test(email) || email.length > 254)
    return 'Informe um e-mail válido.'
  return undefined
}

/**
 * O primeiro problema do nome de usuário, dito como ele é (T-73, P12). A
 * regra continua a da API (USERNAME); só a frase muda, e o campo não
 * converte nada sozinho: a pessoa vê o que vai ficar.
 */
export function usernameError(username: string): string | undefined {
  if (USERNAME.test(username)) return undefined
  if (/[A-Z]/.test(username)) return 'Use só letras minúsculas.'
  if (/\s/.test(username)) return 'Sem espaços: use _ no lugar.'
  if (/[^a-z0-9_]/.test(username)) return 'Use letras sem acento, números e _.'
  return 'De 3 a 24 caracteres.'
}

export function passwordError(password: string): string | undefined {
  if (password.length < PASSWORD_MIN)
    return `Pelo menos ${PASSWORD_MIN} caracteres.`
  if (password.length > PASSWORD_MAX)
    return `No máximo ${PASSWORD_MAX} caracteres.`
  return undefined
}

export function validateRegister(
  input: RegisterInput
): FieldErrors<RegisterInput> {
  const errors: { -readonly [K in keyof RegisterInput]?: string } = {}
  const email = emailError(input.email)
  if (email) errors.email = email
  const username = usernameError(input.username)
  if (username) errors.username = username
  const password = passwordError(input.password)
  if (password) errors.password = password
  return errors
}

export interface LoginInput {
  readonly email: string
  readonly password: string
}

/** O login confere o e-mail antes do envio (POA-34), sem o "dados inválidos". */
export function validateLogin(input: LoginInput): FieldErrors<LoginInput> {
  const errors: { -readonly [K in keyof LoginInput]?: string } = {}
  const email = emailError(input.email)
  if (email) errors.email = email
  if (!input.password) errors.password = 'Informe a senha.'
  return errors
}
