<script setup lang="ts">
import { MAX_CONTACT_ITEMS, contactLine } from '#shared/constants'

/**
 * Escolha do que vai na barra de contato da arte.
 *
 * Lê do perfil e não oferece campo de digitação: um telefone digitado às
 * pressas aqui vira um telefone errado impresso na peça, e a correção teria de
 * ser refeita post a post. Perfil vazio não vira formulário improvisado — vira
 * um convite para preencher no lugar certo, uma vez só.
 */

const generator = useGeneratorStore()

const preview = computed(() => contactLine(generator.contactItems))
</script>

<template>
  <div class="space-y-3">
    <ul v-if="generator.availableContactFields.length" class="space-y-2">
      <li v-for="spec in generator.availableContactFields" :key="spec.id">
        <!--
          `<label>` envolvendo um checkbox nativo: a linha inteira vira alvo de
          clique e o estado é anunciado sem `aria-*` manual.
        -->
        <label
          :class="
            cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border p-3',
              'transition-[border-color,background-color] duration-150 ease-out-soft',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 has-[:focus-visible]:outline-offset-2',
              generator.isContactSelected(spec.id)
                ? 'border-brand-500 bg-brand-50'
                : 'border-line hover:border-line-strong hover:bg-subtle',
              !generator.isContactSelected(spec.id) && generator.contactSelectionFull
                && 'cursor-not-allowed opacity-50 hover:border-line hover:bg-transparent',
            )
          "
        >
          <input
            type="checkbox"
            class="sr-only"
            :checked="generator.isContactSelected(spec.id)"
            :disabled="!generator.isContactSelected(spec.id) && generator.contactSelectionFull"
            @change="generator.toggleContactField(spec.id)"
          >

          <span
            :class="
              cn(
                'grid size-5 shrink-0 place-items-center rounded border',
                generator.isContactSelected(spec.id)
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line-strong bg-canvas',
              )
            "
            aria-hidden="true"
          >
            <Icon v-if="generator.isContactSelected(spec.id)" name="lucide:check" class="size-3.5" />
          </span>

          <Icon :name="spec.icon" class="size-4 shrink-0 text-ink-subtle" />

          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-ink">{{ spec.label }}</span>
            <span class="block truncate text-xs text-ink-subtle">
              {{ spec.format(generator.business[spec.id] ?? '') }}
            </span>
          </span>
        </label>
      </li>
    </ul>

    <div v-else class="rounded-lg border border-dashed border-line bg-subtle p-4 text-sm">
      <p class="text-ink-muted">
        Você ainda não cadastrou WhatsApp, endereço ou redes. Sem isso, a arte sai sem
        contato — a IA nunca inventa um número.
      </p>
      <NuxtLink
        to="/app/perfil"
        class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 underline-offset-4 hover:underline"
      >
        <Icon name="lucide:store" class="size-4" />
        Cadastrar no perfil
      </NuxtLink>
    </div>

    <p v-if="preview" class="flex items-start gap-2 text-sm text-ink-muted">
      <Icon name="lucide:type" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
      <span>No rodapé da arte: <span class="font-medium text-ink">{{ preview }}</span></span>
    </p>

    <p
      v-if="generator.contactSelectionFull"
      class="flex items-start gap-2 text-xs text-ink-subtle"
    >
      <Icon name="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
      <span>
        Máximo de {{ MAX_CONTACT_ITEMS }} por arte. Mais que isso vira uma parede de
        letra miúda que ninguém lê no feed.
      </span>
    </p>
  </div>
</template>
