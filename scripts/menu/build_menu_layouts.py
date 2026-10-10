# Écrit la mise en page FancyMenu de l'écran titre d'Aegis et la liste des écrans personnalisés.
# Usage : python build_menu_layouts.py <dossier config/fancymenu de sortie>
import sys
import time
from pathlib import Path

out = Path(sys.argv[1])
(out / 'customization').mkdir(parents=True, exist_ok=True)

ASSETS = '[source:local]/config/fancymenu/assets/aegis/'
SERVER = 'projectaegis.mine.fun'
NOW = int(time.time() * 1000)

# Colonne à gauche, centrée verticalement : positions en pixels d'interface par rapport au milieu gauche.
LEFT = 24
WIDTH = 150
HEIGHT = 20


def container(kind, properties):
    lines = [f'{kind} {{']
    lines += [f'  {key} = {value}' for key, value in properties.items()]
    lines.append('}')
    return '\n'.join(lines)


def meta(identifier):
    return container('layout-meta', {
        'identifier': identifier,
        'render_custom_elements_behind_vanilla': 'false',
        'last_edited_time': NOW,
        'is_enabled': 'true',
        'randommode': 'false',
        'randomgroup': '1',
        'randomonlyfirsttime': 'false',
        'layout_index': '0',
    })


def common():
    return [
        container('customization', {'action': 'backgroundoptions', 'keepaspectratio': 'true'}),
        container('scroll_list_customization', {
            'preserve_scroll_list_header_footer_aspect_ratio': 'true',
            'render_scroll_list_header_shadow': 'true',
            'render_scroll_list_footer_shadow': 'true',
            'show_scroll_list_header_footer_preview_in_editor': 'false',
            'repeat_scroll_list_header_texture': 'false',
            'repeat_scroll_list_footer_texture': 'false',
            'show_screen_background_overlay_on_custom_background': 'false',
            'apply_vanilla_background_blur': 'false',
        }),
        container('layout_action_executable_blocks', {}),
    ]


def style(primary):
    name = 'btn_primary' if primary else 'btn_secondary'
    return {
        'backgroundnormal': f'{ASSETS}{name}.png',
        'backgroundhovered': f'{ASSETS}{name}_hover.png',
        'label_base_color': '#17121C' if primary else '#F4EFE9',
        'label_hover_color': '#17121C' if primary else '#FFFFFF',
        'label_shadow': 'false',
    }


def place(anchor, x, y, width=WIDTH, height=HEIGHT):
    return {'anchor_point': anchor, 'x': x, 'y': y, 'width': width, 'height': height, 'stay_on_screen': 'true'}


def vanilla(identifier, hidden=False, **properties):
    return container('vanilla_button', {
        'element_type': 'vanilla_button',
        'instance_identifier': identifier,
        'is_hidden': 'true' if hidden else 'false',
        **properties,
    })


def icon_style(name):
    return {'backgroundnormal': f'{ASSETS}btn_{name}.png', 'backgroundhovered': f'{ASSETS}btn_{name}_hover.png'}


def button(identifier, action, value, **properties):
    return container('element', {
        'element_type': 'custom_button',
        'instance_identifier': identifier,
        'button_element_executable_block_identifier': f'{identifier}-block',
        f'[executable_block:{identifier}-block][type:generic]': f'[executables:{identifier}-action;]',
        f'[executable_action_instance:{identifier}-action][action_type:{action}]': value,
        'navigatable': 'true',
        **properties,
    })


def write(name, identifier, parts):
    text = 'type = fancymenu_layout\n\n' + '\n\n'.join([meta(identifier)] + parts) + '\n\n'
    (out / 'customization' / name).write_text(text, encoding='utf-8', newline='\n')


# --- Écran titre
title = [
    container('menu_background', {
        'instance_identifier': 'aegis-title-background',
        'background_type': 'image',
        'show_background': 'true',
        'image_path': f'{ASSETS}background.jpg',
        'slide': 'false',
        'repeat_texture': 'false',
        'parallax': 'false',
    }),
    *common(),
    container('element', {
        'element_type': 'image',
        'instance_identifier': 'aegis-title-logo',
        'source': f'{ASSETS}logo.png',
        **place('mid-left', LEFT, -104, WIDTH, 59),
    }),
    button('aegis-title-join', 'joinserver', SERVER, label='Entrer dans la zone', **style(True), **place('mid-left', LEFT, -34)),
    vanilla('mc_titlescreen_singleplayer_button', **style(False), **place('mid-left', LEFT, -8)),
    # Bouton « Open Skin Editor » du mod Custom Player Models : sans identifiant propre, FancyMenu le nomme
    # d'après sa position d'origine (0, 0).
    vanilla('0', label='Éditeur de skin', **style(False), **place('mid-left', LEFT, 16)),
    vanilla('mc_titlescreen_options_button', **style(False), **place('mid-left', LEFT, 40)),
    vanilla('mc_titlescreen_quit_button', **style(False), **place('mid-left', LEFT, 64)),
    # Langue et accessibilité : les boutons d'origine sont masqués et remplacés par deux boutons à la charte
    # qui en reproduisent le clic.
    button('aegis-title-language', 'mimicbutton', 'title_screen:mc_titlescreen_language_button', label='', **icon_style('lang'), **place('bottom-left', LEFT, -30, 20, 20)),
    button('aegis-title-accessibility', 'mimicbutton', 'title_screen:mc_titlescreen_accessibility_button', label='', **icon_style('access'), **place('bottom-left', LEFT + 24, -30, 20, 20)),
    vanilla('mc_titlescreen_language_button', hidden=True),
    vanilla('mc_titlescreen_accessibility_button', hidden=True),
    vanilla('mc_titlescreen_multiplayer_button', hidden=True),
    vanilla('mc_titlescreen_realms_button', hidden=True),
    vanilla('forge_titlescreen_mods_button', hidden=True),
    vanilla('minecraft_logo_widget', hidden=True),
    vanilla('minecraft_splash_widget', hidden=True),
    vanilla('minecraft_branding_widget', hidden=True),
    vanilla('minecraft_realms_notification_icons_widget', hidden=True),
]
write('aegis_title.txt', 'title_screen', title)

# --- Écrans dont la personnalisation est activée (par nom de classe).
screens = ['net.minecraft.client.gui.screens.TitleScreen']
(out / 'customizablemenus.txt').write_text(
    'type = customizablemenus\n\n' + '\n\n'.join(container(screen, {}) for screen in screens) + '\n\n', encoding='utf-8', newline='\n')
print('mises en page écrites :', ', '.join(sorted(p.name for p in (out / 'customization').iterdir())))
