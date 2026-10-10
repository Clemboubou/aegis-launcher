// Décide si packwiz doit vérifier le pack avant le lancement. Lancer packwiz coûte plusieurs secondes
// (deux démarrages de Java et des requêtes réseau) : c'est inutile quand le pack publié est celui déjà
// installé et qu'aucun de ses fichiers n'a disparu.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { fileURLToPath } = require('url')

async function readPack(packUrl) {
  const url = new URL(packUrl)
  if (url.protocol === 'file:') return fs.readFileSync(fileURLToPath(url))
  const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
  if (!response.ok) throw new Error(`pack : HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function needsSync(packUrl, game) {
  // packwiz.json est l'état que packwiz enregistre après chaque installation réussie.
  let state
  try {
    state = JSON.parse(fs.readFileSync(path.join(game, 'packwiz.json'), 'utf8'))
  } catch {
    return true
  }
  const files = Object.values(state.cachedFiles || {})
  if (files.some((file) => file.cachedLocation && !fs.existsSync(path.join(game, file.cachedLocation)))) return true
  let pack
  try {
    pack = await readPack(packUrl)
  } catch {
    // Hors ligne ou GitHub injoignable : on joue avec le pack déjà installé.
    return false
  }
  return crypto.createHash('sha256').update(pack).digest('hex') !== state.packFileHash?.value
}

module.exports = { needsSync }
