<script setup lang="ts">
// Import explícito em vez de `resolveComponent('NuxtLink')` no template:
// o resolver de runtime não enxerga o NuxtLink neste ponto e o Vue avisa
// "Failed to resolve component", renderizando um elemento vazio.
import { NuxtLink } from '#components'

withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; showText?: boolean; to?: string }>(), {
  size: 'md',
  showText: true,
})

/**
 * A marca é o mascote recortado de `public/logo.png`, com fundo transparente.
 *
 * Sem moldura, sem sombra e sem raio próprios: a logo **já** traz a moldura
 * arredondada e o balão como parte do desenho. Embrulhá-la num quadrado
 * colorido, como era com o ícone genérico, desenharia uma segunda moldura em
 * volta da primeira.
 *
 * O wordmark é texto, não imagem: fica nítido em qualquer DPI, acompanha o
 * tamanho da fonte e continua selecionável. As duas cores repetem o arquivo —
 * `ninja` na cor da tinta, `posts` no gradiente violeta→magenta→laranja.
 */
const MARK = { sm: 'size-7', md: 'size-9', lg: 'size-11' } as const
const TEXT = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' } as const
</script>

<template>
  <component :is="to ? NuxtLink : 'span'" :to="to" class="inline-flex items-center gap-2.5">
    <!--
      `alt` só descreve quando o texto está escondido. Com o wordmark visível ao
      lado, uma descrição aqui faria o leitor de tela anunciar "ninjaposts"
      duas vezes seguidas.
    -->
    <img
      src="/mark.png"
      :alt="showText ? '' : 'ninjaposts'"
      width="256"
      height="256"
      :class="cn('shrink-0 object-contain', MARK[size])"
    >

    <span
      v-if="showText"
      :class="cn('font-semibold lowercase tracking-tight', TEXT[size])"
    >
      <span class="text-ink">ninja</span><span class="text-gradient-brand">posts</span>
    </span>
  </component>
</template>
