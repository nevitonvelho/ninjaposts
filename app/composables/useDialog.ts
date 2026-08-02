import type { ConfirmOptions } from '~/stores/ui'

/**
 * Confirmação baseada em promise:
 *
 *   if (await confirm({ title: 'Excluir este post?', tone: 'danger' })) { ... }
 *
 * Ler assim, em linha reta, é muito melhor que espalhar a decisão entre um
 * `ref` de visibilidade, um handler de confirmar e outro de cancelar.
 */
export function useDialog() {
  const ui = useUiStore()

  return {
    confirm: (options: ConfirmOptions) => ui.confirm(options),

    /** Atalho para exclusão — o caso mais comum e o que mais precisa de tom certo. */
    confirmDelete: (options: Partial<ConfirmOptions> & { title: string }) =>
      ui.confirm({
        confirmLabel: 'Excluir',
        cancelLabel: 'Cancelar',
        tone: 'danger',
        icon: 'lucide:trash-2',
        ...options,
      }),
  }
}
