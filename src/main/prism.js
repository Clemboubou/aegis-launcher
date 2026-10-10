// Moteur « Prism » : Aegis garde son interface, Prism Launcher fait la connexion Microsoft,
// installe le jeu et le lance. packwiz met les mods à jour avant chaque lancement.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn, execFile } = require('child_process')
const { promisify } = require('util')
const { pipeline } = require('stream/promises')
const { Readable, Transform } = require('stream')
const os = require('os')
const paths = require('./paths')
const manual = require('./manual')
const pack = require('./pack')

const run = promisify(execFile)
// Délai avant de réafficher une fenêtre de Prism masquée alors que rien ne semble avancer.
const revealAfter = Number(process.env.AEGIS_REVEAL_MS) || 90000
// Durée sans aucune activité de Prism au-delà de laquelle le lancement est considéré comme bloqué.
const stallAfter = Number(process.env.AEGIS_STALL_MS) || 120000
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

// Réglages de Prism nécessaires pour que son assistant de premier démarrage ne montre que la page de
// connexion. Sans thème ni icônes déjà choisis, il ajoute une page « Apparence » qui bloque le lancement.
const launcherSettings = {
  Language: 'fr',
  ApplicationTheme: 'dark',
  IconTheme: 'pe_colored',
  AutomaticJavaDownload: 'true',
  AutomaticJavaSwitch: 'true',
  UserAskedAboutAutomaticJavaDownload: 'true',
  IgnoreJavaWizard: 'true',
  CloseAfterLaunch: 'true',
  QuitAfterGameStop: 'true',
  ShowConsole: 'false',
  // Sans cela, Prism bloque le lancement par une question quand la mémoire allouée lui paraît élevée.
  LowMemWarning: 'false'
}

// Ajoute les réglages manquants sans toucher à ceux que Prism ou le joueur ont déjà enregistrés.
function writeLauncherSettings() {
  const file = path.join(prismDir, 'prismlauncher.cfg')
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : []
  if (!lines.includes('[General]')) lines.unshift('[General]')
  const missing = Object.entries(launcherSettings)
    .filter(([key]) => !lines.some((line) => line.startsWith(`${key}=`)))
    .map(([key, value]) => `${key}=${value}`)
  if (!missing.length) return
  lines.splice(lines.indexOf('[General]') + 1, 0, ...missing)
  fs.writeFileSync(file, lines.join('\n'))
}

// La définition de l'instance est réécrite à chaque fois ; le dossier du joueur (.minecraft) n'est jamais touché.
// `sync` : faire vérifier le pack par packwiz avant le lancement (inutile quand il n'a pas changé).
function writeInstance(config, settings, packUrl, sync = true) {
  const instance = instanceDir(config)
  const game = path.join(instance, '.minecraft')
  fs.mkdirSync(game, { recursive: true })
  fs.mkdirSync(path.join(prismDir, 'icons'), { recursive: true })
  fs.copyFileSync(path.join(resources, 'aegis.png'), path.join(prismDir, 'icons', 'aegis.png'))
  // L'installateur de mods est fourni avec le launcher : sans cela, son amorce le télécharge par l'API
  // de GitHub, qui refuse les adresses IP ayant dépassé leur quota, et le premier lancement échoue.
  for (const jar of ['packwiz-installer-bootstrap.jar', 'packwiz-installer.jar']) {
    fs.copyFileSync(path.join(resources, jar), path.join(game, jar))
  }
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
  const jvmArgs = settings.jvmArgs ?? config.jvmArgs ?? ''
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
      // --bootstrap-no-update : l'amorce utilise l'installateur fourni au lieu d'interroger GitHub.
      `PreLaunchCommand=${sync ? `"\\"$INST_JAVA\\" -jar packwiz-installer-bootstrap.jar --bootstrap-no-update -g ${packUrl}"` : ''}`,
      'OverrideMemory=true',
      // Mémoire de départ à la moitié du maximum : le jeu n'a pas à agrandir son tas pendant le chargement.
      `MinMemAlloc=${(settings.minRam ?? Math.max(2, Math.round(settings.ram / 2))) * 1024}`,
      `MaxMemAlloc=${settings.ram * 1024}`,
      `OverrideJavaArgs=${Boolean(jvmArgs)}`,
      // Entre guillemets : sans eux, le format de Prism découpe la valeur à chaque virgule.
      `JvmArgs="${jvmArgs.replace(/"/g, '\\"')}"`,
      `JoinServerOnLaunch=${join}`,
      `JoinServerOnLaunchAddress=${join ? `${config.server.host}:${config.server.port}` : ''}`,
      ''
    ].join('\n')
  )
}

// Région par défaut des langues dont le code de Windows n'en précise pas.
const regions = { fr: 'fr', en: 'us', de: 'de', es: 'es', it: 'it', pt: 'pt', nl: 'nl', pl: 'pl', ru: 'ru', tr: 'tr', ja: 'jp', ko: 'kr', zh: 'cn', sv: 'se', da: 'dk', cs: 'cz', el: 'gr', uk: 'ua', fi: 'fi', hu: 'hu', ro: 'ro' }

// Au tout premier lancement, le jeu démarre dans la langue de Windows au lieu de l'anglais. Le choix
// du joueur n'est jamais écrasé ensuite : le fichier n'est écrit que s'il n'existe pas encore.
// Changer de langue en jeu force un rechargement complet (le mod Axiom l'impose) : autant l'éviter.
function writeDefaultOptions(config, locale) {
  const file = path.join(instanceDir(config), '.minecraft', 'options.txt')
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return
  const [language, region] = String(locale || 'en-US').toLowerCase().split(/[-_]/)
  const code = /^[a-z]{2}$/.test(region || '') ? region : regions[language]
  // Minecraft retombe sur l'anglais si le code lui est inconnu.
  fs.writeFileSync(file, `lang:${code ? `${language}_${code}` : 'en_us'}\n`)
}

async function prepare(config, settings, packUrl, report, sync = true) {
  if (!fs.existsSync(exe)) await download(config, report)
  writeLauncherSettings()
  writeInstance(config, settings, packUrl, sync)
  writeDefaultOptions(config, settings.locale)
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
  const child = spawn(exe, [], { cwd: prismDir, stdio: 'ignore' })
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
// il lit sur son entrée l'identifiant du processus à surveiller, masque ses fenêtres de progression
// (« Veuillez patienter », ou sans titre) et écrit l'identifiant et le titre de chacune.
// Toute autre fenêtre (message d'erreur, assistant, reconnexion) reste visible : le joueur doit y répondre.
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
$flag = [Console]::In.ReadLine()
$hidden = New-Object 'System.Collections.Generic.HashSet[IntPtr]'
$dialogs = -1
function IsProgress($title) { return ($title -eq '') -or ($title -like 'Please wait*') -or ($title -like 'Veuillez patienter*') }
while ($true) {
  $reveal = Test-Path -LiteralPath $flag
  $count = 0
  foreach ($handle in [Win]::Visible($target)) {
    $title = [Win]::Title($handle)
    if (-not (IsProgress $title)) { $count++ }
    elseif (-not $reveal) {
      [Win]::ShowWindow($handle, 0) | Out-Null
      if ($hidden.Add($handle)) { [Console]::Out.WriteLine('hidden ' + $title) }
    }
  }
  # Sont réaffichées : toutes les fenêtres masquées quand le launcher le demande, et sinon celles qui ont
  # été masquées avant d'avoir reçu leur titre et ne sont pas des fenêtres de progression.
  foreach ($handle in @($hidden)) {
    if ($reveal -or -not (IsProgress ([Win]::Title($handle)))) {
      [Win]::ShowWindow($handle, 5) | Out-Null
      $hidden.Remove($handle) | Out-Null
    }
  }
  # Nombre de fenêtres auxquelles le joueur doit répondre (erreur, assistant, reconnexion).
  if ($count -ne $dialogs) { $dialogs = $count; [Console]::Out.WriteLine('dialogs ' + $count) }
  Start-Sleep -Milliseconds 80
}
`

// Démarre le script de masquage ; `ready` se résout quand il est prêt (la compilation prend environ une seconde).
// `onDialogs` reçoit le nombre de fenêtres de Prism qui attendent une réponse du joueur.
function createHider(onHidden, onDialogs = () => {}) {
  const encoded = Buffer.from(hiderScript, 'utf16le').toString('base64')
  const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore']
  })
  // Le script lit ses ordres une seule fois : la demande de réaffichage passe par l'apparition de ce fichier.
  const flag = path.join(os.tmpdir(), `aegis-reveal-${process.pid}-${Date.now()}`)
  let resolveReady
  const ready = new Promise((resolve) => (resolveReady = resolve))
  let buffer = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop()
    for (const line of lines) {
      if (line === 'ready') resolveReady()
      else if (line.startsWith('hidden ')) onHidden(line.slice(7))
      else if (line.startsWith('dialogs ')) onDialogs(Number(line.slice(8)))
    }
  })
  child.on('error', resolveReady)
  child.on('exit', resolveReady)
  // Si le script n'a pas pu démarrer, le jeu se lance quand même : les fenêtres de Prism restent visibles.
  child.stdin.on('error', () => {})
  return {
    ready,
    watch: (id) => child.stdin.writable && child.stdin.write(`${id}\n${flag}\n`),
    // Cesse de masquer et réaffiche ce qui l'était ; le script continue de compter les fenêtres.
    reveal: () => fs.writeFileSync(flag, ''),
    stop() {
      child.kill()
      fs.rmSync(flag, { force: true })
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

// Temps processeur consommé par un processus, tel que l'affiche tasklist (« 0:00:23 »).
async function processorTime(id) {
  const { stdout } = await run('tasklist', ['/V', '/FI', `PID eq ${id}`, '/FO', 'CSV', '/NH'], { windowsHide: true })
  return stdout.split('","')[7] || ''
}

// Lance le jeu. `onStarted` est appelé quand le jeu écrit son journal, `onExit` quand la partie est finie
// ou que le lancement a échoué (`failed`).
async function play(config, settings, packUrl, report, { onStarted, onExit, onWindow, open, downloads }) {
  const game = path.join(instanceDir(config), '.minecraft')
  report({ label: 'Préparation du jeu' })
  let lastHidden = 0
  let dialogs = 0
  // Le script de masquage démarre dès le clic : il est prêt quand Prism s'ouvre, sans retarder le lancement.
  const hider = createHider(
    (title) => {
      lastHidden = Date.now()
      onWindow?.(title)
    },
    (count) => (dialogs = count)
  )
  let before
  try {
    // packwiz ne vérifie le pack que si c'est nécessaire ; `settings.sync` permet de l'imposer (tests).
    const sync = settings.sync ?? (await pack.needsSync(packUrl, game))
    await prepare(config, settings, packUrl, report, sync)
    await manual.ensure({
      packUrl,
      game,
      stateFile: path.join(paths.root, 'manual-mods.json'),
      downloads: downloads || path.join(os.homedir(), 'Downloads'),
      open: open || (async () => {}),
      report
    })
    report({ label: 'Préparation du jeu' })
    before = await javaProcesses()
  } catch (error) {
    hider.stop()
    throw error
  }
  const launchedAt = Date.now()
  const log = path.join(game, 'logs', 'latest.log')
  // Sortie ignorée : Prism y écrit son journal, et se figerait une fois le tuyau plein si personne ne le lisait.
  const child = spawn(exe, ['--launch', config.name], { cwd: prismDir, stdio: 'ignore' })
  hider.ready.then(() => hider.watch(child.pid))
  const ours = new Set()
  let started = false
  let failed = false
  let exited = false
  let idleSince = 0
  let cpu = ''
  let cpuAt = 0
  let activity = ''
  let activeAt = Date.now()
  let timer = null
  // Prism reste ouvert sans fenêtre après la fermeture du jeu : la fin de partie est donc détectée
  // par la disparition des processus Java apparus depuis le lancement, puis Prism est fermé.
  const check = async () => {
    if (!started && fs.existsSync(log) && fs.statSync(log).mtimeMs >= launchedAt) {
      started = true
      // Le jeu tourne : une fenêtre que Prism ouvrirait maintenant (rapport de plantage) doit rester visible.
      hider.reveal()
      onStarted()
    }
    const running = await javaProcesses().catch(() => null)
    if (running) {
      for (const id of running) if (!before.has(id)) ours.add(id)
      const alive = [...ours].some((id) => running.has(id))
      // Une fenêtre masquée depuis longtemps sans que rien ne tourne est sans doute un long téléchargement :
      // mieux vaut la montrer.
      if (!started && !alive && lastHidden && Date.now() - lastHidden > revealAfter) {
        hider.reveal()
        lastHidden = 0
      }
      if (!started || alive) idleSince = 0
      else idleSince ||= Date.now()
      if (idleSince && Date.now() - idleSince >= 4000) child.kill()

      // Lancement bloqué : le jeu n'a pas démarré, aucune fenêtre n'attend le joueur, et ni Prism ni Java
      // ne travaillent (leur temps processeur ne bouge pas). Sans cette vérification, le launcher resterait
      // figé ; le joueur voit une erreur et peut recliquer sur Jouer.
      if (!started && Date.now() - cpuAt >= 10000) {
        cpuAt = Date.now()
        const ids = [child.pid, ...[...ours].filter((id) => running.has(id))]
        cpu = (await Promise.all(ids.map((id) => processorTime(id).catch(() => '')))).join('|')
      }
      const now = `${alive}|${dialogs}|${cpu}`
      if (now !== activity) {
        activity = now
        activeAt = Date.now()
      }
      if (!started && dialogs === 0 && Date.now() - activeAt > stallAfter) {
        failed = true
        // Un Java lancé par Prism et resté en attente ne se fermerait pas tout seul.
        for (const id of ours) execFile('taskkill', ['/F', '/PID', id], { windowsHide: true }, () => {})
        child.kill()
      }
    }
    // Vérification rapprochée tant que le jeu n'a pas démarré, pour masquer le launcher sans délai.
    if (!exited) timer = setTimeout(check, started ? 2500 : 500)
  }
  timer = setTimeout(check, 500)
  child.on('exit', () => {
    exited = true
    clearTimeout(timer)
    hider.stop()
    onExit({ failed })
  })
}

module.exports = { account, login, logout, play, prepare, createHider }
