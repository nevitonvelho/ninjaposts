<script setup lang="ts">
/**
 * Ver `termos.vue`: rota real, conteúdo jurídico pendente de redação.
 *
 * O que está descrito abaixo são fatos técnicos verificáveis do sistema (quais
 * dados o app efetivamente grava hoje), não promessas contratuais.
 */
definePageMeta({ layout: 'default' })
useHead({
  title: 'Política de Privacidade — CriaPosts',
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>

<template>
  <main class="mx-auto max-w-2xl px-6 py-20">
    <LayoutAppLogo to="/" />

    <h1 class="mt-12 text-3xl font-semibold tracking-tight">Política de Privacidade</h1>

    <div class="mt-8 flex gap-3 rounded-lg border border-warning/20 bg-warning-soft p-4 text-sm">
      <Icon name="lucide:file-clock" class="mt-0.5 size-4 shrink-0 text-warning" />
      <div class="space-y-1">
        <p class="font-medium text-ink">Documento em elaboração</p>
        <p class="text-ink-muted">
          A Política de Privacidade definitiva, em conformidade com a LGPD, será publicada aqui
          antes do lançamento.
        </p>
      </div>
    </div>

    <section class="mt-10 space-y-4">
      <h2 class="text-sm font-medium tracking-wide text-ink-subtle uppercase">
        O que o sistema grava hoje
      </h2>

      <ul class="space-y-3 text-sm text-ink-muted">
        <li class="flex gap-2.5">
          <Icon name="lucide:user" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
          <span>
            <strong class="text-ink">Conta:</strong> nome, e-mail e foto de perfil, vindos do
            Firebase Authentication. Senhas nunca chegam aos nossos servidores.
          </span>
        </li>
        <li class="flex gap-2.5">
          <Icon name="lucide:image" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
          <span>
            <strong class="text-ink">Conteúdo:</strong> os dados que você informa para gerar cada
            arte, a logo que enviar e as imagens geradas.
          </span>
        </li>
        <li class="flex gap-2.5">
          <Icon name="lucide:sparkles" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
          <span>
            <strong class="text-ink">Processamento por IA:</strong> o texto que você preenche é
            enviado à OpenAI para gerar a arte, a legenda e as hashtags.
          </span>
        </li>
        <li class="flex gap-2.5">
          <Icon name="lucide:receipt" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
          <span>
            <strong class="text-ink">Uso:</strong> quantidade de gerações e movimentações de
            créditos, para faturamento e suporte.
          </span>
        </li>
      </ul>
    </section>

    <p class="mt-10 text-sm text-ink-muted">
      Para solicitar exclusão dos seus dados, escreva para
      <a href="mailto:contato@criaposts.com.br" class="text-brand-600 underline underline-offset-4">
        contato@criaposts.com.br
      </a>
      .
    </p>

    <UiButton to="/" variant="ghost" icon="lucide:arrow-left" class="mt-10">Voltar</UiButton>
  </main>
</template>
