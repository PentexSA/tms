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

// O alfabeto do código (invite-code.ts) em qualquer caixa, sem o U, mais O, I e
// L, que o aceite normaliza. Cru (26 seguidos) ou formatado (4 × 6 + 2).
export const INVITE_CHAR = '[0-9A-TV-Za-tv-z]'
const INVITE_CODE = new RegExp(
  `(^|[^0-9A-Za-z])(?:${INVITE_CHAR}{26}|${INVITE_CHAR}{4}(?:[ -]${INVITE_CHAR}{4}){5}[ -]${INVITE_CHAR}{2})(?![0-9A-Za-z])`,
  'g'
)
// O fragmento de uma URL ou de um caminho ("/join#…"): num token sem espaço
// nem aspas, o que vem depois do primeiro "#" que tem um "/" antes. O "#"
// de um método privado no stack ("at Foo.#bar") não tem "/" antes. Um passe
// por token, linear: a regex com o prefixo opcional era quadrática num
// token longo de "/"
const TOKEN = /[^\s'"<>]+/g
export const redactFragments = (text: string): string =>
  text.replace(TOKEN, token => {
    const hash = token.indexOf('#')
    if (hash < 1 || hash === token.length - 1) return token
    return token.lastIndexOf('/', hash) === -1
      ? token
      : `${token.slice(0, hash)}#[convite]`
  })

/** Redação por padrão, para mensagem e frames. */
export function redact(text: string): string {
  return (
    redactFragments(text)
      // Antes do e-mail, porque o usuário e a senha da URL podem ter "@"
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s'"<>]*@/gi, '$1[credencial]@')
      .replace(/\beyJ[\w-]+\.[\w-]+(?:\.[\w-]*)?/g, '[jwt]')
      .replace(/\bBearer\s+[^\s,;'"]+/gi, 'Bearer [token]')
      // "pacote@1.2.3" (caminho do pnpm no stack) não é e-mail
      .replace(
        /[^\s@'"<>(),:;=/[\]]+@([\p{L}\p{N}.-]+)/gu,
        (match, domain: string) => (/^[\d.]+$/.test(domain) ? match : '[email]')
      )
      // O código de convite (P12): 26 caracteres do base32 Crockford, cru ou
      // no formato da tela (grupos de 4), e o fragmento de URL que o link leva.
      // Toda sequência do alfabeto conta: um falso positivo só apaga texto de
      // diagnóstico. Sem lookbehind, que nem todo motor de regex do app tem
      .replace(INVITE_CODE, '$1[convite]')
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
