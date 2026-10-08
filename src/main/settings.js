const fs = require('fs')
const os = require('os')
const path = require('path')
const paths = require('./paths')

const totalRam = Math.floor(os.totalmem() / 1024 / 1024 / 1024)
const ramMin = 2
// Laisse 2 Go au système, plafonne à 16 Go (au-delà, le ramasse-miettes de Java dégrade les performances).
const ramMax = Math.max(ramMin, Math.min(16, totalRam - 2))

const defaults = { ram: Math.min(6, ramMax) }

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
