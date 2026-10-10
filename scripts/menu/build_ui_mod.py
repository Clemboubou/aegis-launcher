# Fabrique « aegis-ui », un mod sans code (ressources seules) qui remplace la texture des boutons et des
# curseurs de Minecraft par la charte d'Aegis. Tous les boutons du jeu et ceux des mods qui réutilisent la
# texture d'origine (Essential, entre autres) prennent ainsi le même aspect, sans pack de ressources à activer.
# Usage : python build_ui_mod.py <dossier des textures d'origine> <jar de sortie>
import sys
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw

vanilla, target = Path(sys.argv[1]), Path(sys.argv[2])
SCALE = 4                  # textures 4 fois plus fines que l'original, pour des bords nets
PLUM = (23, 18, 28)
PEACH = (243, 169, 135)


def rounded(size, fill, border, radius=10, border_width=3):
    factor = 4
    big = (size[0] * factor, size[1] * factor)
    image = Image.new('RGBA', big, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, big[0] - 1, big[1] - 1), radius * factor, fill=border)
    inset = border_width * factor
    draw.rounded_rectangle((inset, inset, big[0] - 1 - inset, big[1] - 1 - inset), max(1, radius - border_width) * factor, fill=fill)
    return image.resize(size, Image.LANCZOS)


def upscaled(name):
    image = Image.open(vanilla / name).convert('RGBA')
    return image.resize((image.width * SCALE, image.height * SCALE), Image.NEAREST)


def put(sheet, x, y, width, height, image):
    box = (x * SCALE, y * SCALE, (x + width) * SCALE, (y + height) * SCALE)
    sheet.paste((0, 0, 0, 0), box)
    sheet.paste(image, box[:2])


# widgets.png : boutons inactif (0,46), normal (0,66), survolé (0,86), chacun de 200 x 20.
widgets = upscaled('widgets.png')
size = (200 * SCALE, 20 * SCALE)
put(widgets, 0, 46, 200, 20, rounded(size, PLUM + (150,), (120, 110, 125, 60)))
put(widgets, 0, 66, 200, 20, rounded(size, PLUM + (215,), PEACH + (80,)))
put(widgets, 0, 86, 200, 20, rounded(size, (40, 31, 48, 235), PEACH + (255,)))

# slider.png : fond (0,0), fond en surbrillance (0,20), poignée (0,40), poignée survolée (0,60).
slider = upscaled('slider.png')
put(slider, 0, 0, 200, 20, rounded(size, (14, 11, 17, 215), PEACH + (60,)))
put(slider, 0, 20, 200, 20, rounded(size, (14, 11, 17, 235), PEACH + (255,)))
put(slider, 0, 40, 200, 20, rounded(size, PEACH + (235,), PEACH + (255,)))
put(slider, 0, 60, 200, 20, rounded(size, (250, 201, 176, 255), (255, 228, 212, 255)))

mods_toml = '''modLoader = "lowcodefml"
loaderVersion = "[47,)"
license = "MIT"

[[mods]]
modId = "aegisui"
version = "1.0.0"
displayName = "Aegis UI"
description = "Boutons et curseurs du jeu aux couleurs d'Aegis. Ressources seules, aucun code."
displayTest = "IGNORE_ALL_VERSION"
'''
pack_mcmeta = '{"pack": {"description": "Aegis UI", "pack_format": 15}}\n'

target.parent.mkdir(parents=True, exist_ok=True)
work = target.parent / 'aegis-ui-textures'
work.mkdir(exist_ok=True)
widgets.save(work / 'widgets.png')
slider.save(work / 'slider.png')
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as jar:
    jar.writestr('META-INF/mods.toml', mods_toml)
    jar.writestr('pack.mcmeta', pack_mcmeta)
    jar.write(work / 'widgets.png', 'assets/minecraft/textures/gui/widgets.png')
    jar.write(work / 'slider.png', 'assets/minecraft/textures/gui/slider.png')
print('mod écrit :', target.name, target.stat().st_size, 'octets')
