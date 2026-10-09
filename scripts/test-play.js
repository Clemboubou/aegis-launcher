// Test réel du lancement par le moteur Prism, hors interface : node scripts/test-play.js
// Lance le jeu avec le compte déjà connecté, le ferme dix secondes après son démarrage,
// et affiche les fenêtres de Prism masquées ainsi que les durées.
const path = require('path')
const { execFile } = require('child_process')
const { pathToFileURL } = require('url')
process.env.AEGIS_ROOT ||= path.join(process.env.APPDATA, '.aegis')

const config = require('../launcher.config.json')
const prism = require('../src/main/prism')

const start = Date.now()
const elapsed = () => `${((Date.now() - start) / 1000).toFixed(1)} s`
const packUrl = pathToFileURL(path.join(__dirname, '../pack/pack.toml')).href

prism.play(config, { ram: 6 }, packUrl, (progress) => console.log(elapsed(), progress.label), {
  onWindow: (title) => console.log(elapsed(), `fenêtre Prism masquée : « ${title} »`),
  onStarted() {
    console.log(elapsed(), 'jeu démarré')
    setTimeout(() => {
      console.log(elapsed(), 'fermeture du jeu')
      execFile('taskkill', ['/F', '/FI', 'WINDOWTITLE eq Minecraft*'], () => {})
    }, 10000)
  },
  onExit() {
    console.log(elapsed(), 'fin de partie détectée')
    process.exit(0)
  }
})
