<script setup lang="ts">
/**
 * Rota criada para que os links do rodapé de autenticação funcionem.
 *
 * O conteúdo real precisa ser redigido por quem responde juridicamente pelo
 * produto — inventar cláusulas aqui daria a falsa impressão de que existe um
 * contrato válido, o que é pior do que assumir que ainda não existe.
 */
definePageMeta({ layout: 'default' })
useHead({
  title: 'Termos de Uso — CriaPosts',
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>

<template>
  <main class="mx-auto max-w-2xl px-6 py-20">
    <LayoutAppLogo to="/" />

    <h1 class="mt-12 text-3xl font-semibold tracking-tight">Termos de Uso</h1>

    <div class="mt-8 flex gap-3 rounded-lg border border-warning/20 bg-warning-soft p-4 text-sm">
      <Icon name="lucide:file-clock" class="mt-0.5 size-4 shrink-0 text-warning" />
      <div class="space-y-1">
        <p class="font-medium text-ink">Documento em elaboração</p>
        <p class="text-ink-muted">
          Os Termos de Uso do CriaPosts ainda estão sendo redigidos e serão publicados aqui antes
          do lançamento. Enquanto isso, o serviço está em desenvolvimento e não deve ser usado em
          produção.
        </p>
      </div>
    </div>

    <p class="mt-8 text-sm text-ink-muted">
      Dúvidas? Escreva para
      <a href="mailto:contato@criaposts.com.br" class="text-brand-600 underline underline-offset-4">
        contato@criaposts.com.br
      </a>
      .
    </p>

    <UiButton to="/" variant="ghost" icon="lucide:arrow-left" class="mt-10">Voltar</UiButton>
  </main>
</template>
