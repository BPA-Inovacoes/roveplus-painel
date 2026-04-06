/**
 * API de WhatsApp - Microserviço para o Rove+ Painel
 * Recebe requisições HTTP e envia mensagens via WhatsApp Web (whatsapp-web.js).
 *
 * Iniciar: node server.js
 * Requer: WHATSAPP_TOKEN (opcional mas recomendado para segurança)
 * Porta: 3001 (ou PORT)
 */

const express = require('express')
const cors = require('cors')
const qrcode = require('qrcode-terminal')
const { Client, LocalAuth } = require('whatsapp-web.js')

// --- Configuração (3002 por defeito para não conflitar com o Rove+ em 3001) ---
const PORT = process.env.PORT || 3002
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || ''

// --- WhatsApp Client ---
const WWEBJS_AUTH_PATH = process.env.WWEBJS_AUTH_PATH || './.wwebjs_auth'
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: WWEBJS_AUTH_PATH,
  }),
})

let isConnected = false

client.on('qr', (qr) => {
  console.log('\n[WhatsApp] Escaneie o QR Code abaixo com o telemóvel (WhatsApp > Dispositivos ligados):\n')
  qrcode.generate(qr, { small: true })
})

client.on('ready', () => {
  isConnected = true
  console.log('WhatsApp conectado!')
})

client.on('auth_failure', (msg) => {
  console.error('[WhatsApp] Falha de autenticação:', msg)
  isConnected = false
})

client.on('disconnected', (reason) => {
  console.log('[WhatsApp] Desconectado:', reason)
  isConnected = false
})

client.initialize()

// --- Express ---
const app = express()

app.use(cors())
app.use(express.json())

/** Middleware: valida token no header Authorization: Bearer TOKEN */
function authMiddleware(req, res, next) {
  if (!WHATSAPP_TOKEN) {
    return next()
  }
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token de autorização ausente' })
  }
  const token = authHeader.slice(7)
  if (token !== WHATSAPP_TOKEN) {
    return res.status(401).json({ success: false, error: 'Token inválido' })
  }
  next()
}

app.use(authMiddleware)

/**
 * GET /status
 * Retorna se o WhatsApp está conectado.
 */
app.get('/status', (req, res) => {
  res.json({ connected: isConnected })
})

/**
 * POST /send
 * Body: { "phone": "244XXXXXXXXX", "message": "texto da mensagem" }
 * Envia mensagem para o número via WhatsApp Web.
 */
app.post('/send', async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({
      success: false,
      error: 'WhatsApp não está conectado. Escaneie o QR Code no terminal.',
    })
  }

  const { phone, message } = req.body

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ success: false, error: 'Campo "phone" é obrigatório' })
  }
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Campo "message" é obrigatório' })
  }

  // Normalizar: só dígitos (ex: "244 912 345 678" -> "244912345678")
  const normalizedPhone = phone.replace(/\D/g, '').replace(/^0+/, '')
  if (!normalizedPhone.length) {
    return res.status(400).json({ success: false, error: 'Número de telefone inválido' })
  }

  const chatId = `${normalizedPhone}@c.us`

  try {
    await client.sendMessage(chatId, message)
    res.json({ success: true, message: 'Mensagem enviada' })
  } catch (err) {
    console.error('[WhatsApp] Erro ao enviar:', err.message)
    res.status(500).json({
      success: false,
      error: err.message || 'Erro ao enviar mensagem',
    })
  }
})

// Health check (sem auth para monitorização)
app.get('/health', (req, res) => {
  res.json({ ok: true, whatsapp: isConnected })
})

app.listen(PORT, () => {
  console.log(`API WhatsApp a correr em http://localhost:${PORT}`)
  console.log('Endpoints: GET /status, POST /send')
  if (!WHATSAPP_TOKEN) {
    console.warn('[Aviso] WHATSAPP_TOKEN não definido - requisições não são protegidas por token.')
  }
})
