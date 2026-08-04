<script setup lang="ts">
import { INPUT_LIMITS, hasBusinessInfo } from '#shared/constants'

/**
 * Última etapa: conferir, não preencher.
 *
 * Tudo aqui já vem pronto do perfil. Logo e cores aparecem como estão e só
 * abrem para edição se o usuário pedir — quem gera dez posts por semana não
 * deve encarar um seletor de cores dez vezes para usar sempre a mesma paleta.
 */

const generator = useGeneratorStore()
const { draft } = storeToRefs(generator)
const auth = useAuthStore()

const profileBrand = computed(() => auth.userDoc?.brand ?? null)
const { url: logoUrl, pending: logoPending } = useStorageUrl(() => draft.value.logoPath)

const editingBrand = ref(false)

/** Perfil sem nada configurado: o atalho de edição não resolve, o perfil sim. */
const emptyProfile = computed(
  () => !profileBrand.value?.logoPath
    && !profileBrand.value?.colors.length
    && !hasBusinessInfo(profileBrand.value?.business),
)
</script>

<template>
  <div class="space-y-8">
    <!-- Marca -->
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-medium text-ink">Sua marca nesta arte</h3>
        <UiButton
          variant="ghost"
          size="sm"
          :icon="editingBrand ? 'lucide:check' : 'lucide:pencil'"
          @click="editingBrand = !editingBrand"
        >
          {{ editingBrand ? 'Pronto' : 'Ajustar' }}
        </UiButton>
      </div>

      <div v-if="!editingBrand" class="flex items-center gap-4 rounded-lg border border-line bg-subtle p-3">
        <div class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-checkerboard">
          <UiSpinner v-if="logoPending" size="sm" class="text-ink-subtle" />
          <img
            v-else-if="logoUrl"
            :src="logoUrl"
            alt="Logo que será aplicada na arte"
            class="size-full object-contain p-1"
          >
          <Icon v-else name="lucide:image-off" class="size-5 text-ink-subtle" />
        </div>

        <div class="min-w-0 flex-1 space-y-1.5">
          <p class="text-sm text-ink">
            {{ draft.logoPath ? 'Logo aplicada na arte' : 'Sem logo — a IA não desenha nenhuma' }}
          </p>

          <div v-if="draft.colors.length" class="flex items-center gap-2">
            <span class="flex" aria-hidden="true">
              <span
                v-for="color in draft.colors"
                :key="color"
                class="size-4 rounded-full border border-canvas -ml-1 first:ml-0"
                :style="{ backgroundColor: color }"
              />
            </span>
            <span class="text-xs text-ink-subtle">
              {{ draft.colors.length === 1 ? '1 cor da marca' : `${draft.colors.length} cores da marca` }}
            </span>
          </div>
          <p v-else class="text-xs text-ink-subtle">
            Sem cores definidas — a IA escolhe uma paleta que combine com o estilo.
          </p>
        </div>
      </div>

      <div v-else class="space-y-6 rounded-lg border border-line p-4">
        <UiField label="Logo" hint="Vale só para este post — o padrão continua o do perfil.">
          <BrandLogoUpload v-model="draft.logoPath" />
        </UiField>

        <UiField
          label="Cores da marca"
          hint="A primeira cor é a dominante da arte."
          :error="generator.errorFor('colors')"
        >
          <BrandColorPicker v-model="draft.colors" />
        </UiField>
      </div>

      <p v-if="emptyProfile" class="flex items-start gap-2 text-xs text-ink-subtle">
        <Icon name="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
        <span>
          Guarde logo, cores e contatos no
          <NuxtLink to="/app/perfil" class="font-medium text-brand-600 underline-offset-4 hover:underline">
            seu perfil
          </NuxtLink>
          e todo post já começa preenchido.
        </span>
      </p>
    </section>

    <!-- Contatos -->
    <UiField
      label="Informações do estabelecimento"
      hint="Marque o que deve aparecer no rodapé desta arte."
      :error="generator.errorFor('contactItems')"
    >
      <GeneratorContactPicker />
    </UiField>

    <!-- Instruções extras -->
    <UiField
      label="Instruções extras"
      hint="Algo que a IA precisa saber e não coube nos campos acima."
      :error="generator.errorFor('extraInstructions')"
      :count="draft.extraInstructions.length"
      :max="INPUT_LIMITS.extraInstructions.max"
    >
      <UiTextarea
        v-model="draft.extraInstructions"
        autoresize
        :rows="3"
        placeholder="Ex.: não usar fundo escuro, mostrar o produto de cima, deixar espaço à direita para o logo."
      />
    </UiField>
  </div>
</template>
