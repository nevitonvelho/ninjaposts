<script setup lang="ts">
const props = defineProps<{
  id?: string
  label?: string
  description?: string
  disabled?: boolean
}>()

const model = defineModel<boolean>({ default: false })
const { id, describedBy } = useFormField(props)
const descriptionId = `${id.value}-description`
</script>

<template>
  <div class="flex items-start gap-3">
    <!--
      `<button role="switch">` em vez de checkbox estilizado: o estado ligado /
      desligado é anunciado corretamente e não depende de `appearance-none` nem
      de pseudo-elementos para desenhar o controle.
    -->
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="model"
      :aria-describedby="description ? descriptionId : describedBy"
      :disabled="disabled"
      :class="
        cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-out-soft',
          'focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          model ? 'bg-brand-600' : 'bg-line-strong',
        )
      "
      @click="model = !model"
    >
      <span
        :class="
          cn(
            'pointer-events-none inline-block size-5 rounded-full bg-white shadow-soft',
            'transition-transform duration-200 ease-spring',
            model ? 'translate-x-5' : 'translate-x-0',
          )
        "
      />
    </button>

    <div v-if="label || description" class="text-sm">
      <label :for="id" class="cursor-pointer font-medium text-ink select-none">{{ label }}</label>
      <p v-if="description" :id="descriptionId" class="text-ink-muted">{{ description }}</p>
    </div>
  </div>
</template>
