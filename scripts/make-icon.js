// Génère build/icon.png (512 px) : electron scripts/make-icon.js
const fs = require('fs')
const path = require('path')
const { app, BrowserWindow } = require('electron')

const html = `<body style="margin:0;width:512px;height:512px;display:grid;place-items:center;background:#17121c;border-radius:96px;overflow:hidden">
<span style="font:700 400px/1 Bahnschrift,'Segoe UI',sans-serif;font-stretch:75%;color:#f3a987;transform:translateY(12px)">A</span></body>`

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } })
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const image = await window.webContents.capturePage()
  const output = path.join(__dirname, '../build/icon.png')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, image.resize({ width: 512, height: 512 }).toPNG())
  app.quit()
})
