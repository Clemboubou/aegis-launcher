const path = require('path')
const { app } = require('electron')

// Même découpage que les launchers de serveur classiques :
//   bin/   fichiers gérés par le launcher (Java, Minecraft, Forge, bibliothèques, assets)
//   game/  dossier du joueur (mods, config, saves, screenshots)
const root = process.env.AEGIS_ROOT || path.join(app.getPath('appData'), '.aegis')

module.exports = {
  root,
  bin: path.join(root, 'bin'),
  game: path.join(root, 'game'),
  settings: path.join(root, 'launcher_config.json'),
  account: path.join(root, 'account.bin')
}
