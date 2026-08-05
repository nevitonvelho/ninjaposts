export interface NavItem {
  label: string
  to: string
  icon: string
  /** Marca o item ativo também nas sub-rotas (ex.: /app/post/123 → Histórico). */
  matchPrefix?: string
  badge?: 'credits'
}

/**
 * Navegação do app em um só lugar.
 *
 * Sidebar e menu mobile leem daqui — duplicar a lista garantiria que uma delas
 * ficaria desatualizada na primeira rota nova.
 */
export const APP_NAV: NavItem[] = [
  { label: 'Início', to: '/app', icon: 'lucide:layout-dashboard' },
  { label: 'Criar post', to: '/app/criar', icon: 'lucide:sparkles' },
  { label: 'Histórico', to: '/app/historico', icon: 'lucide:history', matchPrefix: '/app/post' },
  { label: 'Projetos', to: '/app/projetos', icon: 'lucide:folder' },
]

export const APP_NAV_SECONDARY: NavItem[] = [
  { label: 'Créditos', to: '/app/creditos', icon: 'lucide:zap', badge: 'credits' },
  { label: 'Perfil', to: '/app/perfil', icon: 'lucide:user' },
]

/**
 * Painel administrativo. Só aparece para quem tem a claim `role: 'admin'` — e
 * isso é UX: quem protege as rotas é o middleware `admin`, e quem protege os
 * dados são as Security Rules.
 */
export const ADMIN_NAV: NavItem[] = [
  { label: 'Administração', to: '/admin', icon: 'lucide:shield' },
  { label: 'Biblioteca', to: '/admin/biblioteca', icon: 'lucide:images' },
]

/**
 * `/app` só casa exato — sem isto ele ficaria ativo em todas as sub-rotas,
 * já que toda rota do app começa com `/app`.
 */
export function isNavActive(item: NavItem, path: string): boolean {
  if (item.to === '/app') return path === '/app'
  if (path === item.to || path.startsWith(`${item.to}/`)) return true
  return Boolean(item.matchPrefix && path.startsWith(item.matchPrefix))
}
