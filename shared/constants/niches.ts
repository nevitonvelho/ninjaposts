import type { StyleId } from '../types/generation'

export interface NicheSuggestion {
  label: string
  icon: string
  /** Estilo que costuma funcionar melhor — pré-seleciona o formulário. */
  suggestedStyle: StyleId
  /** Exemplos que viram placeholders reais nos campos, em vez de texto genérico. */
  sampleProduct: string
  sampleCta: string
}

/**
 * Sugestões, não uma lista fechada: o campo de nicho aceita texto livre.
 * Fechar o vocabulário aqui limitaria o produto aos negócios que imaginamos hoje.
 */
export const NICHE_SUGGESTIONS: NicheSuggestion[] = [
  /**
   * Comida pede `luxuoso`, não `vibrante` — e isto custou uma arte para
   * descobrir.
   *
   * O fragmento de "Vibrante" pede *cores altamente saturadas, gradientes
   * energéticos, composição dinâmica em diagonal*, e era exatamente isso que
   * saía: fundo laranja chapado com texto flutuando. Anúncio de hamburgueria
   * que parece feito por agência é escuro, com o produto iluminado como se
   * estivesse num estúdio — que é o que `luxuoso` descreve.
   */
  { label: 'Hamburgueria', icon: 'lucide:beef', suggestedStyle: 'luxuoso', sampleProduct: 'X-Bacon', sampleCta: 'Peça agora' },
  { label: 'Pizzaria', icon: 'lucide:pizza', suggestedStyle: 'luxuoso', sampleProduct: 'Pizza Calabresa G', sampleCta: 'Peça pelo WhatsApp' },
  { label: 'Cafeteria', icon: 'lucide:coffee', suggestedStyle: 'natural', sampleProduct: 'Cappuccino artesanal', sampleCta: 'Venha tomar um café' },
  { label: 'Açaí e sorvetes', icon: 'lucide:ice-cream-cone', suggestedStyle: 'divertido', sampleProduct: 'Açaí 500ml', sampleCta: 'Monte o seu' },
  { label: 'Barbearia', icon: 'lucide:scissors', suggestedStyle: 'moderno', sampleProduct: 'Corte + barba', sampleCta: 'Agende seu horário' },
  { label: 'Salão de beleza', icon: 'lucide:sparkles', suggestedStyle: 'elegante', sampleProduct: 'Escova progressiva', sampleCta: 'Agende agora' },
  { label: 'Academia', icon: 'lucide:dumbbell', suggestedStyle: 'tecnologico', sampleProduct: 'Plano anual', sampleCta: 'Matricule-se hoje' },
  { label: 'Moda e roupas', icon: 'lucide:shirt', suggestedStyle: 'elegante', sampleProduct: 'Coleção verão', sampleCta: 'Confira a coleção' },
  { label: 'Petshop', icon: 'lucide:dog', suggestedStyle: 'divertido', sampleProduct: 'Banho e tosa', sampleCta: 'Agende o banho' },
  { label: 'Imobiliária', icon: 'lucide:home', suggestedStyle: 'minimalista', sampleProduct: 'Apartamento 2 quartos', sampleCta: 'Agende uma visita' },
  { label: 'Odontologia', icon: 'lucide:smile', suggestedStyle: 'minimalista', sampleProduct: 'Clareamento dental', sampleCta: 'Marque sua avaliação' },
  { label: 'Advocacia', icon: 'lucide:scale', suggestedStyle: 'elegante', sampleProduct: 'Consultoria trabalhista', sampleCta: 'Fale com um advogado' },
  { label: 'Marketing digital', icon: 'lucide:megaphone', suggestedStyle: 'moderno', sampleProduct: 'Gestão de redes sociais', sampleCta: 'Solicite uma proposta' },
  { label: 'Mercado e hortifruti', icon: 'lucide:shopping-basket', suggestedStyle: 'natural', sampleProduct: 'Cesta de frutas', sampleCta: 'Peça a sua' },
  { label: 'Doces e confeitaria', icon: 'lucide:cake', suggestedStyle: 'artesanal', sampleProduct: 'Bolo de chocolate', sampleCta: 'Encomende o seu' },
  { label: 'Assistência técnica', icon: 'lucide:wrench', suggestedStyle: 'tecnologico', sampleProduct: 'Troca de tela', sampleCta: 'Faça um orçamento' },
]

/** Chamadas prontas — a maioria dos usuários não sabe o que escrever no CTA. */
export const CTA_SUGGESTIONS: string[] = [
  'Peça agora',
  'Peça pelo WhatsApp',
  'Agende seu horário',
  'Chame no direct',
  'Link na bio',
  'Aproveite hoje',
  'Últimas unidades',
  'Saiba mais',
  'Compre online',
  'Visite nossa loja',
]
