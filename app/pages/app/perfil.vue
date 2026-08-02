<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Perfil — CriaPosts' })
</script>

<template>
  <LayoutAppComingSoon
    title="Perfil"
    description="Nome, empresa, logo e cores padrão da sua marca."
    stage="Etapa 9"
    icon="lucide:user"
  />
</template>
