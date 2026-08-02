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
      /**
       * O `as T` é culpa de uma rota binária, não deste código.
       *
       * O `$fetch` deduz o tipo da resposta pelo mapa de rotas do Nitro. Basta
       * **uma** rota que devolva binário — `/api/generations/:id/download` —
       * para esse mapa deixar de reduzir a `T`, e o erro aparece aqui, num
       * caminho que não tem nada a ver com download. O contrato de verdade
       * continua sendo o `T` que quem chama declara.
       */
      return (await $fetch<T>(url, {
        method: options.method ?? 'GET',
        body: options.body as Record<string, unknown> | undefined,
        query: options.query,
        headers: await authHeader(),
      })) as T
    } catch (error) {
      throw toApiError(error)
    }
  }

  /**
   * Resposta binária, com o mesmo cabeçalho de autenticação.
   *
   * Função separada, e não uma opção de `request`: passar `responseType` para o
   * `$fetch` genérico troca a sobrecarga escolhida pelo TypeScript e o retorno
   * deixa de casar com `T`. Binário é um caso só — o de download —, então sai
   * mais barato isolá-lo do que generalizar o tipo.
   */
  async function requestBlob(url: string, query?: Record<string, unknown>): Promise<Blob> {
    try {
      return await $fetch(url, { query, responseType: 'blob', headers: await authHeader() })
    } catch (error) {
      throw toApiError(error)
    }
  }

  return {
    get: <T>(url: string, query?: Record<string, unknown>) => request<T>(url, { query }),
    post: <T>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body }),
    patch: <T>(url: string, body?: unknown) => request<T>(url, { method: 'PATCH', body }),
    del: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
    /**
     * Download autenticado. Existe porque o token vive no header, e navegação
     * de `<a href>` não carrega header — a alternativa seria colocá-lo na
     * query, onde ele vaza para log de servidor e histórico do navegador.
     */
    blob: requestBlob,
  }
}
