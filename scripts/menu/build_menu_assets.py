# Fabrique les images du menu Aegis pour FancyMenu : fond, logo (mot « AEGIS » extrait de l'icône du
# Discord + slogan), textures de boutons. Usage : python build_menu_assets.py <fond launcher> <icône discord> <sortie>
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

background_path, icon_path, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)

PLUM = (23, 18, 28)        # #17121c, fond du launcher
PEACH = (243, 169, 135)    # #f3a987, accent du launcher
PAPER = (244, 239, 233)    # blanc cassé des textes


def smooth(value, low, high):
    t = max(0.0, min(1.0, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


# --- Logo : le lettrage blanc de l'icône, détouré par sa blancheur (clair et peu saturé).
icon = Image.open(icon_path).convert('RGB')
width, height = icon.size
mask = Image.new('L', icon.size, 0)
source, target = icon.load(), mask.load()
for y in range(int(height * 0.36), int(height * 0.68)):
    for x in range(width):
        r, g, b = source[x, y]
        low, high = min(r, g, b), max(r, g, b)
        target[x, y] = int(255 * smooth(low, 150, 232) * (1 - smooth(high - low, 28, 80)))
box = mask.point(lambda v: 255 if v > 110 else 0).getbbox()
pad = 6
box = (max(0, box[0] - pad), max(0, box[1] - pad), min(width, box[2] + pad), min(height, box[3] + pad))
word = mask.crop(box)
scale = 2.6
word = word.resize((round(word.width * scale), round(word.height * scale)), Image.LANCZOS)
# Raffermit les bords adoucis par l'agrandissement.
word = word.point(lambda v: max(0, min(255, int((v - 40) * 1.35))))


def font(size):
    try:
        f = ImageFont.truetype(r'C:\Windows\Fonts\bahnschrift.ttf', size)
        f.set_variation_by_name('SemiLight Condensed')
        return f
    except Exception:
        return ImageFont.truetype(r'C:\Windows\Fonts\segoeui.ttf', size)


def tracked(text, f, tracking):
    widths = [f.getlength(ch) for ch in text]
    total = int(sum(widths) + tracking * (len(text) - 1))
    ascent, descent = f.getmetrics()
    layer = Image.new('L', (total + 4, ascent + descent + 4), 0)
    draw = ImageDraw.Draw(layer)
    x = 0
    for ch, w in zip(text, widths):
        draw.text((x, 0), ch, font=f, fill=255)
        x += w + tracking
    return layer.crop(layer.getbbox())


slogan = tracked('RP POST-APOCALYPTIQUE', font(round(word.height * 0.25)), round(word.height * 0.085))
if slogan.width > word.width * 0.9:
    ratio = word.width * 0.9 / slogan.width
    slogan = slogan.resize((round(slogan.width * ratio), round(slogan.height * ratio)), Image.LANCZOS)
gap = round(word.height * 0.2)
logo = Image.new('RGBA', (word.width, word.height + gap + slogan.height), (0, 0, 0, 0))
logo.paste(Image.new('RGBA', word.size, PAPER + (255,)), (0, 0), word)
logo.paste(Image.new('RGBA', slogan.size, PEACH + (255,)), (round(word.width * 0.012), word.height + gap), slogan)
logo.save(out / 'logo.png')
print('logo', logo.size, 'ratio', round(logo.width / logo.height, 3))

# --- Fond : l'image du launcher en 1920x1080, assombrie à gauche pour la lisibilité de la colonne.
bg = Image.open(background_path).convert('RGB')
target_w, target_h = 1920, 1080
ratio = max(target_w / bg.width, target_h / bg.height)
bg = bg.resize((round(bg.width * ratio), round(bg.height * ratio)), Image.LANCZOS)
left, top = (bg.width - target_w) // 2, (bg.height - target_h) // 2
bg = bg.crop((left, top, left + target_w, top + target_h))
scrim = Image.new('L', (target_w, 1), 0)
row = scrim.load()
for x in range(target_w):
    row[x, 0] = int(255 * 0.90 * (1 - smooth(x / target_w, 0.05, 0.62)))
scrim = scrim.resize((target_w, target_h))
bottom = Image.new('L', (1, target_h), 0)
col = bottom.load()
for y in range(target_h):
    col[0, y] = int(255 * 0.45 * smooth(y / target_h, 0.78, 1.0))
bottom = bottom.resize((target_w, target_h))
bg.paste(Image.new('RGB', bg.size, PLUM), (0, 0), ImageChops.lighter(scrim, bottom))
bg.save(out / 'background.jpg', quality=90, subsampling=0)
print('fond', bg.size)


# --- Boutons : 150 x 20 pixels d'interface, dessinés à 4x puis suréchantillonnés pour des bords nets.
def button(name, fill, border, size=(600, 80), radius=10, border_width=3):
    factor = 4
    big = (size[0] * factor, size[1] * factor)
    image = Image.new('RGBA', big, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, big[0] - 1, big[1] - 1), radius * factor, fill=border)
    inset = border_width * factor
    draw.rounded_rectangle((inset, inset, big[0] - 1 - inset, big[1] - 1 - inset), max(1, (radius - border_width)) * factor, fill=fill)
    image.resize(size, Image.LANCZOS).save(out / name)


button('btn_primary.png', PEACH + (255,), PEACH + (255,))
button('btn_primary_hover.png', (250, 201, 176, 255), (255, 228, 212, 255))
button('btn_secondary.png', PLUM + (200,), PEACH + (70,))
button('btn_secondary_hover.png', (40, 31, 48, 225), PEACH + (255,))
button('btn_icon.png', PLUM + (200,), PEACH + (70,), size=(80, 80))
button('btn_icon_hover.png', (40, 31, 48, 225), PEACH + (255,), size=(80, 80))

# --- Petits boutons carrés à icône (Lucide), pour remplacer les icônes grises d'origine.
if len(sys.argv) > 4:
    import io
    import resvg_py

    def icon_button(name, svg_name, color, background):
        svg = (Path(sys.argv[4]) / f'{svg_name}.svg').read_text(encoding='utf-8').replace('currentColor', '#%02x%02x%02x' % color)
        icon_png = Image.open(io.BytesIO(bytes(resvg_py.svg_to_bytes(svg_string=svg, width=48, height=48)))).convert('RGBA')
        base = Image.open(out / background).convert('RGBA')
        base.alpha_composite(icon_png, ((base.width - icon_png.width) // 2, (base.height - icon_png.height) // 2))
        base.save(out / name)

    for key, svg_name in (('lang', 'globe'), ('access', 'accessibility')):
        icon_button(f'btn_{key}.png', svg_name, PAPER, 'btn_icon.png')
        icon_button(f'btn_{key}_hover.png', svg_name, PEACH, 'btn_icon_hover.png')

# --- Aperçu de contrôle (maquette, pas une capture du jeu) : logo et gabarit des boutons sur le fond.
preview = bg.copy().convert('RGBA')
gui = 4
logo_w = 150 * gui
shown = logo.resize((logo_w, round(logo.height * logo_w / logo.width)), Image.LANCZOS)
x0, mid = 24 * gui, target_h // 2
preview.alpha_composite(shown, (x0, mid - 92 * gui))
for index, name in enumerate(['btn_primary.png', 'btn_secondary.png', 'btn_secondary.png', 'btn_secondary.png']):
    preview.alpha_composite(Image.open(out / name), (x0, mid + (-22 + 26 * index) * gui))
preview.convert('RGB').resize((960, 540), Image.LANCZOS).save(out.parent / 'apercu-maquette.png')
print('aperçu écrit')
