const fs = require('fs')
const path = require('path')
const { safeStorage } = require('electron')
const { Auth } = require('msmc')
const paths = require('./paths')

let minecraft = null

function profile() {
  return minecraft ? { name: minecraft.profile.name, id: minecraft.profile.id } : null
}

// Le jeton de rafraîchissement est chiffré par Windows (DPAPI) avant d'être écrit sur le disque.
function saveToken(token) {
  if (!safeStorage.isEncryptionAvailable()) return
  fs.mkdirSync(path.dirname(paths.account), { recursive: true })
  fs.writeFileSync(paths.account, safeStorage.encryptString(token))
}

function loadToken() {
  try {
    return safeStorage.decryptString(fs.readFileSync(paths.account))
  } catch {
    return null
  }
}

function message(error) {
  const code = typeof error === 'string' ? error : error?.ts || error?.message || ''
  if (code.includes('gui.closed')) return null
  if (code.includes('xsts.child')) return 'Compte enfant : un adulte doit l’ajouter à une famille Microsoft.'
  if (code.includes('xsts.userNotFound')) return 'Ce compte Microsoft n’a pas de profil Xbox.'
  if (code.includes('minecraft.profile') || code.includes('entitlements')) return 'Ce compte ne possède pas Minecraft.'
  return 'Connexion impossible. Réessayez.'
}

async function open(xbox) {
  const mc = await xbox.getMinecraft()
  if (!mc.profile || mc.isDemo()) throw new Error('error.auth.minecraft.profile')
  minecraft = mc
  saveToken(xbox.save())
  return profile()
}

async function login() {
  try {
    const xbox = await new Auth('select_account').launch('electron', { width: 500, height: 650 })
    return { account: await open(xbox) }
  } catch (error) {
    return { account: null, error: message(error) }
  }
}

// Reconnexion silencieuse au démarrage.
async function restore() {
  const token = loadToken()
  if (!token) return null
  try {
    return await open(await new Auth('none').refresh(token))
  } catch {
    return null
  }
}

function logout() {
  minecraft = null
  fs.rmSync(paths.account, { force: true })
}

// Jeton d'accès valide pour le lancement (rafraîchi s'il a expiré).
async function session() {
  if (!minecraft) return null
  if (!minecraft.validate()) await minecraft.refresh(true)
  return { ...profile(), accessToken: minecraft.mcToken }
}

module.exports = { login, restore, logout, session, profile }
