// Capture la fenêtre du launcher sans l'afficher : node scripts/screenshot.js <sortie.png> [expression JS à évaluer avant]
// Le launcher doit tourner avec AEGIS_HIDDEN=1 et --remote-debugging-port=9334.
const fs = require('fs')

const [output, expression] = process.argv.slice(2)

async function main() {
  const targets = await (await fetch('http://127.0.0.1:9334/json')).json()
  const page = targets.find((target) => target.type === 'page')
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => (socket.onopen = resolve))

  let id = 0
  const pending = new Map()
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    pending.get(message.id)?.(message.result)
  }
  const call = (method, params = {}) =>
    new Promise((resolve) => {
      pending.set(++id, resolve)
      socket.send(JSON.stringify({ id, method, params }))
    })

  if (expression) {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    console.log(JSON.stringify(result.result?.value ?? result.exceptionDetails?.text))
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  const { data } = await call('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(output, Buffer.from(data, 'base64'))
  socket.close()
}

setTimeout(() => {
  console.error('Délai dépassé')
  process.exit(1)
}, 15000).unref()

main()
