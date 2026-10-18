// Erros da API com status e mensagem genérica (nunca stack trace nem o valor
// recebido). `details` só leva caminhos de campo e códigos.

export class ApiError extends Error {
  readonly status: number
  readonly details: Readonly<Record<string, unknown>> | undefined

  constructor(
    status: number,
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export const unauthorized = () =>
  new ApiError(401, 'sessão inválida ou expirada')
