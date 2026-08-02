import { defineSecret, defineString } from 'firebase-functions/params'

/**
 * Configuração das Functions.
 *
 * A chave da OpenAI é `defineSecret`, não variável de ambiente: fica no Secret
 * Manager, é injetada só nas funções que a declaram em `secrets: [...]` e não
 * aparece em log nem na descrição da função. Uma chave de API que gera custo
 * por chamada não pode viver em texto plano na configuração.
 *
 * Os modelos são `defineString` porque trocar de modelo é operação rotineira —
 * e ninguém deveria precisar de novo deploy do código para testar outro.
 */
export const openaiApiKey = defineSecret('OPENAI_API_KEY')

export const briefModel = defineString('OPENAI_BRIEF_MODEL', { default: 'gpt-5' })
export const imageModel = defineString('OPENAI_IMAGE_MODEL', { default: 'gpt-image-1' })

/** Região única para tudo: latência menor e nenhuma surpresa de custo entre regiões. */
export const REGION = 'southamerica-east1'
