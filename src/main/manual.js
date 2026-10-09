// Mods à téléchargement manuel : certains auteurs interdisent sur CurseForge le téléchargement par des
// outils tiers. Le launcher ne les télécharge donc pas lui-même : il ouvre leur page officielle dans le
// navigateur, attend que le joueur les ait téléchargés, puis les range dans le dossier du jeu.
// La liste est publiée à côté du pack, dans manual.json.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { fileURLToPath } = require('url')

const waitLimit = 10 * 60 * 1000

async function readList(packUrl) {
  const url = new URL('manual.json', packUrl)
  try {
    if (url.protocol === 'file:') return JSON.parse(fs.readFileSync(fileURLToPath(url), 'utf8'))
    const response = await fetch(url)
    return response.ok ? await response.json() : []
  } catch {
    // Sans liste lisible, le jeu se lance quand même : au pire, le serveur refusera la connexion.
    return []
  }
}

function sha1(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')
}

function isValid(file, entry) {
  try {
    return fs.statSync(file).size === entry.size && sha1(file) === entry.sha1
  } catch {
    return false
  }
}

// Cherche dans le dossier Téléchargements un fichier identique à celui attendu, quel que soit son nom
// (le navigateur ajoute « (1) » aux doublons).
function findDownloaded(downloads, entry) {
  let names = []
  try {
    names = fs.readdirSync(downloads)
  } catch {}
  for (const name of names) {
    const file = path.join(downloads, name)
    if (name.toLowerCase().endsWith('.jar') && isValid(file, entry)) return file
  }
  return null
}

// Retire les fichiers que le launcher avait rangés et qui ne sont plus dans la liste.
function removeObsolete(game, stateFile, list) {
  let previous = []
  try {
    previous = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  } catch {}
  const current = list.map((entry) => path.join(entry.folder, entry.filename))
  for (const relative of previous) {
    if (!current.includes(relative)) fs.rmSync(path.join(game, relative), { force: true })
  }
  fs.writeFileSync(stateFile, JSON.stringify(current))
}

// Vérifie que chaque mod de la liste est présent ; sinon guide le joueur jusqu'à ce qu'il le soit.
async function ensure({ packUrl, game, stateFile, downloads, open, report }) {
  const list = await readList(packUrl)
  fs.mkdirSync(game, { recursive: true })
  removeObsolete(game, stateFile, list)

  const target = (entry) => path.join(game, entry.folder, entry.filename)
  let missing = list.filter((entry) => !isValid(target(entry), entry))
  if (!missing.length) return

  const total = missing.length
  const deadline = Date.now() + waitLimit
  let opened = false
  while (missing.length) {
    for (const entry of missing) {
      const found = findDownloaded(downloads, entry)
      if (!found) continue
      fs.mkdirSync(path.dirname(target(entry)), { recursive: true })
      fs.copyFileSync(found, target(entry))
    }
    missing = missing.filter((entry) => !isValid(target(entry), entry))
    if (!missing.length) break
    // Les pages ne sont ouvertes qu'après un premier passage : un fichier déjà téléchargé suffit.
    if (!opened) {
      opened = true
      for (const entry of missing) await open(entry.url)
    }
    const names = missing.map((entry) => entry.name).join(', ')
    report({ label: `Téléchargez dans votre navigateur : ${names} (${total - missing.length}/${total})` })
    if (Date.now() > deadline) throw new Error('manual-download-timeout')
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
}

module.exports = { ensure }
