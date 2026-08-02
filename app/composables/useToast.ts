import type { Toast, ToastTone } from '~/stores/ui'

type ToastInput = string | { title: string; description?: string; duration?: number; action?: Toast['action'] }

function normalize(input: ToastInput, tone: ToastTone) {
  return typeof input === 'string' ? { tone, title: input } : { tone, ...input }
}

/**
 * API imperativa de feedback: `toast.success('Copiado!')`.
 *
 * Componente não deveria precisar montar um `<UiToast>` e controlar seu estado
 * só para avisar que algo deu certo — o container global cuida da renderização.
 */
export function useToast() {
  const ui = useUiStore()

  return {
    success: (input: ToastInput) => ui.pushToast(normalize(input, 'success')),
    error: (input: ToastInput) =>
      // Erro fica mais tempo: o usuário costuma precisar ler e decidir o que fazer.
      ui.pushToast({ duration: 8000, ...normalize(input, 'error') }),
    warning: (input: ToastInput) => ui.pushToast(normalize(input, 'warning')),
    info: (input: ToastInput) => ui.pushToast(normalize(input, 'info')),
    dismiss: (id: string) => ui.dismissToast(id),
    clear: () => ui.clearToasts(),
  }
}
