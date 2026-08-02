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
 * Quão longe do fundo um pixel pode estar e ainda ser considerado fundo.
 *
 * Folgado porque logo chega comprimida: um PNG achatado a partir de JPEG tem o
 * "preto" oscilando dezenas de níveis, e limiar apertado deixa metade do fundo
 * para trás — que na prática é o mesmo que não remover nada.
 */
const BG_TOLERANCE = 72

/** Fração da borda que precisa concordar para o fundo ser considerado chapado. */
const BG_BORDER_AGREEMENT = 0.9

/**
 * Remove o fundo chapado da logo, se houver.
 *
 * Existe porque a maioria das logos que o cliente sobe **não tem
 * transparência**: é um quadrado branco ou preto com a marca no meio, exportado
 * de um JPG ou de um PNG achatado. Colada assim, ela pousa como um retângulo
 * sólido sobre a arte — o defeito que motivou esta função.
 *
 * O fundo sai por *flood fill* a partir das bordas, e não por "todo pixel
 * parecido com a cor do canto vira transparente". A diferença importa: marca
 * com contra-forma da mesma cor do fundo — o buraco de um "A", o miolo de um
 * selo — some inteira com limiar global, e o flood fill preserva, porque esses
 * pixels não estão ligados à borda.
 *
 * Conservador de propósito. Só age quando os quatro cantos concordam entre si:
 * fundo não uniforme é design deliberado (um selo redondo escuro, uma foto), e
 * apagá-lo estragaria a marca em vez de consertar.
 */
async function removeFlatBackground(logo: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(logo, { density: 300 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: w, height: h, channels } = info
  const at = (x: number, y: number) => (y * w + x) * channels

  /**
   * A cor do fundo é a **mediana da borda inteira**, não a média dos quatro
   * cantos. Canto é um pixel só, e um pixel só mente: em arquivo comprimido ele
   * carrega o sangramento do que estava ao lado, e a estimativa sai deslocada o
   * bastante para o fundo verdadeiro cair fora da tolerância. A mediana de
   * ~4·lado amostras ignora esses extremos por construção.
   */
  const borda: number[] = []
  for (let x = 0; x < w; x++) {
    borda.push(at(x, 0), at(x, h - 1))
  }
  for (let y = 0; y < h; y++) {
    borda.push(at(0, y), at(w - 1, y))
  }

  // Já tem transparência na borda: o arquivo veio pronto, não há o que fazer.
  if (borda.some(i => data[i + 3]! < 250)) return logo

  const mediana = (c: number) => {
    const valores = borda.map(i => data[i + c]!).sort((a, b) => a - b)
    return valores[valores.length >> 1]!
  }
  const fundo = [mediana(0), mediana(1), mediana(2)]

  const distancia = (i: number) =>
    Math.abs(data[i]! - fundo[0]!) + Math.abs(data[i + 1]! - fundo[1]!) + Math.abs(data[i + 2]! - fundo[2]!)

  // Borda heterogênea = fundo não é chapado, é design ou foto. Não mexe.
  const concordam = borda.filter(i => distancia(i) <= BG_TOLERANCE).length
  if (concordam < borda.length * BG_BORDER_AGREEMENT) return logo

  const fora = new Uint8Array(w * h)
  const fila: number[] = []

  const semear = (x: number, y: number) => {
    const p = y * w + x
    if (!fora[p] && distancia(at(x, y)) <= BG_TOLERANCE) {
      fora[p] = 1
      fila.push(p)
    }
  }

  for (let x = 0; x < w; x++) {
    semear(x, 0)
    semear(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    semear(0, y)
    semear(w - 1, y)
  }

  for (let k = 0; k < fila.length; k++) {
    const p = fila[k]!
    const x = p % w
    const y = (p - x) / w

    if (x > 0) semear(x - 1, y)
    if (x < w - 1) semear(x + 1, y)
    if (y > 0) semear(x, y - 1)
    if (y < h - 1) semear(x, y + 1)
  }

  /**
   * Rede de segurança: se o flood fill comeu quase tudo, a detecção errou — a
   * marca é da cor do fundo, ou a imagem é praticamente monocromática. Melhor
   * devolver a logo intacta do que uma transparente.
   */
  let removidos = 0
  for (let p = 0; p < fora.length; p++) if (fora[p]) removidos++
  if (removidos > fora.length * 0.97) return logo

  for (let p = 0; p < fora.length; p++) {
    if (fora[p]) data[p * channels + 3] = 0
  }

  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
}

/**
 * Prepara a logo para o canto reservado pelo prompt.
 *
 * `fit: 'inside'` porque logo tem proporção própria: esticar para um quadrado
 * deformaria a marca, que é exatamente o defeito que a composição deveria
 * eliminar.
 *
 * `density` alta na leitura serve ao caso SVG — o formato é aceito no upload, e
 * rasterizar na densidade padrão para depois ampliar entrega uma logo borrada.
 * Em arquivo raster o parâmetro é inócuo.
 */
async function fitLogo(logo: Buffer, canvasWidth: number): Promise<Buffer> {
  const box = Math.round(canvasWidth * LOGO_WIDTH_RATIO)
  const semFundo = await removeFlatBackground(logo)

  return sharp(semFundo, { density: 300 })
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
