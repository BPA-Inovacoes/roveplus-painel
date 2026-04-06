import { Router } from 'express'
import bcrypt from 'bcryptjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, getRoleServicoFilter, canAccessServico } from '../middleware/auth.js'
import type { AuthPayload } from '../middleware/auth.js'
import { auditLog } from '../middleware/audit.js'
import { sendWhatsAppMessage, templates, normalizeClientWhatsappKey } from '../services/whatsapp.js'

const router = Router()

router.use(authMiddleware)

function stripPortalPinHash<T extends Record<string, unknown>>(c: T) {
  const { portalPinHash: _p, ...rest } = c
  return rest
}

/** Adiciona N meses à data fim atual (mantém o dia; renovar = +1 mês, +2 meses, etc.). */
function adicionarMesesADataFim(base: Date, meses: number): Date {
  const d = new Date(base)
  d.setHours(0, 0, 0, 0)
  d.setMonth(d.getMonth() + meses)
  return d
}

router.get('/', async (req, res) => {
  const { servico, servidorId, status, vencendo, revendedorId } = req.query
  const user = (req as unknown as { user: AuthPayload }).user
  const roleFilter = getRoleServicoFilter(user.role)

  // Atualizar automaticamente para vencido: clientes ativos cuja dataFim já passou
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.client.updateMany({
    where: { status: 'ativo', dataFim: { lt: today } },
    data: { status: 'vencido' },
  })

  const where: Record<string, unknown> = {}
  if (roleFilter) where.servico = roleFilter
  else if (servico) where.servico = servico
  if (servidorId) where.servidorId = Number(servidorId)
  if (status) where.status = status
  if (vencendo === 'hoje') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    where.dataFim = { gte: today, lt: tomorrow }
    where.status = 'ativo'
  }
  if (vencendo === '3dias') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in3 = new Date(today)
    in3.setDate(in3.getDate() + 3)
    where.dataFim = { gte: today, lt: in3 }
    where.status = 'ativo'
  }
  if (vencendo === '7dias') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in7 = new Date(today)
    in7.setDate(in7.getDate() + 7)
    where.dataFim = { gte: today, lte: in7 }
    where.status = 'ativo'
  }
  if (req.query.revendedorId) where.revendedorId = Number(req.query.revendedorId)
  const clients = await prisma.client.findMany({
    where,
    include: { servidor: true, revendedor: true, sala: true },
    orderBy: { dataFim: 'asc' },
  })
  res.json(
    clients.map((c) => {
      const areaClienteAtiva = !!c.portalPinHash
      return {
        ...stripPortalPinHash({ ...c, valor: Number(c.valor) } as Record<string, unknown>),
        areaClienteAtiva,
      }
    })
  )
})

router.get('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const client = await prisma.client.findUnique({
    where: { id: Number(req.params.id) },
    include: { servidor: true, revendedor: true, sala: true },
  })
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, client.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  res.json({
    ...stripPortalPinHash({ ...client, valor: Number(client.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!client.portalPinHash,
  })
})

router.post('/', auditLog('create_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const body = req.body
  const servico = body.servico || 'iptv'
  if (!canAccessServico(user.role, servico)) return res.status(403).json({ error: 'Sem permissão para criar cliente deste serviço' })
  let dataFim = body.dataFim ? new Date(body.dataFim) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const salaId = body.salaId != null && body.salaId !== '' ? Number(body.salaId) : null
  if (servico === 'netflix' && salaId) {
    const sala = await prisma.sala.findUnique({ where: { id: salaId } })
    if (sala?.dataFim) dataFim = sala.dataFim
  }
  let portalPinHash: string | undefined
  if (body.portalPin != null && String(body.portalPin).trim() !== '') {
    if (String(body.portalPin).trim().length < 4) {
      return res.status(400).json({ error: 'PIN da área cliente deve ter pelo menos 4 caracteres' })
    }
    portalPinHash = await bcrypt.hash(String(body.portalPin).trim(), 10)
  }
  const client = await prisma.client.create({
    data: {
      nome: body.nome,
      whatsapp: body.whatsapp,
      localizacao: body.localizacao || null,
      servico,
      plano: body.plano || 'mensal',
      servidorId: body.servidorId ? Number(body.servidorId) : null,
      revendedorId: body.revendedorId ? Number(body.revendedorId) : null,
      perfil: body.perfil || null,
      pin: body.pin || null,
      iptvUser: body.iptvUser || null,
      iptvPass: body.iptvPass || null,
      iptvMac: body.iptvMac || null,
      iptvM3u: body.iptvM3u || null,
      dataInicio: body.dataInicio ? new Date(body.dataInicio) : new Date(),
      dataFim,
      valor: Number(body.valor) || 0,
      inscricaoPaga: body.inscricaoPaga === true || body.inscricaoPaga === 'true' ? true : body.inscricaoPaga === false || body.inscricaoPaga === 'false' ? false : null,
      salaId,
      status: 'ativo',
      ...(portalPinHash ? { portalPinHash } : {}),
    },
  })
  const msg = templates.clienteCadastrado(client.nome, dataFim.toLocaleDateString('pt-BR'))
  void sendWhatsAppMessage(client.whatsapp, msg).catch(() => {})
  res.status(201).json({
    ...stripPortalPinHash({ ...client, valor: Number(client.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!client.portalPinHash,
  })
})

router.patch('/:id', auditLog('update_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  const body = req.body
  if (body.servico != null && !canAccessServico(user.role, body.servico)) return res.status(403).json({ error: 'Sem permissão para este serviço' })
  const data: Prisma.ClientUncheckedUpdateInput = {}
  if (body.nome != null) data.nome = body.nome
  if (body.whatsapp != null) data.whatsapp = body.whatsapp
  if (body.localizacao !== undefined) data.localizacao = body.localizacao || null
  if (body.servico != null) data.servico = body.servico
  if (body.plano != null) data.plano = body.plano
  if (body.servidorId != null) data.servidorId = body.servidorId ? Number(body.servidorId) : null
  if (body.revendedorId !== undefined) data.revendedorId = body.revendedorId ? Number(body.revendedorId) : null
  if (body.perfil != null) data.perfil = body.perfil
  if (body.pin !== undefined) data.pin = body.pin || null
  if (body.iptvUser != null) data.iptvUser = body.iptvUser
  if (body.iptvPass != null) data.iptvPass = body.iptvPass
  if (body.iptvMac != null) data.iptvMac = body.iptvMac
  if (body.iptvM3u != null) data.iptvM3u = body.iptvM3u
  if (body.dataInicio != null) data.dataInicio = new Date(body.dataInicio)
  if (body.dataFim != null) {
    const newDataFim = new Date(body.dataFim)
    data.dataFim = newDataFim
    if (existing.salaId && existing.servico === 'netflix') {
      await prisma.sala.update({ where: { id: existing.salaId }, data: { dataFim: newDataFim } })
      await prisma.client.updateMany({ where: { salaId: existing.salaId }, data: { dataFim: newDataFim } })
    }
  }
  if (body.valor != null) data.valor = Number(body.valor)
  if (body.inscricaoPaga !== undefined) data.inscricaoPaga = body.inscricaoPaga === true || body.inscricaoPaga === 'true'
  if (body.salaId !== undefined) data.salaId = body.salaId != null && body.salaId !== '' ? Number(body.salaId) : null
  if (body.status != null) data.status = body.status
  if (body.portalPin !== undefined) {
    if (body.portalPin === null || String(body.portalPin).trim() === '') {
      data.portalPinHash = null
    } else if (String(body.portalPin).trim().length < 4) {
      return res.status(400).json({ error: 'PIN da área cliente deve ter pelo menos 4 caracteres' })
    } else {
      data.portalPinHash = await bcrypt.hash(String(body.portalPin).trim(), 10)
    }
  }
  const client = await prisma.client.update({ where: { id }, data })
  res.json({
    ...stripPortalPinHash({ ...client, valor: Number(client.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!client.portalPinHash,
  })
})

router.post('/:id/renovar', auditLog('renew_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, client.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  if (client.status === 'vencido') return res.status(400).json({ error: 'Cliente vencido. Use Ativar para reativar.' })
  const { dias, meses, valor } = req.body
  const mesesAdd = Number(meses) || (dias ? Math.max(1, Math.round(Number(dias) / 30)) : 1)
  let dataFim: Date
  if (client.salaId && client.servico === 'netflix') {
    const sala = await prisma.sala.findUnique({ where: { id: client.salaId } })
    const base = new Date(sala?.dataFim ?? client.dataFim)
    dataFim = adicionarMesesADataFim(base, mesesAdd)
    await prisma.sala.update({ where: { id: client.salaId }, data: { dataFim } })
    await prisma.client.updateMany({
      where: { salaId: client.salaId },
      data: { dataFim, status: 'ativo', whatsappNotificadoVencimentoAt: null },
    })
  } else {
    const base = new Date(client.dataFim)
    dataFim = adicionarMesesADataFim(base, mesesAdd)
    await prisma.client.update({
      where: { id },
      data: {
        dataFim,
        valor: valor != null ? Number(valor) : client.valor,
        status: 'ativo',
        whatsappNotificadoVencimentoAt: null,
      },
    })
  }
  const updated = await prisma.client.findUnique({ where: { id }, include: { sala: true } })
  if (!updated) return res.status(404).json({ error: 'Cliente não encontrado' })
  const fimStr = dataFim.toLocaleDateString('pt-BR')
  if (client.salaId && client.servico === 'netflix') {
    const naSala = await prisma.client.findMany({ where: { salaId: client.salaId } })
    const seen = new Set<string>()
    for (const c of naSala) {
      const key = normalizeClientWhatsappKey(c.whatsapp)
      if (seen.has(key)) continue
      seen.add(key)
      const msg = templates.renovado(c.nome, fimStr)
      void sendWhatsAppMessage(c.whatsapp, msg).catch(() => {})
    }
  } else {
    const msg = templates.renovado(client.nome, fimStr)
    void sendWhatsAppMessage(client.whatsapp, msg).catch(() => {})
  }
  res.json({
    ...stripPortalPinHash({ ...updated, valor: Number(updated.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!updated.portalPinHash,
  })
})

router.post('/:id/marcar-pago', auditLog('mark_paid_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, client.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  if (client.status === 'vencido') return res.status(400).json({ error: 'Cliente vencido. Use Ativar para reativar.' })
  const { dataFim } = req.body
  const updated = await prisma.client.update({
    where: { id },
    data: {
      dataFim: dataFim ? new Date(dataFim) : client.dataFim,
      status: 'ativo',
      whatsappNotificadoVencimentoAt: null,
    },
  })
  const fimStr = new Date(updated.dataFim).toLocaleDateString('pt-BR')
  const msgPago = templates.pagamentoRegistado(updated.nome, fimStr)
  void sendWhatsAppMessage(updated.whatsapp, msgPago).catch(() => {})
  res.json({
    ...stripPortalPinHash({ ...updated, valor: Number(updated.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!updated.portalPinHash,
  })
})

router.post('/:id/suspender', auditLog('suspend_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  if (existing.status === 'vencido') return res.status(400).json({ error: 'Cliente já está vencido.' })
  const updated = await prisma.client.update({
    where: { id },
    data: { status: 'vencido', whatsappNotificadoVencimentoAt: new Date() },
  })
  const msg = templates.servicoSuspenso(updated.nome)
  void sendWhatsAppMessage(updated.whatsapp, msg).catch(() => {})
  res.json({
    ...stripPortalPinHash({ ...updated, valor: Number(updated.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!updated.portalPinHash,
  })
})

/** Próximo dia 11 a partir de hoje (para cliente ficar ativo após ativar). */
function proximoDia11(): Date {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dia11 = new Date(hoje.getFullYear(), hoje.getMonth(), 11)
  if (hoje <= dia11) return dia11
  return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 11)
}

router.post('/:id/ativar', auditLog('activate_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  const dataFim = proximoDia11()
  const updated = await prisma.client.update({
    where: { id },
    data: { status: 'ativo', dataFim, whatsappNotificadoVencimentoAt: null },
  })
  const fimStr = dataFim.toLocaleDateString('pt-BR')
  const msgAtiv = templates.reativado(updated.nome, fimStr)
  void sendWhatsAppMessage(updated.whatsapp, msgAtiv).catch(() => {})
  res.json({
    ...stripPortalPinHash({ ...updated, valor: Number(updated.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!updated.portalPinHash,
  })
})

router.delete('/:id', auditLog('delete_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  await prisma.client.delete({ where: { id } })
  res.status(204).send()
})

export default router
