import { COLLECTIONS, emptyBrandSettings, withBusinessInfo } from '#shared/constants'
import type { BrandSettings, UserDoc } from '#shared/types/user'

/**
 * Edição do perfil — nome, empresa, marca e dados do estabelecimento.
 *
 * Escreve direto no Firestore pelo SDK do cliente, sem passar pelo Nitro: as
 * Security Rules (§2.9) já restringem o update a `displayName`, `company` e
 * `brand`, e um endpoint só para reencaminhar o que as regras aprovam seria
 * uma segunda cópia da mesma validação — a que sempre diverge.
 *
 * O que passa pelo servidor é o que as regras **não** conseguem julgar:
 * crédito, `role` e as gerações.
 */

export interface ProfileForm {
  displayName: string
  company: string
  brand: BrandSettings
}

function formFrom(doc: UserDoc | null): ProfileForm {
  return {
    displayName: doc?.displayName ?? '',
    company: doc?.company ?? '',
    brand: {
      ...emptyBrandSettings(),
      ...doc?.brand,
      // Perfis criados antes de `business` existir chegam sem o campo.
      business: withBusinessInfo(doc?.brand?.business),
    },
  }
}

export function useProfileForm() {
  const auth = useAuthStore()
  const toast = useToast()

  const form = ref<ProfileForm>(formFrom(auth.userDoc))
  const saving = ref(false)
  const errors = ref<Record<string, string[]>>({})

  /** Snapshot do documento como está salvo — a régua do "tem alteração?". */
  const saved = ref(JSON.stringify(form.value))

  const dirty = computed(() => JSON.stringify(form.value) !== saved.value)

  /**
   * O documento chega por `onSnapshot`, então pode atualizar a qualquer momento
   * — inclusive por causa da nossa própria gravação, ou de outra aba aberta.
   *
   * Reescrever o formulário enquanto há alteração pendente apagaria o que a
   * pessoa está digitando. Enquanto estiver sujo, o servidor não manda: a
   * escolha é dela, e o botão Salvar é quem resolve o empate.
   */
  watch(
    () => auth.userDoc,
    (doc) => {
      const next = formFrom(doc)
      // Medido contra a régua **antiga** — é ela que sabe o que o usuário mexeu.
      const hasLocalEdits = JSON.stringify(form.value) !== saved.value

      saved.value = JSON.stringify(next)
      if (!hasLocalEdits) form.value = next
    },
    { deep: true },
  )

  function reset() {
    form.value = formFrom(auth.userDoc)
    errors.value = {}
  }

  function errorFor(field: string): string[] | null {
    return errors.value[field] ?? null
  }

  async function save(): Promise<boolean> {
    const uid = auth.user?.uid
    if (!uid || saving.value) return false

    const parsed = updateProfileSchema.safeParse(form.value)
    if (!parsed.success) {
      errors.value = fieldErrors(parsed.error)
      toast.warning('Revise os campos destacados.')
      return false
    }

    errors.value = {}
    saving.value = true

    try {
      const { db } = await useFirebaseAsync()
      const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore')

      await updateDoc(doc(db, COLLECTIONS.users, uid), {
        ...parsed.data,
        updatedAt: serverTimestamp(),
      })

      /**
       * Reflete o que foi realmente gravado — o Zod apara espaços e transforma
       * `""` em `null`. O caminho de volta (`?? ''`) tem de ser idêntico ao de
       * `formFrom`, senão a régua nunca bate e o formulário fica sujo para
       * sempre depois de salvar.
       */
      form.value = {
        displayName: parsed.data.displayName,
        company: parsed.data.company ?? '',
        brand: parsed.data.brand,
      }
      saved.value = JSON.stringify(form.value)

      toast.success('Perfil salvo.')
      return true
    } catch (error) {
      toast.error(firebaseErrorMessage(error))
      return false
    } finally {
      saving.value = false
    }
  }

  return { form, dirty, saving, errors, errorFor, save, reset }
}
