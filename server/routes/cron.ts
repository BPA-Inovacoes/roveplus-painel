import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { sendWhatsAppMessage, templates } from '../services/whatsapp.js'

const router = Router()

// Chamar via Vercel Cron (GET /api/cron/alertas)
// - Na Vercel: Vercel envia Authorization: Bearer <CRON_SECRET>
// - Local: podes também usar ?secret=SEU_SECRET para testes
// Configurar em vercel.json: "crons": [{ "path": "/api/cron/alertas", "schedule": "0 5 * * *" }]
router.get('/alertas', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    // Vercel Cron normalmente chama com Authorization: Bearer <CRON_SECRET>
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : ''
    const querySecret = typeof req.query.secret === 'string' ? req.query.secret : ''
    if (token !== secret && querySecret !== secret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const testAdmin = req.query.testAdmin === '1'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)

  // Alertas para admin (salas e servidores) – calculados sempre que houver necessidade.
  const salasVencendo = await prisma.sala.findMany({
    where: { status: 'ativo', dataFim: { gte: today, lte: in7Days } },
    select: { id: true, nome: true, dataFim: true },
    orderBy: { dataFim: 'asc' },
  })
  const salasVencidas = await prisma.sala.findMany({
    where: { status: 'ativo', dataFim: { lt: today } },
    select: { id: true, nome: true, dataFim: true },
    orderBy: { dataFim: 'asc' },
  })
  const servidoresProblema = await prisma.servidor.findMany({
    where: { status: { in: ['instável', 'offline'] } },
    select: { id: true, nome: true, status: true, _count: { select: { clients: true } } },
    orderBy: { nome: 'asc' },
  })

  const clients = await prisma.client.findMany({
    where: {
      status: 'ativo',
      dataFim: { gte: today, lte: in7Days },
    },
  })
  let sent = 0
  if (!testAdmin) {
    for (const c of clients) {
      const dataFim = new Date(c.dataFim)
      dataFim.setHours(0, 0, 0, 0)
      const dias = Math.ceil((dataFim.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      const msg = dias <= 3
        ? templates.lembrete3Dias(c.nome, c.dataFim.toLocaleDateString('pt-BR'))
        : templates.lembrete7Dias(c.nome, c.dataFim.toLocaleDateString('pt-BR'), dias)
      const ok = await sendWhatsAppMessage(c.whatsapp, msg)
      if (ok) sent++
    }
  }

  // Se houver alertas (ou teste), notificar admin no WhatsApp
  const shouldNotifyAdmin = testAdmin || clients.length > 0 || salasVencendo.length > 0 || salasVencidas.length > 0 || servidoresProblema.length > 0
  if (shouldNotifyAdmin) {
    const admins = await prisma.user.findMany({
      where: { role: 'admin', whatsapp: { not: null } },
      select: { whatsapp: true },
    })

    // Sala.dataFim é opcional no schema (DateTime?); por isso pode vir null no Prisma.
    const formatDate = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR') : '—')

    const adminMsg = testAdmin
      ? 'Rove+ Painel: Teste de alertas do admin (clientes/salas/servidores). Se recebeu esta mensagem, está a funcionar.'
      : [
          clients.length > 0 ? `Clientes a vencer (7 dias): ${clients.length}` : null,
          salasVencendo.length > 0
            ? `Salas a vencer (7 dias): ${salasVencendo.length} (${salasVencendo
                .slice(0, 5)
                .map((s) => `${s.nome} (${formatDate(s.dataFim)})`)
                .join(', ')}${salasVencendo.length > 5 ? '...' : ''})`
            : null,
          salasVencidas.length > 0
            ? `Salas vencidas: ${salasVencidas.length} (${salasVencidas
                .slice(0, 5)
                .map((s) => `${s.nome} (${formatDate(s.dataFim)})`)
                .join(', ')}${salasVencidas.length > 5 ? '...' : ''})`
            : null,
          servidoresProblema.length > 0
            ? `Servidores instável/offline: ${servidoresProblema.length} (${servidoresProblema
                .slice(0, 5)
                .map((s) => `${s.nome} (${s.status}, ${s._count.clients} cliente(s))`)
                .join(', ')}${servidoresProblema.length > 5 ? '...' : ''})`
            : null,
        ]
          .filter(Boolean)
          .join('\n') + '\n\nAceda ao painel para detalhes.'

    for (const a of admins) {
      if (a.whatsapp) {
        await sendWhatsAppMessage(a.whatsapp, adminMsg)
      }
    }
  }

  res.json({
    ok: true,
    total: testAdmin ? 0 : clients.length,
    sent,
    testAdmin: testAdmin || undefined,
    salasVencendo: salasVencendo.length,
    salasVencidas: salasVencidas.length,
    servidoresProblema: servidoresProblema.length,
  })
})

export default router
