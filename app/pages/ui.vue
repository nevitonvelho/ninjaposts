<script setup lang="ts">
/**
 * Showcase do design system — a página onde cada componente é validado
 * isoladamente, incluindo os estados que quase nunca aparecem no fluxo normal
 * (erro, vazio, carregando, desabilitado).
 *
 * Fica no app por decisão consciente: um catálogo que só roda em Storybook
 * separado tende a desatualizar. Aqui, se um componente quebra, o build quebra.
 */
import { STATUS_COPY, STYLE_LIST } from '#shared/constants'

definePageMeta({ layout: 'default' })
useHead({ title: 'Design System — CriaPosts' })

const tab = ref('acoes')

const TABS = [
  { value: 'acoes', label: 'Ações', icon: 'lucide:mouse-pointer-click' },
  { value: 'formulario', label: 'Formulário', icon: 'lucide:text-cursor-input' },
  { value: 'dados', label: 'Dados', icon: 'lucide:layout-grid' },
  { value: 'feedback', label: 'Feedback', icon: 'lucide:message-square' },
]

// --- estado dos exemplos ---------------------------------------------------
const loadingDemo = ref(false)
const nicho = ref('')
const preco = ref('')
const descricao = ref('')
const estilo = ref<string | null>(null)
const marcaDagua = ref(true)
const modalOpen = ref(false)
const progresso = ref(35)

const nichoErro = computed(() => (nicho.value.length === 1 ? 'Use pelo menos 2 caracteres' : null))

const estiloOptions = STYLE_LIST.map(s => ({ value: s.id, label: s.label }))

const toast = useToast()
const { confirmDelete } = useDialog()

function simularCarregamento() {
  loadingDemo.value = true
  setTimeout(() => (loadingDemo.value = false), 1800)
}

async function simularExclusao() {
  const ok = await confirmDelete({
    title: 'Excluir este post?',
    description: 'A arte, a legenda e as hashtags serão removidas. Esta ação não pode ser desfeita.',
  })
  if (ok) toast.success({ title: 'Post excluído', description: 'Você pode gerar outro quando quiser.' })
  else toast.info('Exclusão cancelada')
}
</script>

<template>
  <main class="mx-auto max-w-4xl px-6 py-16">
    <header class="mb-10">
      <UiBadge tone="brand" icon="lucide:palette">Etapa 2</UiBadge>
      <h1 class="mt-4 text-3xl font-semibold tracking-tight">Design System</h1>
      <p class="mt-2 text-ink-muted">
        Componentes base do CriaPosts, com os estados que o fluxo feliz esconde.
      </p>
    </header>

    <UiTabs v-model="tab" :items="TABS" aria-label="Seções do design system">
      <!-- ------------------------------------------------------------ AÇÕES -->
      <template #acoes>
        <div class="space-y-8">
          <UiCard title="Variantes" description="Hierarquia visual: um primário por tela.">
            <div class="flex flex-wrap items-center gap-3">
              <UiButton>Gerar arte</UiButton>
              <UiButton variant="secondary">Cancelar</UiButton>
              <UiButton variant="ghost">Ver detalhes</UiButton>
              <UiButton variant="danger" icon="lucide:trash-2">Excluir</UiButton>
              <UiButton variant="link">Saiba mais</UiButton>
            </div>
          </UiCard>

          <UiCard title="Tamanhos e ícones">
            <div class="flex flex-wrap items-center gap-3">
              <UiButton size="sm" icon="lucide:sparkles">Pequeno</UiButton>
              <UiButton size="md" icon="lucide:sparkles">Médio</UiButton>
              <UiButton size="lg" icon="lucide:sparkles">Grande</UiButton>
              <UiButton size="icon" variant="secondary" aria-label="Configurações">
                <Icon name="lucide:settings" class="size-4" />
              </UiButton>
              <UiButton variant="secondary" icon-right="lucide:arrow-right">Continuar</UiButton>
            </div>
          </UiCard>

          <UiCard
            title="Carregando e desabilitado"
            description="No loading o rótulo fica invisível mas mantém a largura — o botão não pode encolher debaixo do cursor."
          >
            <div class="flex flex-wrap items-center gap-3">
              <UiButton :loading="loadingDemo" @click="simularCarregamento">
                Gerar arte
              </UiButton>
              <UiButton variant="secondary" loading>Salvando</UiButton>
              <UiButton disabled>Sem créditos</UiButton>
            </div>
          </UiCard>

          <UiCard title="Menu e dica">
            <div class="flex flex-wrap items-center gap-4">
              <UiDropdown
                :items="[
                  { label: 'Baixar PNG', icon: 'lucide:download' },
                  { label: 'Copiar legenda', icon: 'lucide:clipboard' },
                  { label: 'Duplicar', icon: 'lucide:copy', separated: true },
                  { label: 'Excluir', icon: 'lucide:trash-2', danger: true },
                ]"
              />

              <UiTooltip text="Cada arte gerada consome 1 crédito">
                <UiButton variant="ghost" size="sm" icon="lucide:help-circle">Créditos</UiButton>
              </UiTooltip>

              <UiCopyButton text="#hamburgueria #xbacon #delivery" label="Copiar hashtags" toast />
            </div>
          </UiCard>
        </div>
      </template>

      <!-- ------------------------------------------------------- FORMULÁRIO -->
      <template #formulario>
        <div class="space-y-8">
          <UiCard title="Campos" description="Label, dica, erro e aria-* ligados automaticamente.">
            <div class="grid gap-5 sm:grid-cols-2">
              <UiField
                label="Nicho"
                hint="Ex.: Hamburgueria, Barbearia"
                :error="nichoErro"
                required
              >
                <UiInput v-model="nicho" placeholder="Qual é o seu negócio?" icon="lucide:store" />
              </UiField>

              <UiField label="Preço" hint="Deixe vazio se não quiser mostrar">
                <UiInput v-model="preco" prefix="R$" placeholder="29,90" inputmode="decimal" />
              </UiField>

              <UiField label="Estilo">
                <UiSelect
                  v-model="estilo"
                  :options="estiloOptions"
                  placeholder="Escolha um estilo"
                />
              </UiField>

              <UiField label="Campo desabilitado" hint="Disponível em breve">
                <UiInput model-value="Alta qualidade" disabled />
              </UiField>
            </div>

            <div class="mt-5">
              <UiField
                label="Descrição"
                hint="A IA usa isso para dar personalidade à arte"
                :count="descricao.length"
                :max="400"
              >
                <UiTextarea
                  v-model="descricao"
                  autoresize
                  placeholder="Hambúrguer artesanal com bacon crocante e cheddar derretido…"
                />
              </UiField>
            </div>

            <div class="mt-6 border-t border-line pt-5">
              <UiSwitch
                v-model="marcaDagua"
                label="Marca d'água"
                description="Some ao comprar qualquer pacote de créditos."
              />
            </div>
          </UiCard>
        </div>
      </template>

      <!-- -------------------------------------------------------------- DADOS -->
      <template #dados>
        <div class="space-y-8">
          <UiCard title="Status">
            <div class="flex flex-wrap gap-2">
              <UiBadge dot tone="neutral">Na fila</UiBadge>
              <UiBadge dot tone="info">Gerando</UiBadge>
              <UiBadge dot tone="success">Pronto</UiBadge>
              <UiBadge dot tone="danger">Falhou</UiBadge>
              <UiBadge tone="warning" icon="lucide:zap">Créditos acabando</UiBadge>
              <UiBadge tone="brand" icon="lucide:crown">Pro</UiBadge>
            </div>
          </UiCard>

          <UiCard title="Avatares">
            <div class="flex items-end gap-3">
              <UiAvatar name="Neviton Velho" size="xs" />
              <UiAvatar name="Neviton Velho" size="sm" />
              <UiAvatar name="Neviton Velho" size="md" />
              <UiAvatar name="Neviton Velho" size="lg" />
              <UiAvatar name="Ana Paula Souza" size="xl" />
              <UiAvatar src="/imagem-que-nao-existe.png" name="Fallback Teste" size="xl" />
            </div>
          </UiCard>

          <UiCard title="Carregando" description="Esqueleto com a forma do conteúdo que vai chegar.">
            <div class="grid gap-5 sm:grid-cols-3">
              <div class="space-y-3">
                <UiSkeleton shape="rect" height="120px" />
                <UiSkeleton :lines="2" />
              </div>
              <div class="space-y-3">
                <UiSkeleton shape="rect" height="120px" />
                <UiSkeleton :lines="2" />
              </div>
              <div class="flex flex-col items-center justify-center gap-3 text-ink-subtle">
                <UiSpinner size="lg" />
                <span class="text-sm">Spinner</span>
              </div>
            </div>
          </UiCard>

          <UiCard title="Progresso" description="Estados reais do job de geração.">
            <div class="space-y-4">
              <div>
                <div class="mb-2 flex justify-between text-sm">
                  <span class="font-medium">{{ STATUS_COPY.rendering.title }}</span>
                  <span class="text-ink-subtle tabular-nums">{{ progresso }}%</span>
                </div>
                <UiProgress :value="progresso" label="Progresso da geração" />
                <p class="mt-2 text-sm text-ink-muted">{{ STATUS_COPY.rendering.hint }}</p>
              </div>

              <div class="flex gap-2">
                <UiButton size="sm" variant="secondary" @click="progresso = Math.max(0, progresso - 15)">
                  −15%
                </UiButton>
                <UiButton size="sm" variant="secondary" @click="progresso = Math.min(100, progresso + 15)">
                  +15%
                </UiButton>
              </div>
            </div>
          </UiCard>

          <UiCard flush :padding="'none'">
            <UiEmptyState
              icon="lucide:image-off"
              title="Nenhuma arte ainda"
              description="Suas criações aparecem aqui assim que você gerar a primeira."
            >
              <UiButton icon="lucide:sparkles">Criar primeiro post</UiButton>
            </UiEmptyState>
          </UiCard>
        </div>
      </template>

      <!-- ----------------------------------------------------------- FEEDBACK -->
      <template #feedback>
        <div class="space-y-8">
          <UiCard title="Toasts" description="Erros ficam 8s; o resto, 5s.">
            <div class="flex flex-wrap gap-3">
              <UiButton variant="secondary" @click="toast.success('Legenda copiada!')">
                Sucesso
              </UiButton>
              <UiButton
                variant="secondary"
                @click="
                  toast.error({
                    title: 'Não foi possível gerar a arte',
                    description: 'Seus créditos foram devolvidos. Tente novamente.',
                  })
                "
              >
                Erro
              </UiButton>
              <UiButton
                variant="secondary"
                @click="
                  toast.warning({
                    title: 'Você tem 2 créditos',
                    action: { label: 'Comprar créditos', onClick: () => toast.info('Indo para créditos…') },
                  })
                "
              >
                Aviso com ação
              </UiButton>
              <UiButton variant="ghost" @click="toast.clear()">Limpar</UiButton>
            </div>
          </UiCard>

          <UiCard
            title="Confirmação"
            description="Baseada em promise: `if (await confirmDelete(...))`."
          >
            <UiButton variant="danger" icon="lucide:trash-2" @click="simularExclusao">
              Excluir post
            </UiButton>
          </UiCard>

          <UiCard
            title="Modal"
            description="`<dialog>` nativo: foco preso, Escape, top-layer e fundo inerte de graça."
          >
            <UiButton variant="secondary" @click="modalOpen = true">Abrir modal</UiButton>

            <UiModal
              v-model:open="modalOpen"
              title="Confirmar compra"
              description="A mudança vale a partir do próximo ciclo."
            >
              <div class="space-y-3">
                <p class="text-sm text-ink-muted">
                  Os créditos entram na conta assim que o pagamento é confirmado.
                </p>
                <UiField label="Confirme digitando o nome do pacote">
                  <UiInput placeholder="Pro" />
                </UiField>
              </div>

              <template #footer>
                <UiButton variant="secondary" @click="modalOpen = false">Cancelar</UiButton>
                <UiButton @click="modalOpen = false; toast.success('Compra confirmada')">
                  Confirmar
                </UiButton>
              </template>
            </UiModal>
          </UiCard>
        </div>
      </template>
    </UiTabs>
  </main>
</template>
