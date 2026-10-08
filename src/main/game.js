const fs = require('fs')
const path = require('path')
const { Version, launch, createMinecraftProcessWatcher } = require('@xmcl/core')
const {
  getVersionList,
  installTask,
  installForgeTask,
  installDependenciesTask,
  fetchJavaRuntimeManifest,
  installJavaRuntimeTask
} = require('@xmcl/installer')
const paths = require('./paths')

// Trop de téléchargements simultanés provoque des coupures côté serveurs de Mojang.
const download = { assetsDownloadConcurrency: 8, librariesDownloadConcurrency: 8 }
const attempts = 3

// Exécute une tâche d'installation en remontant son avancement (0 à 1), au plus 10 fois par seconde.
// Les fichiers déjà valides sont conservés : un nouvel essai ne reprend que ce qui manque.
async function run(createTask, label, report) {
  for (let attempt = 1; ; attempt++) {
    const task = createTask()
    let last = 0
    let ratio = 0
    report({ label, ratio })
    try {
      return await task.startAndWait({
        onUpdate() {
          const now = Date.now()
          if (now - last < 100) return
          last = now
          // Le total grossit à mesure que les sous-tâches se déclarent : la barre ne doit jamais reculer.
          ratio = Math.max(ratio, task.total > 0 ? task.progress / task.total : 0)
          report({ label, ratio })
        }
      })
    } catch (error) {
      if (attempt === attempts) throw error
    }
  }
}

async function ensureJava(config, report) {
  const destination = path.join(paths.bin, 'runtime', config.javaRuntime)
  const java = path.join(destination, 'bin', process.platform === 'win32' ? 'javaw.exe' : 'java')
  if (!fs.existsSync(java)) {
    const manifest = await fetchJavaRuntimeManifest({ target: config.javaRuntime })
    await run(() => installJavaRuntimeTask({ destination, manifest }), 'Installation de Java', report)
  }
  return java
}

function isInstalled(id) {
  return fs.existsSync(path.join(paths.bin, 'versions', id, `${id}.json`))
}

// Installe ce qui manque et répare les fichiers corrompus. Renvoie de quoi lancer le jeu.
async function prepare(config, report) {
  fs.mkdirSync(paths.game, { recursive: true })
  const java = await ensureJava(config, report)

  if (!isInstalled(config.minecraft)) {
    const list = await getVersionList()
    const meta = list.versions.find((v) => v.id === config.minecraft)
    if (!meta) throw new Error(`Minecraft ${config.minecraft} introuvable.`)
    await run(() => installTask(meta, paths.bin, download), 'Téléchargement de Minecraft', report)
  }

  const forgeId = `${config.minecraft}-forge-${config.forge}`
  if (!isInstalled(forgeId)) {
    await run(
      () => installForgeTask({ mcversion: config.minecraft, version: config.forge }, paths.bin, { java, ...download }),
      'Installation de Forge',
      report
    )
  }

  const version = await Version.parse(paths.bin, forgeId)
  await run(() => installDependenciesTask(version, download), 'Vérification des fichiers', report)
  return { java, version }
}

async function start(config, settings, session, { java, version }) {
  const child = await launch({
    gamePath: paths.game,
    resourcePath: paths.bin,
    javaPath: java,
    version,
    gameProfile: { name: session.name, id: session.id },
    accessToken: session.accessToken,
    userType: 'msa',
    launcherName: 'AegisLauncher',
    minMemory: 1024,
    maxMemory: settings.ram * 1024,
    server: config.server.host ? { ip: config.server.host, port: config.server.port } : undefined,
    extraExecOption: { detached: true }
  })
  return createMinecraftProcessWatcher(child)
}

module.exports = { prepare, start }
