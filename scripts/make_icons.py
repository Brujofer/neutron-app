"""Genera los iconos PNG de la PWA a partir de las mismas formas de icon.svg.
Uso: python scripts/make_icons.py
"""
from PIL import Image, ImageDraw
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..')

BG = (27, 23, 19, 255)
YELLOW = (227, 194, 60, 255)
RED = (192, 57, 43, 255)
BLUE = (45, 111, 209, 255)
WHITE = (244, 241, 234, 255)


def draw_icon(size, rounded=True, content_padding_ratio=0.0):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # El fondo siempre va de borde a borde (clave para los iconos "maskable",
    # que el sistema operativo recorta con su propia forma).
    radius = int(size * 0.22) if rounded else 0
    draw.rounded_rectangle((0, 0, size, size), radius=radius, fill=BG)

    pad = int(size * content_padding_ratio)
    box = (pad, pad, size - pad, size - pad)
    scale = (box[2] - box[0]) / 100.0
    ox, oy = box[0], box[1]

    def circle(cx, cy, r, color):
        draw.ellipse(
            [ox + (cx - r) * scale, oy + (cy - r) * scale, ox + (cx + r) * scale, oy + (cy + r) * scale],
            fill=color,
        )

    circle(22, 22, 11, YELLOW)
    circle(78, 22, 11, RED)
    circle(22, 78, 11, BLUE)
    circle(78, 78, 11, WHITE)

    sq = [ox + 37 * scale, oy + 37 * scale, ox + 63 * scale, oy + 63 * scale]
    draw.rounded_rectangle(sq, radius=4 * scale, fill=WHITE)
    return img


draw_icon(192).save(os.path.join(OUT_DIR, 'icon-192.png'))
draw_icon(512).save(os.path.join(OUT_DIR, 'icon-512.png'))
# Maskable: fondo de borde a borde, sin esquinas redondeadas propias, y el
# contenido con zona segura (el SO puede recortar en círculo u otra forma).
draw_icon(512, rounded=False, content_padding_ratio=0.16).save(os.path.join(OUT_DIR, 'icon-512-maskable.png'))

print('Listo: icon-192.png, icon-512.png, icon-512-maskable.png')
