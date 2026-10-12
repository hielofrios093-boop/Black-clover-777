import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'

const tmpDir = './tmp'
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

async function ensureImage(filename, url) {
  const filePath = path.join(tmpDir, filename)
  if (!fs.existsSync(filePath)) {
    const res = await fetch(url)
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buffer)
  }
  return filePath
}

function candidateKeysFromMessage(m) {
  return [
    m?.sender,
    m?.key?.participant,
    m?.key?.participantAlt,
    m?.senderPn,
    m?.senderPnAlt,
    m?.phoneNumber,
    (m?.senderResolved) ? m.senderResolved : null,
    (m?.key?.remoteJid) ? m.key.remoteJid : null
  ].filter(Boolean)
}

function getOrCreateUserEntry(m) {
  if (!global.db) global.db = { data: { users: {} } }
  if (!global.db.data) global.db.data = { users: {} }
  if (!global.db.data.users) global.db.data.users = {}

  const candidates = [...new Set(candidateKeysFromMessage(m))]
  for (const key of candidates) {
    if (global.db.data.users[key] && typeof global.db.data.users[key] === 'object') {
      const mainKey = candidates[0]
      if (mainKey !== key) {
        global.db.data.users[mainKey] = Object.assign({}, global.db.data.users[key], global.db.data.users[mainKey] || {})
      }
      const mainUser = global.db.data.users[mainKey]
      for (const c of candidates) global.db.data.users[c] = mainUser
      return { user: mainUser, key: mainKey, candidates }
    }
  }

  const mainKey = candidates[0] || m.sender || 'unknown'
  global.db.data.users[mainKey] = global.db.data.users[mainKey] || {}
  const mainUser = global.db.data.users[mainKey]
  for (const c of candidates) global.db.data.users[c] = mainUser
  return { user: mainUser, key: mainKey, candidates }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const { user, key, candidates } = getOrCreateUserEntry(m)
  const followKey = 'siguiendo'

  user.followed = Boolean(user.followed)
  user.registered = Boolean(user.registered)
  user.name = user.name || (m.pushName || 'Usuario')

  if ((text || '').trim().toLowerCase() === followKey) {
    if (!user.followed) {
      user.followed = true
      user.instagram = user.instagram || (m.pushName || '').replace(/\s+/g, '').toLowerCase() || ''
      for (const c of candidates) global.db.data.users[c] = user
      try { await global.db?.write?.() } catch {}
      try { global.db?.save?.() } catch {}
      return conn.sendMessage(m.chat, {
        text: `✅ Verificado.\nAhora puedes usar *${usedPrefix + command} Nombre.Edad* para registrarte.`
      }, { quoted: m })
    }
    return
  }

  if (!user.followed) {
    return conn.sendMessage(m.chat, {
      text: `Para usar el registro escribe:\n*${usedPrefix + command} siguiendo*\nLuego usa:\n*${usedPrefix + command} Nombre.Edad*`
    }, { quoted: m })
  }

  if (user.registered === true) {
    return conn.sendMessage(m.chat, {
      text: `Ya estás registrado.\nUsa *${usedPrefix}perfil* para ver tu grimorio.`
    }, { quoted: m })
  }

  const regex = /^([a-zA-ZÀ-ÿñÑ\s]+)\.(\d{1,2})$/i
  if (!regex.test(text || '')) {
    return conn.sendMessage(m.chat, {
      text: `Formato incorrecto. Usa:\n*${usedPrefix + command} Nombre.Edad*\n\nEjemplo:\n*${usedPrefix + command} Asta.18*`
    }, { quoted: m })
  }

  const match = (text || '').match(regex)
  const name = match[1].trim()
  const age = parseInt(match[2], 10)

  if (age < 5 || age > 100) {
    return conn.sendMessage(m.chat, {
      text: `Edad no válida (entre 5 y 100 años).`
    }, { quoted: m })
  }

  const paises = ['Clover', 'Diamond', 'Spade', 'Heart']
  const afinidades = ['🔥 Fuego', '💧 Agua', '🌪️ Viento', '🌱 Tierra', '⚡ Rayo', '🌑 Oscuridad', '🌞 Luz']

  const country = paises[Math.floor(Math.random() * paises.length)]
  const afinidad = afinidades[Math.floor(Math.random() * afinidades.length)]
  const nivelMagico = Math.floor(Math.random() * 10) + 1
  const grimorioColor = '📖 Grimorio Mágico'

  user.name = name
  user.age = age
  user.country = country
  user.registered = true
  user.regTime = Date.now()
  user.afinidad = afinidad
  user.nivelMagico = nivelMagico
  user.instagram = user.instagram || (m.pushName || '').replace(/\s+/g, '').toLowerCase() || ''
  for (const c of candidates) global.db.data.users[c] = user
  try { await global.db?.write?.() } catch {}
  try { global.db?.save?.() } catch {}

  let profilePic
  try { profilePic = await conn.profilePictureUrl(m.sender, 'image') } catch { profilePic = 'https://qu.ax/AfutJ.jpg' }

  const registroImg = await ensureImage('perfil.jpg', profilePic)
  const thumbnailBuffer = fs.readFileSync(await ensureImage('registro_completo.jpg', 'https://qu.ax/AfutJ.jpg'))

  let responseMessage = `> *🌿!**R E G I S T R O  M Á G I C O*\n\n`
  responseMessage += `> *!* ✧──『 ⚜️ 𝗗𝗔𝗧𝗢𝗦 ⚜️ 』\n`
  responseMessage += `> *!* 🧙‍♂️ *Nombre:* ${name}\n`
  responseMessage += `> *!* 🎂 *Edad:* ${age}\n`
  responseMessage += `> *!* 🌍 *Reino:* ${country}\n`
  responseMessage += `> *!* 🌌 *Afinidad:* ${afinidad}\n`
  responseMessage += `> *!* 💠 *Nivel Mágico:* ${nivelMagico}\n`
  responseMessage += `> *!* 📖 *Grimorio:* ${grimorioColor}\n`
  responseMessage += `> *!* ✧────────────────✧\n\n`
  responseMessage += `> *!* 🕯️ 𝑬𝒍 𝒗í𝒏𝒄𝒖𝒍𝒐 𝒎á𝒈𝒊𝒄𝒐 𝒔𝒆 𝒉𝒂 𝒆𝒔𝒕𝒂𝒃𝒍𝒆𝒄𝒊𝒅𝒐.\n`
  responseMessage += `> *🌿!* ⚔️ 𝑩𝒊𝒆𝒏𝒗𝒆𝒏𝒊𝒅𝒐, *${name.toUpperCase()}* 𝒅𝒆𝒍 𝑹𝒆𝒊𝒏𝒐 ${country}.\n`
  responseMessage += `> *!* ☘️ ¡𝑬𝒍 𝒅𝒆𝒔𝒕𝒊𝒏𝒐 𝒕𝒆 𝒂𝒈𝒖𝒂𝒓𝒅𝒂!`

  const newsletterId = '120363413153648177@newsletter'
  const newsletterName = 'The Legends'

  const contextInfo = {
    isForwarded: true,
    forwardingScore: 1,
    forwardedNewsletterMessageInfo: {
      newsletterJid: newsletterId,
      newsletterName: newsletterName,
      serverMessageId: 100
    }
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        image: { url: registroImg },
        caption: responseMessage,
        mentions: [...new Set(((responseMessage.match(/@(\d{5,16})/g)) || []).map(v => v.replace('@', '') + '@s.whatsapp.net'))],
        contextInfo
      },
      { quoted: m }
    )
  } catch (e) {
    await conn.sendMessage(m.chat, { text: responseMessage }, { quoted: m })
  }
}

handler.command = ['registrarme', 'registrar', 'reg']
export default handler
