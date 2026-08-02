<script setup lang="ts">
/**
 * Toasts e diálogos ficam fora do `<NuxtLayout>` de propósito: assim valem para
 * todos os layouts (marketing, app, admin, auth) e sobrevivem à troca de rota,
 * sem cada layout precisar lembrar de montá-los.
 */
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <UiToastContainer />
    <UiDialogHost />
  </div>
</template>
