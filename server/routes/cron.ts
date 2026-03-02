import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { sendWhatsAppMessage, templates } from '../services/whatsapp.js'

const router = Router()

// Chamar via Vercel Cron (GET /api/cron/alertas?secret=SEU_SECRET)
// Configurar em vercel.json: "crons": [{ "path": "/api/cron/alertas", "schedule": "0 9 * * *" }]
router.get('/alertas', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in3Days = new Date(today)
  in3Days.setDate(in3Days.getDate() + 3)
  const clients = await prisma.client.findMany({
    where: {
      status: 'ativo',
      dataFim: { gte: today, lt: in3Days },
    },
  })
  let sent = 0
  for (const c of clients) {
    const ok = await sendWhatsAppMessage(
      c.whatsapp,
      templates.lembrete3Dias(c.nome, c.dataFim.toLocaleDateString('pt-BR'))
    )
    if (ok) sent++
  }
  res.json({ ok: true, total: clients.length, sent })
})

export default router
