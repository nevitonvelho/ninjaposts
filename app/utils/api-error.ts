import type { ApiError, ApiErrorCode } from '#shared/types/api'

export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, string[]>,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiError).code === 'string' &&
    typeof (value as ApiError).message === 'string'
  )
}

/**
 * Extrai nosso `ApiError` do erro lançado pelo `$fetch`.
 *
 * Cuidado com o aninhamento: o `$fetch` coloca em `error.data` o **corpo da
 * resposta**, e o Nitro serializa `createError({ data })` dentro de um
 * envelope — `{ error, url, statusCode, statusMessage, message, data, stack }`.
 * Ou seja, nosso payload fica em `error.data.data`, não em `error.data`.
 *
 * Ler o nível errado não estoura: apenas não encontra `code`, cai no fallback,
 * e **toda** mensagem da API vira "verifique sua conexão", mascarando o erro
 * real. Por isso aqui aceitamos os dois níveis — e por isso esta função é um
 * módulo puro, testável sem subir o app.
 */
export function toApiError(error: unknown): ApiRequestError {
  const body = (error as { data?: unknown })?.data
  const status = (error as { statusCode?: number })?.statusCode

  const nested = (body as { data?: unknown })?.data
  const payload = isApiError(body) ? body : isApiError(nested) ? nested : null

  if (payload) {
    return new ApiRequestError(payload.code, payload.message, payload.details, status)
  }

  // Sem status HTTP: a requisição nem chegou ao servidor.
  if (!status) {
    return new ApiRequestError(
      'internal',
      'Não foi possível falar com o servidor. Verifique sua conexão.',
    )
  }

  // Chegou, mas respondeu fora do nosso contrato (proxy, 502, HTML de erro).
  return new ApiRequestError(
    'internal',
    `O servidor respondeu de forma inesperada (${status}). Tente novamente em instantes.`,
    undefined,
    status,
  )
}
