/**
 * Cliente HTTP da API interna.
 *
 * Anexa o ID token do Firebase em toda requisição e normaliza o erro para
 * `ApiRequestError`, com `code` estável. Sem isso, cada chamada precisaria
 * repetir a busca do token e a arqueologia no formato de erro do `$fetch`.
 *
 * O desempacotamento do erro vive em `~/utils/api-error` — função pura, para
 * ser testável sem subir o app.
 */
export function useApi() {
  /**
   * O token é lido a cada chamada, não guardado: o SDK renova automaticamente,
   * e um token em cache viraria 401 depois de uma hora.
   */
  async function authHeader(): Promise<Record<string, string>> {
    const { auth } = await useFirebaseAsync()
    const current = auth.currentUser

    if (!current) return {}
    return { Authorization: `Bearer ${await current.getIdToken()}` }
  }

  async function request<T>(
    url: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
      body?: unknown
      query?: Record<string, unknown>
    } = {},
  ): Promise<T> {
    try {
      return await $fetch<T>(url, {
        method: options.method ?? 'GET',
        body: options.body as Record<string, unknown> | undefined,
        query: options.query,
        headers: await authHeader(),
      })
    } catch (error) {
      throw toApiError(error)
    }
  }

  return {
    get: <T>(url: string, query?: Record<string, unknown>) => request<T>(url, { query }),
    post: <T>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body }),
    patch: <T>(url: string, body?: unknown) => request<T>(url, { method: 'PATCH', body }),
    del: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
  }
}
