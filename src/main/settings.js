const fs = require('fs')
const os = require('os')
const path = require('path')
const config = require('../../launcher.config.json')
const paths = require('./paths')

const totalRam = Math.floor(os.totalmem() / 1024 / 1024 / 1024)
// Laisse 2 Go au système, plafonne à 16 Go (au-delà, le ramasse-miettes de Java dégrade les performances).
const ramMax = Math.max(2, Math.min(16, totalRam - 2))
// Le pack fixe un minimum en dessous duquel le jeu risque de manquer de mémoire.
// Sur un PC qui n'a pas cette mémoire, le minimum retombe au maximum possible.
const ramMin = Math.min(config.memory.min, ramMax)

const defaults = { ram: Math.min(Math.max(config.memory.default, ramMin), ramMax) }

function read() {
  try {
    const saved = JSON.parse(fs.readFileSync(paths.settings, 'utf8'))
    const ram = Math.min(ramMax, Math.max(ramMin, Math.round(Number(saved.ram)) || defaults.ram))
    return { ram }
  } catch {
    return { ...defaults }
  }
}

function write(patch) {
  const next = { ...read(), ...patch }
  fs.mkdirSync(path.dirname(paths.settings), { recursive: true })
  fs.writeFileSync(paths.settings, JSON.stringify(next, null, 2))
  return read()
}

module.exports = { read, write, ramMin, ramMax }
