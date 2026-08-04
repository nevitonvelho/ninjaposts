import type { BrandSettings, BusinessField, BusinessInfo } from '../types/user'
import type { ContactItem } from '../types/generation'

/**
 * Catálogo das informações do estabelecimento.
 *
 * Uma entrada aqui é a única coisa necessária para o dado existir em três
 * lugares: o campo no perfil, a opção na hora de gerar e a linha grafada na
 * arte. Espalhar rótulo, ícone e formatação por componente garantiria que
 * "WhatsApp" virasse "Whatsapp" em uma das telas.
 */

export interface BusinessFieldSpec {
  id: BusinessField
  /** Rótulo no formulário e na lista de seleção. */
  label: string
  icon: string
  placeholder: string
  hint: string
  max: number
  /** Tipo do `<input>` — muda o teclado no celular. */
  inputType: 'text' | 'tel' | 'url'
  autocomplete: string
  /**
   * Marcado por padrão no primeiro post.
   *
   * Só o que o cliente usa para *chegar até o negócio*. O nome fica de fora
   * porque quase sempre já está na logo, e repetido vira ruído na peça.
   */
  defaultOn: boolean
  /** Como o valor é grafado na arte. */
  format: (value: string) => string
}

const digits = (value: string) => value.replace(/\D/g, '')

/**
 * Telefone brasileiro legível: `(11) 98765-4321`.
 *
 * Fora dos dois tamanhos conhecidos (8 e 9 dígitos, com ou sem DDD) devolvemos
 * o que a pessoa digitou. Adivinhar máscara para número estrangeiro ou ramal
 * produz um telefone errado na arte — pior que um telefone sem máscara.
 */
export function formatPhoneBr(value: string): string {
  const only = digits(value)
  const local = only.length > 11 && only.startsWith('55') ? only.slice(2) : only

  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  if (local.length === 9) return `${local.slice(0, 5)}-${local.slice(5)}`
  if (local.length === 8) return `${local.slice(0, 4)}-${local.slice(4)}`
  return value.trim()
}

/** `@` sempre presente e uma vez só — o usuário digita dos dois jeitos. */
function formatHandle(value: string): string {
  const clean = value.trim().replace(/^@+/, '').replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
  return clean ? `@${clean.replace(/\/+$/, '')}` : ''
}

/** Sem `https://` e sem `www.`: na arte, protocolo é lixo visual. */
function formatWebsite(value: string): string {
  return value.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
}

const trimmed = (value: string) => value.trim()

export const BUSINESS_FIELDS: BusinessFieldSpec[] = [
  {
    id: 'name',
    label: 'Nome do estabelecimento',
    icon: 'lucide:store',
    placeholder: 'Ex.: Burger do Zé',
    hint: 'Como o negócio se chama na rua e nas redes.',
    max: 60,
    inputType: 'text',
    autocomplete: 'organization',
    defaultOn: false,
    format: trimmed,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: 'lucide:message-circle',
    placeholder: '(11) 98765-4321',
    hint: 'O número que recebe os pedidos.',
    max: 24,
    inputType: 'tel',
    autocomplete: 'tel',
    defaultOn: true,
    format: formatPhoneBr,
  },
  {
    id: 'phone',
    label: 'Telefone fixo',
    icon: 'lucide:phone',
    placeholder: '(11) 3456-7890',
    hint: 'Opcional, para quem ainda atende por ligação.',
    max: 24,
    inputType: 'tel',
    autocomplete: 'tel',
    defaultOn: false,
    format: formatPhoneBr,
  },
  {
    id: 'address',
    label: 'Endereço',
    icon: 'lucide:map-pin',
    placeholder: 'Rua das Flores, 123 — Centro',
    hint: 'Curto: rua, número e bairro. Endereço longo não cabe na arte.',
    max: 120,
    inputType: 'text',
    autocomplete: 'street-address',
    defaultOn: true,
    format: trimmed,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: 'lucide:instagram',
    placeholder: '@seunegocio',
    hint: 'Só o @ — o link completo não serve numa imagem.',
    max: 40,
    inputType: 'text',
    autocomplete: 'off',
    defaultOn: true,
    format: formatHandle,
  },
  {
    id: 'website',
    label: 'Site',
    icon: 'lucide:globe',
    placeholder: 'seunegocio.com.br',
    hint: 'Aparece sem o "https://".',
    max: 80,
    inputType: 'url',
    autocomplete: 'url',
    defaultOn: false,
    format: formatWebsite,
  },
  {
    id: 'hours',
    label: 'Horário de funcionamento',
    icon: 'lucide:clock',
    placeholder: 'Seg a Sáb, 18h às 23h',
    hint: 'Uma linha só.',
    max: 80,
    inputType: 'text',
    autocomplete: 'off',
    defaultOn: false,
    format: trimmed,
  },
]

export const BUSINESS_FIELD: Record<BusinessField, BusinessFieldSpec> = Object.fromEntries(
  BUSINESS_FIELDS.map(spec => [spec.id, spec]),
) as Record<BusinessField, BusinessFieldSpec>

export const BUSINESS_FIELD_IDS: BusinessField[] = BUSINESS_FIELDS.map(spec => spec.id)

/**
 * Teto de informações por arte.
 *
 * Não é limite técnico: é legibilidade. A partir da quarta linha o rodapé vira
 * uma parede de texto pequeno que ninguém lê no feed — e cada linha a mais é
 * mais uma chance de o modelo errar um dígito.
 */
export const MAX_CONTACT_ITEMS = 3

export function emptyBusinessInfo(): BusinessInfo {
  return Object.fromEntries(BUSINESS_FIELD_IDS.map(id => [id, null])) as BusinessInfo
}

/** Preenche o que faltar. Documentos criados antes do campo não têm `business`. */
export function withBusinessInfo(business: Partial<BusinessInfo> | null | undefined): BusinessInfo {
  const base = emptyBusinessInfo()
  if (!business) return base
  for (const id of BUSINESS_FIELD_IDS) {
    const value = business[id]
    base[id] = typeof value === 'string' && value.trim() ? value : null
  }
  return base
}

export function hasBusinessInfo(business: Partial<BusinessInfo> | null | undefined): boolean {
  const filled = withBusinessInfo(business)
  return BUSINESS_FIELD_IDS.some(id => filled[id] !== null)
}

/** Marca de fábrica: o que o dono preencheu **e** costuma valer a pena mostrar. */
export function defaultContactFields(
  business: Partial<BusinessInfo> | null | undefined,
): BusinessField[] {
  const filled = withBusinessInfo(business)
  return BUSINESS_FIELDS.filter(spec => spec.defaultOn && filled[spec.id])
    .map(spec => spec.id)
    .slice(0, MAX_CONTACT_ITEMS)
}

/**
 * Resolve a seleção contra os dados do perfil, já formatados para a arte.
 *
 * Campo selecionado mas vazio no perfil simplesmente some — é o que acontece
 * quando alguém apaga o telefone depois de tê-lo marcado num rascunho antigo.
 * A ordem é a do catálogo, não a do clique: contato lido sempre na mesma ordem
 * é mais fácil de reconhecer.
 */
export function resolveContactItems(
  business: Partial<BusinessInfo> | null | undefined,
  fields: BusinessField[],
): ContactItem[] {
  const filled = withBusinessInfo(business)
  const selected = new Set(fields)

  return BUSINESS_FIELDS.filter(spec => selected.has(spec.id))
    .map((spec) => {
      const raw = filled[spec.id]
      return raw ? { field: spec.id, value: spec.format(raw) } : null
    })
    .filter((item): item is ContactItem => item !== null && item.value.length > 0)
    .slice(0, MAX_CONTACT_ITEMS)
}

/** Linha única de contato, como aparece no rodapé da peça. */
export function contactLine(items: ContactItem[]): string {
  return items.map(item => item.value).join(' · ')
}

export function emptyBrandSettings(): BrandSettings {
  return { logoPath: null, colors: [], defaultStyle: null, business: emptyBusinessInfo() }
}
