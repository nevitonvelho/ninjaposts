import sharp from 'sharp'
import { FORMATS } from '../../../shared/constants'
import type { PostFormat } from '../../../shared/types/generation'

/**
 * Etapa PROCESS — recorte e derivados.
 *
 * O modelo de imagem só entrega três tamanhos nativos (§7.3), e nenhum deles é
 * 9:16. Story a 1024×1536 e story a 1080×1920 são proporções diferentes: pedir
 * "9:16" à API é erro, então o ajuste fino é aqui.
 *
 * `fit: cover` + `position: attention` em vez de corte central: o corte
 * centralizado corta pela metade justamente o produto quando ele não está no
 * meio do quadro. `attention` procura a região de maior contraste e detalhe,
 * que na prática é o produto.
 */

export interface ProcessedImage {
  png: Buffer
  jpg: Buffer
  thumb: Buffer
  width: number
  height: number
}

const THUMB_WIDTH = 400

/** Largura da logo e sua margem, como fração da largura final da peça. */
const LOGO_WIDTH_RATIO = 0.18
const LOGO_MARGIN_RATIO = 0.05

/**
 * Prepara a logo para o canto reservado pelo prompt.
 *
 * `fit: 'inside'` porque logo tem proporção própria: esticar para um quadrado
 * deformaria a marca, que é exatamente o defeito que sair do `images.edit`
 * deveria eliminar.
 *
 * `density` alta na leitura serve ao caso SVG — o formato é aceito no upload, e
 * rasterizar na densidade padrão para depois ampliar entrega uma logo borrada.
 * Em arquivo raster o parâmetro é inócuo.
 */
async function fitLogo(logo: Buffer, canvasWidth: number): Promise<Buffer> {
  const box = Math.round(canvasWidth * LOGO_WIDTH_RATIO)

  return sharp(logo, { density: 300 })
    .resize(box, box, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
}

export async function processImage(
  source: Buffer,
  format: PostFormat,
  logo: Buffer | null = null,
): Promise<ProcessedImage> {
  const { width, height } = FORMATS[format].output

  const base = sharp(source).resize(width, height, {
    fit: 'cover',
    position: sharp.strategy.attention,
  })

  /**
   * A logo entra **depois** do recorte final e **antes** dos derivados: assim
   * ela é medida contra as dimensões de entrega e sai idêntica no PNG, no JPG e
   * na miniatura. Compor antes do `resize` a deformaria junto com a arte.
   */
  if (logo) {
    const margin = Math.round(width * LOGO_MARGIN_RATIO)
    base.composite([{ input: await fitLogo(logo, width), top: margin, left: margin }])
  }

  /**
   * Três clones do mesmo pipeline, e não três `sharp(source)`: decodificar o
   * PNG de origem uma vez só economiza tempo e memória — que é o recurso caro
   * na Cloud Function.
   */
  const [png, jpg, thumb] = await Promise.all([
    base.clone().png({ compressionLevel: 9, effort: 7 }).toBuffer(),
    base.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
    base
      .clone()
      .resize(THUMB_WIDTH, Math.round((THUMB_WIDTH * height) / width), { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer(),
  ])

  return { png, jpg, thumb, width, height }
}
