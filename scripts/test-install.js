// Test hors Electron de l'installation : node scripts/test-install.js
// Installe dans %APPDATA%\.aegis (ou AEGIS_ROOT) et affiche la commande de lancement générée.
const path = require('path')
process.env.AEGIS_ROOT ||= path.join(process.env.APPDATA, '.aegis')

const { generateArguments } = require('@xmcl/core')
const config = require('../launcher.config.json')
const paths = require('../src/main/paths')
const { prepare } = require('../src/main/game')

let lastLabel = ''
let lastPercent = -1
prepare(config, ({ label, ratio }) => {
  const percent = Math.floor(ratio * 10) * 10
  if (label === lastLabel && percent === lastPercent) return
  lastLabel = label
  lastPercent = percent
  console.log(`${label} ${percent}%`)
})
  .then(async ({ java, version }) => {
    const args = await generateArguments({
      gamePath: paths.game,
      resourcePath: paths.bin,
      javaPath: java,
      version,
      gameProfile: { name: 'Test', id: '0'.repeat(32) },
      accessToken: 'test'
    })
    console.log('OK', version.id, '| main class', version.mainClass, '| args', args.length)
    console.log('java', java)
  })
  .catch((error) => {
    console.error('ECHEC', String(error?.message || error).slice(0, 500))
    process.exit(1)
  })
