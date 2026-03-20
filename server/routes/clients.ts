import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, getRoleServicoFilter, canAccessServico } from '../middleware/auth.js'
import type { AuthPayload } from '../middleware/auth.js'
import { auditLog } from '../middleware/audit.js'
import { sendWhatsAppMessage, templates } from '../services/whatsapp.js'

const router = Router()

router.use(authMiddleware)

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
  res.json(clients.map((c) => ({ ...c, valor: Number(c.valor) })))
})

router.get('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const client = await prisma.client.findUnique({
    where: { id: Number(req.params.id) },
    include: { servidor: true, revendedor: true, sala: true },
  })
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, client.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  res.json({ ...client, valor: Number(client.valor) })
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
    },
  })
  const msg = templates.clienteCadastrado(client.nome, dataFim.toLocaleDateString('pt-BR'))
  sendWhatsAppMessage(client.whatsapp, msg).catch(() => {})
  res.status(201).json({ ...client, valor: Number(client.valor) })
})

router.patch('/:id', auditLog('update_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  const body = req.body
  if (body.servico != null && !canAccessServico(user.role, body.servico)) return res.status(403).json({ error: 'Sem permissão para este serviço' })
  const update: Record<string, unknown> = {}
  if (body.nome != null) update.nome = body.nome
  if (body.whatsapp != null) update.whatsapp = body.whatsapp
  if (body.localizacao !== undefined) update.localizacao = body.localizacao || null
  if (body.servico != null) update.servico = body.servico
  if (body.plano != null) update.plano = body.plano
  if (body.servidorId != null) update.servidorId = body.servidorId ? Number(body.servidorId) : null
  if (body.revendedorId !== undefined) update.revendedorId = body.revendedorId ? Number(body.revendedorId) : null
  if (body.perfil != null) update.perfil = body.perfil
  if (body.pin !== undefined) update.pin = body.pin || null
  if (body.iptvUser != null) update.iptvUser = body.iptvUser
  if (body.iptvPass != null) update.iptvPass = body.iptvPass
  if (body.iptvMac != null) update.iptvMac = body.iptvMac
  if (body.iptvM3u != null) update.iptvM3u = body.iptvM3u
  if (body.dataInicio != null) update.dataInicio = new Date(body.dataInicio)
  if (body.dataFim != null) {
    const newDataFim = new Date(body.dataFim)
    update.dataFim = newDataFim
    if (existing.salaId && existing.servico === 'netflix') {
      await prisma.sala.update({ where: { id: existing.salaId }, data: { dataFim: newDataFim } })
      await prisma.client.updateMany({ where: { salaId: existing.salaId }, data: { dataFim: newDataFim } })
    }
  }
  if (body.valor != null) update.valor = Number(body.valor)
  if (body.inscricaoPaga !== undefined) update.inscricaoPaga = body.inscricaoPaga === true || body.inscricaoPaga === 'true'
  if (body.salaId !== undefined) update.salaId = body.salaId != null && body.salaId !== '' ? Number(body.salaId) : null
  if (body.status != null) update.status = body.status
  const client = await prisma.client.update({ where: { id }, data: update })
  res.json({ ...client, valor: Number(client.valor) })
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
    await prisma.client.updateMany({ where: { salaId: client.salaId }, data: { dataFim, status: 'ativo' } })
  } else {
    const base = new Date(client.dataFim)
    dataFim = adicionarMesesADataFim(base, mesesAdd)
    await prisma.client.update({
      where: { id },
      data: { dataFim, valor: valor != null ? Number(valor) : client.valor, status: 'ativo' },
    })
  }
  const updated = await prisma.client.findUnique({ where: { id }, include: { sala: true } })
  if (!updated) return res.status(404).json({ error: 'Cliente não encontrado' })
  const msg = templates.renovado(client.nome, dataFim.toLocaleDateString('pt-BR'))
  sendWhatsAppMessage(client.whatsapp, msg).catch(() => {})
  res.json({ ...updated, valor: Number(updated.valor) })
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
    data: { dataFim: dataFim ? new Date(dataFim) : client.dataFim, status: 'ativo' },
  })
  res.json({ ...updated, valor: Number(updated.valor) })
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
    data: { status: 'vencido' },
  })
  const msg = templates.vencido(updated.nome)
  sendWhatsAppMessage(updated.whatsapp, msg).catch(() => {})
  res.json({ ...updated, valor: Number(updated.valor) })
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
    data: { status: 'ativo', dataFim },
  })
  res.json({ ...updated, valor: Number(updated.valor) })
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
