export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  tone: ToastTone
  title: string
  description?: string
  /** ms. `0` = não fecha sozinho. */
  duration: number
  action?: { label: string; onClick: () => void }
}

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'brand' | 'danger'
  icon?: string
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  loading: boolean
}

const DEFAULT_DURATION = 5000

export const useUiStore = defineStore('ui', () => {
  // --- Navegação ----------------------------------------------------------
  const sidebarOpen = ref(false)

  function toggleSidebar(value?: boolean) {
    sidebarOpen.value = value ?? !sidebarOpen.value
  }

  // --- Toasts -------------------------------------------------------------
  const toasts = ref<Toast[]>([])
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function dismissToast(id: string) {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function pushToast(toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }): string {
    const id = `${toast.tone}-${toasts.value.length}-${performance.now().toString(36)}`
    const duration = toast.duration ?? DEFAULT_DURATION

    toasts.value = [...toasts.value, { ...toast, id, duration }]

    // Empilhar 10 toasts não informa ninguém — descarta o mais antigo.
    if (toasts.value.length > 4) dismissToast(toasts.value[0]!.id)

    if (duration > 0) {
      timers.set(id, setTimeout(() => dismissToast(id), duration))
    }
    return id
  }

  function clearToasts() {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    toasts.value = []
  }

  // --- Confirmação --------------------------------------------------------
  const confirmState = ref<ConfirmState>({ open: false, loading: false, title: '' })

  /**
   * O resolver mora fora do state de propósito: funções não são serializáveis
   * e não devem entrar no devtools nem em snapshot de estado.
   */
  let resolveConfirm: ((value: boolean) => void) | null = null

  function confirm(options: ConfirmOptions): Promise<boolean> {
    // Um diálogo por vez: se já houver um aberto, o anterior é cancelado.
    resolveConfirm?.(false)

    confirmState.value = { ...options, open: true, loading: false }
    return new Promise<boolean>((resolve) => {
      resolveConfirm = resolve
    })
  }

  function settleConfirm(value: boolean) {
    confirmState.value = { ...confirmState.value, open: false, loading: false }
    resolveConfirm?.(value)
    resolveConfirm = null
  }

  return {
    sidebarOpen,
    toggleSidebar,
    toasts,
    pushToast,
    dismissToast,
    clearToasts,
    confirmState,
    confirm,
    settleConfirm,
  }
})
