import type { ApiError, ApiErrorCode } from '#shared/types/api'

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 422,
  insufficient_credits: 402,
  too_many_active_jobs: 429,
  rate_limited: 429,
  internal: 500,
}

/**
 * Erro de API com corpo tipado.
 *
 * O cliente recebe sempre `{ code, message, details }` — nunca uma stack ou uma
 * mensagem interna. `code` é o que a UI usa para decidir comportamento (abrir o
 * modal de upgrade em `insufficient_credits`, por exemplo); `message` já vem em
 * português, pronto para exibir.
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, string[]>,
) {
  const data: ApiError = { code, message, ...(details ? { details } : {}) }

  return createError({
    statusCode: STATUS[code],
    statusMessage: code,
    data,
  })
}

/** Registra o erro real no servidor e devolve algo genérico ao cliente. */
export function internalError(context: string, error: unknown) {
  console.error(`[api] ${context}`, error)
  return apiError('internal', 'Algo deu errado do nosso lado. Tente novamente em instantes.')
}
