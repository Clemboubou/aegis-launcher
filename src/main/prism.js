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
// Délai avant de réafficher une fenêtre de Prism masquée alors que rien ne semble avancer.
const revealAfter = 90000
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
  fs.mkdirSync(paths.root, { recursive: true })
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
      // -g : packwiz met les mods à jour sans afficher sa fenêtre.
      `PreLaunchCommand="\\"$INST_JAVA\\" -jar packwiz-installer-bootstrap.jar -g ${packUrl}"`,
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

// Prism n'a pas de réglage pour masquer sa fenêtre de progression. Ce script la cache de l'extérieur :
// il lit sur son entrée l'identifiant du processus à surveiller, masque toute fenêtre que ce processus
// affiche, et écrit l'identifiant et le titre de chacune.
const hiderScript = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type @"
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class Win {
  public delegate bool Callback(IntPtr handle, IntPtr data);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback callback, IntPtr data);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint id);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr handle, StringBuilder text, int size);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);
  public static List<IntPtr> Visible(uint target) {
    var found = new List<IntPtr>();
    EnumWindows((handle, data) => { uint id; GetWindowThreadProcessId(handle, out id); if (id == target && IsWindowVisible(handle)) found.Add(handle); return true; }, IntPtr.Zero);
    return found;
  }
  public static string Title(IntPtr handle) { var text = new StringBuilder(256); GetWindowText(handle, text, 256); return text.ToString(); }
}
"@
[Console]::Out.WriteLine('ready')
$target = [uint32][Console]::In.ReadLine()
$hidden = New-Object 'System.Collections.Generic.HashSet[IntPtr]'
while ($true) {
  foreach ($handle in [Win]::Visible($target)) {
    [Win]::ShowWindow($handle, 0) | Out-Null
    if ($hidden.Add($handle)) { [Console]::Out.WriteLine('hidden ' + $handle.ToInt64() + ' ' + [Win]::Title($handle)) }
  }
  Start-Sleep -Milliseconds 80
}
`

const showScript = (handles) => `
Add-Type -Namespace Native -Name Win -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);'
foreach ($handle in ${handles.join(',')}) { [Native.Win]::ShowWindow([IntPtr]$handle, 5) | Out-Null }
`

function powershell(script, stdio) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { windowsHide: true, stdio })
}

// Démarre le script de masquage et attend qu'il soit prêt (la compilation prend environ une seconde).
function createHider(onHidden) {
  const child = powershell(hiderScript, ['pipe', 'pipe', 'ignore'])
  const handles = []
  let resolveReady
  const ready = new Promise((resolve) => (resolveReady = resolve))
  let buffer = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop()
    for (const line of lines) {
      const hidden = /^hidden (\d+) (.*)$/.exec(line)
      if (line === 'ready') resolveReady()
      else if (hidden) {
        handles.push(hidden[1])
        onHidden(hidden[2])
      }
    }
  })
  child.on('error', resolveReady)
  child.on('exit', resolveReady)
  return {
    ready,
    watch: (id) => child.stdin.write(`${id}\n`),
    stop: () => child.kill(),
    // Arrête le masquage et réaffiche les fenêtres déjà masquées.
    reveal() {
      child.kill()
      if (handles.length) powershell(showScript(handles), 'ignore')
    }
  }
}

// Identifiants des processus Java en cours (jeu, packwiz, vérifications de Prism).
async function javaProcesses() {
  const { stdout } = await run('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true })
  const ids = new Set()
  for (const line of stdout.split('\n')) {
    const match = /^"javaw?\.exe","(\d+)"/i.exec(line)
    if (match) ids.add(match[1])
  }
  return ids
}

// Lance le jeu. `onStarted` est appelé quand le jeu écrit son journal, `onExit` quand la partie est finie.
async function play(config, settings, packUrl, report, { onStarted, onExit, onWindow }) {
  await prepare(config, settings, packUrl, report)
  report({ label: 'Préparation du jeu' })
  const before = await javaProcesses()
  let lastHidden = 0
  const hider = createHider((title) => {
    lastHidden = Date.now()
    onWindow?.(title)
  })
  await hider.ready
  const launchedAt = Date.now()
  const log = path.join(instanceDir(config), '.minecraft', 'logs', 'latest.log')
  const child = spawn(exe, ['--launch', config.name], { cwd: prismDir })
  hider.watch(child.pid)
  const ours = new Set()
  let started = false
  let idle = 0
  // Prism reste ouvert sans fenêtre après la fermeture du jeu : la fin de partie est donc détectée
  // par la disparition des processus Java apparus depuis le lancement, puis Prism est fermé.
  const watcher = setInterval(async () => {
    if (!started && fs.existsSync(log) && fs.statSync(log).mtimeMs >= launchedAt) {
      started = true
      // Le jeu tourne : une fenêtre que Prism ouvrirait maintenant (rapport de plantage) doit rester visible.
      hider.stop()
      onStarted()
    }
    const running = await javaProcesses().catch(() => null)
    if (!running) return
    for (const id of running) if (!before.has(id)) ours.add(id)
    const alive = [...ours].some((id) => running.has(id))
    // Une fenêtre masquée depuis longtemps sans que rien ne tourne est sans doute un message d'erreur
    // ou un long téléchargement : dans les deux cas, mieux vaut la montrer.
    if (!started && !alive && lastHidden && Date.now() - lastHidden > revealAfter) {
      hider.reveal()
      lastHidden = 0
    }
    idle = started && !alive ? idle + 1 : 0
    if (idle >= 2) child.kill()
  }, 2500)
  child.on('exit', () => {
    clearInterval(watcher)
    hider.stop()
    onExit()
  })
}

module.exports = { account, login, logout, play, prepare, createHider }
