import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { sendWhatsAppMessage, templates } from '../services/whatsapp.js'
import {
  notifyPanelUsers,
  LEMBRETE_DIAS,
  formatDateBr,
} from '../lib/whatsappNotify.js'
import { ensurePagamentosTables } from '../lib/pagamentos.js'

const router = Router()

// Chamar via Vercel Cron (GET /api/cron/alertas)
// - Na Vercel: Vercel envia Authorization: Bearer <CRON_SECRET>
// - Local: podes também usar ?secret=SEU_SECRET para testes
// Configurar em vercel.json: "crons": [{ "path": "/api/cron/alertas", "schedule": "0 5 * * *" }]
router.get('/alertas', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production' && !secret) {
    return res
      .status(503)
      .json({ error: 'CRON não configurado. Defina CRON_SECRET no ambiente de produção.' })
  }
  if (secret) {
    // Vercel Cron normalmente chama com Authorization: Bearer <CRON_SECRET>
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : ''
    const querySecret = typeof req.query.secret === 'string' ? req.query.secret : ''
    if (token !== secret && querySecret !== secret) {
      return res.status(401).json({ error: 'Não autorizado' })
    }
  }

  const testAdmin = req.query.testAdmin === '1'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)

  // Alertas para admin (salas) – calculados sempre que houver necessidade.
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

  /**
   * Fim de cada mês pago: quando termina um mês e o cliente ainda tem meses pagos à frente,
   * avisa "terminou 1 mês, restam N". Se não restam meses, o aviso de prazo terminado é o do
   * bloco de vencimento abaixo (evita duas mensagens).
   */
  let mesesTerminadosAvisados = 0
  if (!testAdmin) {
    await ensurePagamentosTables().catch(() => {})
    const limiteAtraso = new Date(today)
    limiteAtraso.setDate(limiteAtraso.getDate() - 3)
    const terminados = await prisma.periodoPago
      .findMany({
        where: { fim: { lte: today }, notificadoAt: null },
        select: { id: true, clientId: true, fim: true },
        orderBy: { fim: 'asc' },
      })
      .catch(() => [] as Array<{ id: number; clientId: number; fim: Date }>)
    const porCliente = new Map<number, Array<{ id: number; fim: Date }>>()
    for (const p of terminados) {
      const list = porCliente.get(p.clientId) ?? []
      list.push(p)
      porCliente.set(p.clientId, list)
    }
    for (const [clientId, periodos] of porCliente) {
      const ultimo = periodos[periodos.length - 1]
      const [client, restantes] = await Promise.all([
        prisma.client.findUnique({ where: { id: clientId }, select: { nome: true, whatsapp: true, status: true, servico: true, dataFim: true } }),
        prisma.periodoPago.findMany({ where: { clientId, fim: { gt: today } }, select: { fim: true }, orderBy: { fim: 'asc' } }),
      ])
      let ok = true
      // Períodos antigos (cron parado > 3 dias) são marcados sem enviar, para não mandar avisos desatualizados.
      if (client && client.servico === 'netflix' && client.status === 'ativo' && restantes.length > 0 && ultimo.fim >= limiteAtraso) {
        // Períodos de calendário terminam no dia 1 do mês seguinte → o mês terminado é o anterior.
        const fim = new Date(ultimo.fim)
        const mesTerminado =
          fim.getDate() === 1
            ? new Date(fim.getFullYear(), fim.getMonth() - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
            : formatDateBr(fim)
        ok = await sendWhatsAppMessage(
          client.whatsapp,
          templates.mesPagoTerminou(client.nome, mesTerminado, restantes.length, formatDateBr(client.dataFim))
        )
        if (ok) mesesTerminadosAvisados++
      }
      if (ok) {
        await prisma.periodoPago.updateMany({
          where: { id: { in: periodos.map((p) => p.id) } },
          data: { notificadoAt: new Date() },
        })
      }
    }
  }

  /** Vencimento automático: WhatsApp + marcar vencido; ou só WhatsApp se o painel já marcou vencido. */
  let vencidosAutoSent = 0
  if (!testAdmin) {
    const aindaAtivos = await prisma.client.findMany({
      where: {
        servico: 'netflix',
        status: 'ativo',
        dataFim: { lt: today },
        whatsappNotificadoVencimentoAt: null,
      },
      select: { id: true, nome: true, whatsapp: true },
    })
    for (const c of aindaAtivos) {
      const msg = templates.periodoVencido(c.nome)
      const ok = await sendWhatsAppMessage(c.whatsapp, msg)
      await prisma.client.update({
        where: { id: c.id },
        data: {
          status: 'vencido',
          ...(ok ? { whatsappNotificadoVencimentoAt: new Date() } : {}),
        },
      })
      if (ok) vencidosAutoSent++
    }

    const jaVencidosSemAviso = await prisma.client.findMany({
      where: {
        servico: 'netflix',
        status: 'vencido',
        dataFim: { lt: today },
        whatsappNotificadoVencimentoAt: null,
      },
      select: { id: true, nome: true, whatsapp: true },
    })
    for (const c of jaVencidosSemAviso) {
      const msg = templates.periodoVencido(c.nome)
      const ok = await sendWhatsAppMessage(c.whatsapp, msg)
      if (ok) {
        await prisma.client.update({
          where: { id: c.id },
          data: { whatsappNotificadoVencimentoAt: new Date() },
        })
        vencidosAutoSent++
      }
    }
  }

  const clients = await prisma.client.findMany({
    where: {
      servico: 'netflix',
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
      if (!LEMBRETE_DIAS.includes(dias as (typeof LEMBRETE_DIAS)[number])) continue
      const msg = templates.lembreteRenovacao(c.nome, c.dataFim.toLocaleDateString('pt-BR'), dias)
      const ok = await sendWhatsAppMessage(c.whatsapp, msg)
      if (ok) sent++
    }
  }

  const inscricoesPendentes = await prisma.client.count({
    where: { servico: 'netflix', inscricaoPaga: false, status: { not: 'cancelado' } },
  }).catch(() => 0)
  const indicacoesPendentes = await prisma.indicacao.count({ where: { status: 'pendente' } }).catch(() => 0)

  const shouldNotifyAdmin =
    testAdmin ||
    clients.length > 0 ||
    vencidosAutoSent > 0 ||
    mesesTerminadosAvisados > 0 ||
    salasVencendo.length > 0 ||
    salasVencidas.length > 0 ||
    inscricoesPendentes > 0 ||
    indicacoesPendentes > 0
  if (shouldNotifyAdmin) {
    const adminMsg = testAdmin
      ? 'Teste de alertas do painel (clientes/salas). Se recebeu esta mensagem, está a funcionar.'
      : [
          vencidosAutoSent > 0 ? `Clientes notificados (vencimento automático): ${vencidosAutoSent}` : null,
          sent > 0 ? `Lembretes de renovação enviados hoje: ${sent}` : null,
          mesesTerminadosAvisados > 0
            ? `Clientes avisados do fim de um mês pago (ainda com meses à frente): ${mesesTerminadosAvisados}`
            : null,
          clients.length > 0 ? `Clientes a vencer (7 dias): ${clients.length}` : null,
          inscricoesPendentes > 0 ? `Inscrições Netflix pendentes: ${inscricoesPendentes}` : null,
          indicacoesPendentes > 0 ? `Indicações pendentes: ${indicacoesPendentes}` : null,
          salasVencendo.length > 0
            ? `Salas a vencer (7 dias): ${salasVencendo.length} (${salasVencendo
                .slice(0, 5)
                .map((s) => `${s.nome} (${formatDateBr(s.dataFim!)})`)
                .join(', ')}${salasVencendo.length > 5 ? '...' : ''})`
            : null,
          salasVencidas.length > 0
            ? `Salas vencidas: ${salasVencidas.length} (${salasVencidas
                .slice(0, 5)
                .map((s) => `${s.nome} (${formatDateBr(s.dataFim!)})`)
                .join(', ')}${salasVencidas.length > 5 ? '...' : ''})`
            : null,
        ]
          .filter(Boolean)
          .join('\n')

    void notifyPanelUsers('resumo', adminMsg)
  }

  res.json({
    ok: true,
    total: testAdmin ? 0 : clients.length,
    sent,
    vencidosAutoNotificados: testAdmin ? undefined : vencidosAutoSent,
    mesesTerminadosAvisados: testAdmin ? undefined : mesesTerminadosAvisados,
    testAdmin: testAdmin || undefined,
    salasVencendo: salasVencendo.length,
    salasVencidas: salasVencidas.length,
  })
})

export default router
