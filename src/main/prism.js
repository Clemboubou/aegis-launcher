// Moteur « Prism » : Aegis garde son interface, Prism Launcher fait la connexion Microsoft,
// installe le jeu et le lance. packwiz met les mods à jour avant chaque lancement.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn, execFile } = require('child_process')
const { promisify } = require('util')
const { pipeline } = require('stream/promises')
const { Readable, Transform } = require('stream')
const paths = require('./paths')

const run = promisify(execFile)
const resources = path.join(__dirname, '../../resources')

const prismDir = path.join(paths.root, 'prism')
const exe = path.join(prismDir, 'prismlauncher.exe')
const accounts = path.join(prismDir, 'accounts.json')

function instanceDir(config) {
  return path.join(prismDir, 'instances', config.name)
}

async function download(config, report) {
  const label = 'Téléchargement de Prism Launcher'
  report({ label, ratio: 0 })
  const response = await fetch(config.prism.url)
  if (!response.ok) throw new Error(`Prism Launcher : HTTP ${response.status}`)
  const total = Number(response.headers.get('content-length')) || 0
  const hash = crypto.createHash('sha256')
  let received = 0
  const meter = new Transform({
    transform(chunk, _encoding, done) {
      hash.update(chunk)
      received += chunk.length
      if (total) report({ label, ratio: received / total })
      done(null, chunk)
    }
  })
  const zip = path.join(paths.root, 'prism.zip')
  await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(zip))
  if (hash.digest('hex').toUpperCase() !== config.prism.sha256.toUpperCase()) {
    fs.rmSync(zip)
    throw new Error('Prism Launcher : empreinte inattendue')
  }
  fs.mkdirSync(prismDir, { recursive: true })
  // tar est fourni avec Windows 10 et 11 et sait extraire les zip.
  await run('tar', ['-xf', zip, '-C', prismDir])
  fs.rmSync(zip)
}

// Réglages de Prism posés une seule fois : il n'affiche alors au premier démarrage que la page de connexion.
function writeLauncherSettings() {
  const file = path.join(prismDir, 'prismlauncher.cfg')
  if (fs.existsSync(file)) return
  fs.writeFileSync(
    file,
    [
      '[General]',
      'Language=fr',
      'AutomaticJavaDownload=true',
      'AutomaticJavaSwitch=true',
      'UserAskedAboutAutomaticJavaDownload=true',
      'IgnoreJavaWizard=true',
      'CloseAfterLaunch=true',
      'QuitAfterGameStop=true',
      'ShowConsole=false',
      ''
    ].join('\n')
  )
}

// La définition de l'instance est réécrite à chaque fois ; le dossier du joueur (.minecraft) n'est jamais touché.
function writeInstance(config, settings, packUrl) {
  const instance = instanceDir(config)
  const game = path.join(instance, '.minecraft')
  fs.mkdirSync(game, { recursive: true })
  fs.mkdirSync(path.join(prismDir, 'icons'), { recursive: true })
  fs.copyFileSync(path.join(resources, 'aegis.png'), path.join(prismDir, 'icons', 'aegis.png'))
  fs.copyFileSync(path.join(resources, 'packwiz-installer-bootstrap.jar'), path.join(game, 'packwiz-installer-bootstrap.jar'))
  fs.writeFileSync(
    path.join(instance, 'mmc-pack.json'),
    JSON.stringify({
      components: [
        { uid: 'net.minecraft', version: config.minecraft, important: true },
        { uid: 'net.minecraftforge', version: config.forge }
      ],
      formatVersion: 1
    })
  )
  const join = Boolean(config.server.host)
  fs.writeFileSync(
    path.join(instance, 'instance.cfg'),
    [
      '[General]',
      'ConfigVersion=1.2',
      'InstanceType=OneSix',
      `name=${config.name}`,
      'iconKey=aegis',
      'OverrideCommands=true',
      `PreLaunchCommand="\\"$INST_JAVA\\" -jar packwiz-installer-bootstrap.jar ${packUrl}"`,
      'OverrideMemory=true',
      'MinMemAlloc=1024',
      `MaxMemAlloc=${settings.ram * 1024}`,
      `JoinServerOnLaunch=${join}`,
      `JoinServerOnLaunchAddress=${join ? `${config.server.host}:${config.server.port}` : ''}`,
      ''
    ].join('\n')
  )
}

async function prepare(config, settings, packUrl, report) {
  if (!fs.existsSync(exe)) await download(config, report)
  writeLauncherSettings()
  writeInstance(config, settings, packUrl)
}

// Seuls le pseudo et l'identifiant du profil sont lus ; les jetons restent dans le fichier de Prism.
function account() {
  try {
    const list = JSON.parse(fs.readFileSync(accounts, 'utf8')).accounts || []
    const entry = list.find((item) => item.active && item.profile) || list.find((item) => item.profile)
    return entry ? { name: entry.profile.name, id: entry.profile.id } : null
  } catch {
    return null
  }
}

function logout() {
  fs.rmSync(accounts, { force: true })
}

// Ouvre Prism sur sa page de connexion et le referme dès que le compte est enregistré.
async function login(config, settings, packUrl, report) {
  await prepare(config, settings, packUrl, report)
  report({ label: 'Connectez-vous dans la fenêtre Prism Launcher' })
  const child = spawn(exe, [], { cwd: prismDir })
  return new Promise((resolve) => {
    const watcher = setInterval(() => {
      if (!account()) return
      clearInterval(watcher)
      // Laisse à Prism le temps de finir d'écrire le compte avant de le fermer.
      setTimeout(() => child.kill(), 2500)
    }, 1000)
    child.on('exit', () => {
      clearInterval(watcher)
      resolve({ account: account() })
    })
  })
}

// Lance le jeu. `onStarted` est appelé quand le jeu écrit son journal, `onExit` quand Prism se ferme.
async function play(config, settings, packUrl, report, { onStarted, onExit }) {
  await prepare(config, settings, packUrl, report)
  report({ label: 'Préparation du jeu' })
  const launchedAt = Date.now()
  const log = path.join(instanceDir(config), '.minecraft', 'logs', 'latest.log')
  const child = spawn(exe, ['--launch', config.name], { cwd: prismDir })
  const watcher = setInterval(() => {
    if (!fs.existsSync(log) || fs.statSync(log).mtimeMs < launchedAt) return
    clearInterval(watcher)
    onStarted()
  }, 2000)
  child.on('exit', () => {
    clearInterval(watcher)
    onExit()
  })
}

module.exports = { account, login, logout, play, prepare }
