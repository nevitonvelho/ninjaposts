import type { InjectionKey, Ref } from 'vue'

export interface FormFieldContext {
  id: Ref<string>
  describedBy: Ref<string | undefined>
  invalid: Ref<boolean>
  required: Ref<boolean>
}

export const FormFieldKey: InjectionKey<FormFieldContext> = Symbol('ui-form-field')

/**
 * Liga o controle ao `<UiField>` que o envolve.
 *
 * O `for` do label, o `aria-describedby` do erro/dica e o `aria-invalid` são
 * ligados automaticamente. Fazer isso à mão em cada campo é o tipo de coisa que
 * funciona no primeiro formulário e é esquecida do terceiro em diante — e é
 * justamente o que um leitor de tela precisa para anunciar o erro certo.
 *
 * Funciona fora de um `<UiField>` também: nesse caso gera o próprio id.
 */
export function useFormField(props: { id?: string }) {
  const field = inject(FormFieldKey, null)
  const fallbackId = useId()

  return {
    id: computed(() => props.id ?? field?.id.value ?? fallbackId),
    describedBy: computed(() => field?.describedBy.value),
    invalid: computed(() => field?.invalid.value ?? false),
    required: computed(() => field?.required.value ?? false),
  }
}
