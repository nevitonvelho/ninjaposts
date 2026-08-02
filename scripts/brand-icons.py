"""Gera os ícones da marca a partir de `public/logo.png`.

    python3 scripts/brand-icons.py

Produz `mark.png` (usado pelo `AppLogo`), `favicon.svg`, `favicon.ico` e
`apple-touch-icon.png`. Todos saem do **mesmo** recorte, para que aba, tela de
início e cabeçalho não divirjam quando a logo for redesenhada.

O fundo é removido por flood fill a partir das bordas, e não por "todo pixel
claro vira transparente". A diferença importa: o mascote tem branco *interno*
que faz parte do desenho — o anel dentro da moldura e o cartãozinho com o ícone
de imagem. Um limiar global furaria os dois.
"""
from collections import deque
from pathlib import Path
import base64
import io

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / 'public'
SRC = PUBLIC / 'logo.png'

# A logo é o lockup deitado: mascote à esquerda, wordmark à direita, separados
# por um vão de ~27px. Recortamos só o mascote — o wordmark vira texto no
# `AppLogo`, que fica nítido em qualquer DPI e acompanha o tamanho da fonte.
MARK_BOX = (55, 333, 515, 710)

OPAQUE = 238      # a partir daqui o pixel é fundo, não desenho
RAMP_FLOOR = 200  # contorno antisserrilhado mais claro que isto ganha alpha parcial


def luminance(pixel):
    r, g, b = pixel
    return (r * 299 + g * 587 + b * 114) // 1000


def cut_out(image):
    """Fundo → transparente, preservando o branco interno do desenho."""
    w, h = image.size
    px = image.load()
    outside = bytearray(w * h)
    queue = deque()

    def seed(x, y):
        if luminance(px[x, y]) >= OPAQUE and not outside[y * w + x]:
            outside[y * w + x] = 1
            queue.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not outside[ny * w + nx]:
                if luminance(px[nx, ny]) >= OPAQUE:
                    outside[ny * w + nx] = 1
                    queue.append((nx, ny))

    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if outside[y * w + x]:
                op[x, y] = (r, g, b, 0)
                continue

            alpha = 255
            level = luminance((r, g, b))
            if level > RAMP_FLOOR and any(
                outside[(y + dy) * w + (x + dx)]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                if 0 <= x + dx < w and 0 <= y + dy < h
            ):
                alpha = max(0, min(255, round(255 * (255 - level) / (255 - RAMP_FLOOR))))
            op[x, y] = (r, g, b, alpha)

    return out.crop(out.getbbox())


def squared(mark, size, pad_ratio=0.04, background=None):
    """Centraliza o mascote num canvas quadrado com folga proporcional."""
    side = round(max(mark.size) * (1 + pad_ratio * 2))
    canvas = Image.new('RGBA', (side, side), background or (0, 0, 0, 0))
    canvas.alpha_composite(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def shrink(image, colors=255):
    """Quantiza para paleta.

    Corta o `mark.png` de ~51 KB para ~9 KB. O gradiente da moldura sobrevive
    sem faixas visíveis — e ele nunca é exibido acima de 44px, onde a diferença
    seria imperceptível de qualquer jeito.
    """
    return image.quantize(colors=colors, method=Image.FASTOCTREE)


def main():
    mark = cut_out(Image.open(SRC).convert('RGB').crop(MARK_BOX))
    print(f'mascote recortado: {mark.size[0]}x{mark.size[1]}')

    shrink(squared(mark, 256)).save(PUBLIC / 'mark.png', optimize=True)

    # O iOS pinta transparência de preto ao salvar na tela de início — este vai
    # sobre branco de propósito.
    shrink(squared(mark, 180, background=(255, 255, 255, 255))).save(
        PUBLIC / 'apple-touch-icon.png', optimize=True
    )

    squared(mark, 64).save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

    buffer = io.BytesIO()
    shrink(squared(mark, 64)).save(buffer, 'PNG', optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode()
    (PUBLIC / 'favicon.svg').write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
        ' viewBox="0 0 64 64" width="64" height="64">\n'
        '  <title>ninjaposts</title>\n'
        '  <!-- Mascote recortado de logo.png por scripts/brand-icons.py. Embutido\n'
        '       em base64 para o favicon não custar um segundo request. -->\n'
        f'  <image width="64" height="64" xlink:href="data:image/png;base64,{encoded}"/>\n'
        '</svg>\n',
        encoding='utf-8',
    )

    for name in ('mark.png', 'apple-touch-icon.png', 'favicon.ico', 'favicon.svg'):
        print(f'  {(PUBLIC / name).stat().st_size / 1024:>6.1f} KB  {name}')


if __name__ == '__main__':
    main()
