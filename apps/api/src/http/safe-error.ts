// O único filtro entre um erro e o que sai do processo (log hoje, error
// tracking na Fase 3). Erro carrega dado de usuário: o Postgres repete valores
// ("Key (email)=(...)"), o JSON.parse repete a entrada e a primeira linha do
// stack repete a mensagem. Nunca lança, seja qual for o valor recebido.

export interface SafeError {
  readonly name: string
  readonly code?: string
  readonly message?: string
  readonly stack?: string
  readonly cause?: SafeError
}

// SQLSTATE. Um código de cinco letras de outra origem (EPIPE) também cai aqui
// e perde a mensagem: o erro é para o lado seguro
const SQLSTATE = /^[0-9A-Z]{5}$/
// Códigos são constantes (ERR_X, ECONNRESET): minúscula já é texto livre
const SAFE_CODE = /^[A-Z0-9_]{1,40}$/
const SAFE_NAME = /^[A-Za-z_$][\w$.]{0,63}$/
const FRAME = /^\s*at\s+\S/

const MAX_MESSAGE = 300
// Acima disso a mensagem nem é lida: é um despejo, e as regexes não correm nela
const MAX_MESSAGE_SCAN = 2000
const MAX_FRAMES = 30
const MAX_FRAME = 300
const MAX_CAUSE_DEPTH = 3

/** Redação por padrão, para mensagem e frames. */
export function redact(text: string): string {
  return (
    text
      // Antes do e-mail, porque o usuário e a senha da URL podem ter "@"
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s'"<>]*@/gi, '$1[credencial]@')
      .replace(/\beyJ[\w-]+\.[\w-]+(?:\.[\w-]*)?/g, '[jwt]')
      .replace(/\bBearer\s+[^\s,;'"]+/gi, 'Bearer [token]')
      // "pacote@1.2.3" (caminho do pnpm no stack) não é e-mail
      .replace(
        /[^\s@'"<>(),:;=/[\]]+@([\p{L}\p{N}.-]+)/gu,
        (match, domain: string) => (/^[\d.]+$/.test(domain) ? match : '[email]')
      )
  )
}

/** Getter que lança, Proxy revogado: a propriedade conta como ausente. */
const read = (target: unknown, key: string): unknown => {
  try {
    return (target as Record<string, unknown>)[key]
  } catch {
    return undefined
  }
}

const validName = (value: unknown): string | undefined =>
  typeof value === 'string' && SAFE_NAME.test(value) ? value : undefined

// A classe diz mais que o `name` quando foi herdada sem mudar o `name`, e o
// DatabaseError do pg tem `name` igual a "error"
const nameOf = (error: object): string => {
  const own = validName(read(error, 'name'))
  const ctor = validName(read(read(error, 'constructor'), 'name'))
  if (ctor && ctor !== 'Error' && ctor !== 'Object') return ctor
  return own ?? ctor ?? 'Error'
}

const codeOf = (error: object): string | undefined => {
  const code = read(error, 'code')
  if (typeof code === 'number' && Number.isFinite(code)) return String(code)
  return typeof code === 'string' && SAFE_CODE.test(code) ? code : undefined
}

const messageOf = (error: object): string | undefined => {
  const message = read(error, 'message')
  if (typeof message !== 'string' || !message) return undefined
  if (message.length > MAX_MESSAGE_SCAN) return '[mensagem longa omitida]'
  return redact(message).slice(0, MAX_MESSAGE)
}

// Só as linhas de frame. A mensagem pode ter várias linhas e uma delas pode se
// passar por frame: o que também está na mensagem fica de fora
const framesOf = (error: object): string | undefined => {
  const stack = read(error, 'stack')
  if (typeof stack !== 'string') return undefined
  const message = read(error, 'message')
  const frames = stack
    .split('\n')
    .filter(line => FRAME.test(line) && line.length <= MAX_FRAME)
    .map(line => line.trim())
    .filter(line => typeof message !== 'string' || !message.includes(line))
    .slice(0, MAX_FRAMES)
    .map(redact)
  return frames.length ? frames.join('\n') : undefined
}

// O JSON.parse repete a entrada na mensagem, e redação por padrão não pega
// texto de nota. `instanceof` lança num Proxy com armadilha
const isSyntaxError = (error: object, name: string): boolean => {
  try {
    return name === 'SyntaxError' || error instanceof SyntaxError
  } catch {
    return false
  }
}

const filter = (error: unknown, depth: number): SafeError => {
  // Valor lançado que não é objeto (uma string, por exemplo) é texto livre
  if (typeof error !== 'object' || error === null)
    return { name: error === null ? 'null' : typeof error }

  const name = nameOf(error)
  const code = codeOf(error)
  const message =
    (code && SQLSTATE.test(code)) || isSyntaxError(error, name)
      ? undefined
      : messageOf(error)
  const stack = framesOf(error)
  const cause = read(error, 'cause')

  return {
    name,
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
    ...(stack ? { stack } : {}),
    ...(cause !== undefined && cause !== null && depth < MAX_CAUSE_DEPTH
      ? { cause: filter(cause, depth + 1) }
      : {}),
  }
}

export function safeError(error: unknown): SafeError {
  try {
    return filter(error, 0)
  } catch {
    return { name: 'Error' }
  }
}
