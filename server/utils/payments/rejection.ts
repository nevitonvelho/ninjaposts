/**
 * Motivo pelo qual um evento de webhook foi recusado.
 *
 * A distinção não é cosmética: "assinatura inválida" e "payload em formato
 * inesperado" pedem investigações opostas — a primeira é token errado, a
 * segunda é o gateway mandando um corpo diferente do que lemos. Colapsar as
 * duas em "erro no webhook" custa horas na hora de integrar.
 */
export type WebhookRejectionReason = 'signature' | 'payload' | 'config'

export class WebhookRejection extends Error {
  constructor(
    readonly reason: WebhookRejectionReason,
    message: string,
  ) {
    super(message)
    this.name = 'WebhookRejection'
  }
}

export function rejectWebhook(reason: WebhookRejectionReason, message: string): never {
  throw new WebhookRejection(reason, message)
}
