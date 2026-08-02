<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Histórico — NinjaPosts' })
</script>

<template>
  <LayoutAppComingSoon
    title="Histórico"
    description="Todas as suas artes, com filtros, duplicar, excluir e baixar novamente."
    stage="Etapa 9"
    icon="lucide:history"
  />
</template>
