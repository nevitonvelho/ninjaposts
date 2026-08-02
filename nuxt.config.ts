import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/icon', '@pinia/nuxt', '@vueuse/nuxt'],

  css: ['~/assets/css/main.css'],

  // Tailwind v4 é configurado no CSS (`@theme`), não em tailwind.config.ts.
  vite: {
    plugins: [tailwindcss()],
  },

  /**
   * Renderização híbrida — ver docs/ARCHITECTURE.md §0.1.
   *
   * Marketing é prerenderizado (SEO e LCP baixo). A área logada roda como SPA:
   * ela nunca é indexada, e SSR com Firebase Auth exigiria session cookies via
   * Admin SDK (troca de token, refresh, revogação) — complexidade e latência
   * sem nenhum ganho.
   */
  routeRules: {
    '/': { prerender: true },
    '/termos': { prerender: true },
    '/privacidade': { prerender: true },
    // '/precos' entra aqui na Etapa 12, junto com a página. Declarar prerender
    // de rota inexistente quebra o build.
    '/app/**': { ssr: false },
    '/admin/**': { ssr: false },
  },

  runtimeConfig: {
    // Privado — só existe no servidor.
    openaiApiKey: '',
    openaiBriefModel: 'gpt-5',
    openaiImageModel: 'gpt-image-1',
    firebaseProjectId: '',
    firebaseClientEmail: '',
    firebasePrivateKey: '',
    firebaseStorageBucket: '',
    paymentProvider: 'mock',
    /** Valida a assinatura do webhook da Kiwify. Sem ele, qualquer um se credita. */
    kiwifyWebhookToken: '',
    /**
     * Ids de produto por pacote: configuração de ambiente, não catálogo — mudam
     * entre a conta de teste e a de produção. As *URLs* de checkout, ao
     * contrário, vivem em `shared/constants/packs.ts`: são públicas e aparecem
     * no HTML da página de preços.
     */
    kiwifyProductStarter: '',
    kiwifyProductEssencial: '',
    kiwifyProductPro: '',

    public: {
      appUrl: 'http://localhost:3000',
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: '',
      },
      // Aponta o SDK para os emuladores em desenvolvimento.
      useEmulators: false,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'CriaPosts — Artes profissionais para redes sociais com IA',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Gere artes, legendas e hashtags profissionais para suas redes sociais em segundos. Sem designer, sem complicação.',
        },
        { name: 'theme-color', content: '#ffffff' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
        },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  icon: {
    mode: 'svg',
    collections: ['lucide'],
    serverBundle: { collections: ['lucide'] },
    /**
     * Ícones inlinados no bundle em build time.
     *
     * Sem isto o `<Icon>` busca o SVG por HTTP: falha no prerender (o endpoint
     * interno não está de pé ainda) e, nas rotas SPA, viraria uma requisição à
     * API pública do Iconify por ícone. Com um conjunto fechado de ícones,
     * inlinar é mais rápido e funciona offline.
     *
     * `globInclude` precisa incluir `shared/constants/` porque os nomes de
     * ícone de nichos e redes sociais moram lá — o scan padrão só varre `.vue`.
     */
    clientBundle: {
      scan: {
        globInclude: ['app/**/*.{vue,ts}', 'shared/constants/*.ts'],
      },
      sizeLimitKb: 512,
    },
  },

  typescript: {
    typeCheck: false, // rodado via `npm run typecheck`, fora do ciclo de dev
    strict: true,
  },
})
