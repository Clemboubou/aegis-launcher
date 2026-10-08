const $ = (id) => document.getElementById(id)

let account = null
let phase = 'idle'

function render() {
  $('account').hidden = !account
  if (account) {
    $('pseudo').textContent = account.name
    $('avatar').src = `https://mc-heads.net/avatar/${account.id}/72`
  }
  const idle = phase === 'idle'
  $('primary').disabled = !idle
  $('primary').textContent = phase === 'running' ? 'En jeu' : account ? 'Jouer' : 'Se connecter'
  $('logout').disabled = !idle
  $('progress').hidden = phase !== 'preparing'
}

function setStatus(text, isError = false) {
  $('status').textContent = text || ''
  $('status').classList.toggle('error', isError)
}

async function onPrimary() {
  setStatus('')
  if (account) return aegis.play()
  $('primary').disabled = true
  const result = await aegis.login()
  account = result.account
  if (result.error) setStatus(result.error, true)
  render()
}

function toggleSettings(open) {
  $('sheet').hidden = !open
  $('scrim').hidden = !open
}

async function init() {
  const state = await aegis.state()
  account = state.account

  document.title = `${state.name} Launcher`
  $('name').textContent = state.name
  $('tagline').textContent = `${state.tagline} · Minecraft ${state.minecraft}`
  $('about').textContent = `Launcher ${state.version} · Forge ${state.forge}. Non affilié à Mojang ni à Microsoft.`

  const ram = $('ram')
  ram.min = state.ram.min
  ram.max = state.ram.max
  ram.value = state.settings.ram
  const showRam = () => ($('ram-value').textContent = `${ram.value} Go`)
  showRam()
  ram.addEventListener('input', showRam)
  ram.addEventListener('change', () => aegis.saveSettings({ ram: Number(ram.value) }))

  $('primary').addEventListener('click', onPrimary)
  $('logout').addEventListener('click', async () => {
    await aegis.logout()
    account = null
    setStatus('')
    render()
  })
  $('open-settings').addEventListener('click', () => toggleSettings(true))
  $('close-settings').addEventListener('click', () => toggleSettings(false))
  $('scrim').addEventListener('click', () => toggleSettings(false))
  $('open-game').addEventListener('click', () => aegis.open('game'))
  $('avatar').addEventListener('error', () => $('avatar').removeAttribute('src'))
  document.addEventListener('keydown', (event) => event.key === 'Escape' && toggleSettings(false))
  for (const button of document.querySelectorAll('[data-window]')) {
    button.addEventListener('click', () => aegis.window(button.dataset.window))
  }

  aegis.onProgress(({ label, ratio }) => {
    const percent = Math.round(ratio * 100)
    $('progress-fill').style.width = `${percent}%`
    setStatus(`${label} · ${percent} %`)
  })
  aegis.onStatus((status) => {
    phase = status.phase
    setStatus(status.error, Boolean(status.error))
    render()
  })

  render()
}

init()
