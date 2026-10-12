import { exec } from 'child_process'
import { readFileSync } from 'fs'

const run = (cmd, opts = {}) => new Promise((res, rej) => {
  const p = exec(cmd, { ...opts, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
    if (err) return rej({ err, stdout, stderr })
    res({ stdout, stderr })
  })
})

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!m.isOwner) return conn.sendMessage(m.chat, { text: 'Solo el propietario puede usar este comando.' }, { quoted: m })
  await conn.sendMessage(m.chat, { text: 'Iniciando actualización desde el repositorio...' }, { quoted: m })

  try {
    const branch = process.env.GIT_BRANCH || 'main'
    const repo = process.env.GIT_REMOTE || 'origin'
    await conn.sendMessage(m.chat, { text: `Haciendo git pull ${repo} ${branch}...` }, { quoted: m })
    const pull = await run(`git pull ${repo} ${branch}`)
    await conn.sendMessage(m.chat, { text: `git pull completado:\n${pull.stdout.slice(0,2000)}` }, { quoted: m })

    await conn.sendMessage(m.chat, { text: 'Instalando dependencias (npm ci)...' }, { quoted: m })
    const hasLock = (() => {
      try { readFileSync('package-lock.json'); return true } catch { return false }
    })()
    const installCmd = hasLock ? 'npm ci' : 'npm install'
    const install = await run(installCmd)
    await conn.sendMessage(m.chat, { text: `Instalación completada:\n${install.stdout.slice(0,2000)}` }, { quoted: m })

    let restarted = false
    try {
      await run('pm2 -v')
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
      const name = pkg.name || 'black-clover'
      await conn.sendMessage(m.chat, { text: `PM2 detectado. Reiniciando proceso ${name}...` }, { quoted: m })
      await run(`pm2 restart ${name}`).catch(async () => {
        await run('pm2 restart all')
      })
      restarted = true
      await conn.sendMessage(m.chat, { text: 'Reinicio con PM2 realizado.' }, { quoted: m })
    } catch (e) {}

    if (!restarted) {
      const now = (text || '').trim().toLowerCase() === 'now'
      if (now) {
        await conn.sendMessage(m.chat, { text: 'Reiniciando proceso (exit)...' }, { quoted: m })
        process.exit(0)
      } else {
        await conn.sendMessage(m.chat, { text: 'Actualización completada. Para aplicar los cambios, reinicia el bot manualmente (ej. npm start) o ejecuta `.fix now` para que el bot se cierre ahora y deje que el gestor de procesos lo reinicie.' }, { quoted: m })
      }
    }

  } catch (err) {
    const out = err.stdout || ''
    const errOut = err.stderr || ''
    await conn.sendMessage(m.chat, { text: `Error durante actualización:\n${String(err.err || err).slice(0,1500)}\n${out.slice(0,1500)}\n${errOut.slice(0,1500)}` }, { quoted: m })
  }
}

handler.command = ['fix']
export default handler
