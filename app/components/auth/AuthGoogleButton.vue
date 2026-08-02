<script setup lang="ts">
defineProps<{ loading?: boolean; label?: string }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <!--
    O "G" colorido vai inline em vez de vir do Iconify: a marca do Google exige
    as cores exatas, e um ícone monocromático descaracteriza o botão que o
    usuário reconhece de dezenas de outros sites.
  -->
  <UiButton variant="secondary" block :loading="loading" @click="$emit('click')">
    <svg class="size-[18px]" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.8l-3.72-2.88c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.55-2.02-6.46-4.75H1.69v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.54 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.69a11.5 11.5 0 0 0 0 10.3l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.98c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.54 15.1.5 12 .5A11.5 11.5 0 0 0 1.69 6.85l3.85 2.98C6.45 7.1 9 4.98 12 4.98Z"
      />
    </svg>
    {{ label ?? 'Continuar com Google' }}
  </UiButton>
</template>
