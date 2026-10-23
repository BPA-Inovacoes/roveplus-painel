import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, canAccessServico, canManageClients, canAccessFinanceiro } from '../middleware/auth.js'
import type { AuthPayload } from '../middleware/auth.js'
import { auditLog } from '../middleware/audit.js'
import { sendWhatsAppMessage, templates, normalizeClientWhatsappKey } from '../services/whatsapp.js'
import { normalizeWhatsappOptional } from '../lib/validate.js'
import {
  notifyPanelUsers,
  clientAreaUrl,
  formatDateBr,
  sameCalendarDay,
} from '../lib/whatsappNotify.js'
import {
  ensurePortalPinPlainColumn,
  getPortalPinPlainMap,
  setPortalPinPlainInDb,
} from '../lib/portalPinPlain.js'
import { ensureClientRoveId, getRoveIdsMap } from '../lib/roveId.js'
import { MAX_CLIENTES_POR_SALA, lugaresOcupados } from '../lib/salasConfig.js'
import {
  addMonthsKeepingBillingDay,
  calcularCobertura,
  editarPagamentoCliente,
  limiteRenovacaoDoMes,
  startOfToday,
  listarPagamentosCliente,
  mesesEntre,
  registarPagamentoCliente,
  removerPagamentoCliente,
  serializePagamento,
} from '../lib/pagamentos.js'

const router = Router()

type AnyRecord = Record<string, any>

router.use(authMiddleware)

function stripPortalPinHash<T extends Record<string, unknown>>(c: T) {
  const { portalPinHash: _p, portalPinPlain: _pp, ...rest } = c
  return rest
}

async function ensurePortalFirstLoginColumn(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS portal_first_login BOOLEAN NOT NULL DEFAULT false
  `)
}

async function ensureUniqueClientWhatsapp(whatsapp: string, excludeId?: number): Promise<void> {
  const key = normalizeClientWhatsappKey(whatsapp)
  const candidates = await prisma.client.findMany({
    where: {
      whatsapp: { contains: key },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, whatsapp: true },
  })
  if (candidates.some((client: { id: number; whatsapp: string }) => normalizeClientWhatsappKey(client.whatsapp) === key)) {
    throw new Error('whatsapp-duplicate')
  }
}

async function ensureUniqueClientPerfil(perfil: string, excludeId?: number): Promise<void> {
  const existing = await prisma.client.findFirst({
    where: {
      perfil: { equals: perfil, mode: 'insensitive' },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (existing) {
    throw new Error('perfil-duplicate')
  }
}

function optionalDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

router.get('/', async (req, res) => {
  const { status, vencendo, salaId, q, inscricaoPaga } = req.query
  const user = (req as unknown as { user: AuthPayload }).user
  const includePortalPin = user.role === 'admin' && String(req.query.includePortalPin) === '1'
  await ensurePortalPinPlainColumn().catch(() => {})

  // Atualizar automaticamente para vencido: clientes ativos cuja dataFim já passou
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.client.updateMany({
    where: { servico: 'netflix', status: 'ativo', dataFim: { lt: today } },
    data: { status: 'vencido' },
  })

  // O painel só gere clientes Netflix (registos IPTV antigos ficam na base mas não aparecem).
  const where: AnyRecord = { servico: 'netflix' }
  if (salaId) where.salaId = Number(salaId)
  if (status) where.status = String(status)
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
  // Por pagar este mês: ativos/vencidos cujo mês atual ainda não está pago (data fim antes do dia 10 do mês seguinte).
  if (req.query.porPagarMes === '1') {
    const now = new Date()
    where.status = { in: ['ativo', 'vencido'] }
    where.dataFim = { lt: limiteRenovacaoDoMes(new Date(now.getFullYear(), now.getMonth() + 1, 1)) }
  }
  if (inscricaoPaga === 'true' || inscricaoPaga === '1') where.inscricaoPaga = true
  else if (inscricaoPaga === 'false' || inscricaoPaga === '0') where.inscricaoPaga = false
  else if (inscricaoPaga === 'pendente') {
    where.OR = [{ inscricaoPaga: false }, { inscricaoPaga: null }]
  }

  const qTerm = typeof q === 'string' ? q.trim() : ''
  if (qTerm) {
    const digits = qTerm.replace(/\D/g, '')
    const or: AnyRecord[] = [
      { nome: { contains: qTerm, mode: 'insensitive' } },
      { whatsapp: { contains: qTerm } },
      { localizacao: { contains: qTerm, mode: 'insensitive' } },
      { plano: { contains: qTerm, mode: 'insensitive' } },
      { perfil: { contains: qTerm, mode: 'insensitive' } },
      { roveId: { contains: qTerm, mode: 'insensitive' } },
      { sala: { nome: { contains: qTerm, mode: 'insensitive' } } },
    ]
    if (digits && digits !== qTerm) {
      or.push({ whatsapp: { contains: digits } })
    }
    where.AND = [{ OR: or }]
  }

  const clients = await prisma.client.findMany({
    where,
    include: { sala: true },
    orderBy: { dataFim: 'asc' },
  })
  const [pinPlainById, roveById] = await Promise.all([
    includePortalPin ? getPortalPinPlainMap(clients.map((c: { id: number }) => c.id)) : Promise.resolve(null),
    getRoveIdsMap(clients.map((c: { id: number }) => c.id)),
  ])
  const enriched = clients.map((c: { id: number; portalPinHash: string | null; [key: string]: unknown }) => {
    const areaClienteAtiva = !!c.portalPinHash
    const base = stripPortalPinHash({ ...c, valor: Number(c.valor) } as Record<string, unknown>)
    const fromDb = pinPlainById?.get(Number(c.id))
    return {
      ...base,
      roveId: roveById.get(c.id) ?? null,
      areaClienteAtiva,
      ...(includePortalPin
        ? {
            portalPinPlain: fromDb != null && String(fromDb) !== '' ? fromDb : null,
          }
        : {}),
    }
  })
  res.json(enriched)
})

router.get('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const client = await prisma.client.findUnique({
    where: { id: Number(req.params.id) },
    include: { sala: true },
  })
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, client.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  const roveId = await ensureClientRoveId(client.id)
  res.json({
    ...stripPortalPinHash({ ...client, valor: Number(client.valor) } as Record<string, unknown>),
    roveId,
    areaClienteAtiva: !!client.portalPinHash,
  })
})

router.post('/', auditLog('create_client', 'client'), async (req, res) => {
  await ensurePortalPinPlainColumn().catch(() => {})
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canManageClients(user.role)) return res.status(403).json({ error: 'Sem permissão para criar clientes' })
  const body = req.body
  const whatsapp = normalizeWhatsappOptional(body.whatsapp)
  if (body.whatsapp != null && String(body.whatsapp).trim() !== '' && whatsapp === null) {
    return res.status(400).json({ error: 'Telefone inválido' })
  }
  const perfil = body.perfil != null ? String(body.perfil).trim() : null
  if (perfil !== null && perfil !== '' && perfil.length < 2) {
    return res.status(400).json({ error: 'Perfil inválido' })
  }
  const pin = body.pin != null ? String(body.pin).trim() : null
  if (pin !== null && pin !== '' && pin.length < 4) {
    return res.status(400).json({ error: 'PIN inválido' })
  }
  if (whatsapp) {
    try {
      await ensureUniqueClientWhatsapp(whatsapp)
    } catch (err) {
      if (err instanceof Error && err.message === 'whatsapp-duplicate') {
        return res.status(400).json({ error: 'Contacto já existe' })
      }
      throw err
    }
  }
  if (perfil) {
    try {
      await ensureUniqueClientPerfil(perfil)
    } catch (err) {
      if (err instanceof Error && err.message === 'perfil-duplicate') {
        return res.status(400).json({ error: 'Perfil já existe' })
      }
      throw err
    }
  }
  const servico = 'netflix'
  if (!canAccessServico(user.role, servico)) return res.status(403).json({ error: 'Sem permissão para criar cliente deste serviço' })
  // A data fim do cliente é dele (meses que pagou), independente da data fim da sala.
  const dataInicio = optionalDate(body.dataInicio) ?? new Date()
  dataInicio.setHours(0, 0, 0, 0)
  const mesesPagos = Number(body.mesesPagos) > 0 ? Math.min(24, Math.round(Number(body.mesesPagos))) : null
  // Meses pagos = meses de calendário a partir do mês atual; renovação até ao dia 10 do mês seguinte.
  let dataFim = mesesPagos
    ? calcularCobertura(dataInicio, mesesPagos).dataFim
    : optionalDate(body.dataFim) ?? addMonthsKeepingBillingDay(dataInicio, 1)
  const salaId = body.salaId != null && body.salaId !== '' ? Number(body.salaId) : null
  if (salaId != null) {
    if (!(await prisma.sala.findUnique({ where: { id: salaId }, select: { id: true } }))) {
      return res.status(400).json({ error: 'Sala não encontrada' })
    }
    if ((await lugaresOcupados(salaId)) >= MAX_CLIENTES_POR_SALA) {
      return res.status(400).json({ error: `Esta sala já tem ${MAX_CLIENTES_POR_SALA} clientes (máximo). Escolha outra sala.` })
    }
  }
  let portalPinHash: string | undefined
  if (body.portalPin != null && String(body.portalPin).trim() !== '') {
    if (String(body.portalPin).trim().length < 4) {
      return res.status(400).json({ error: 'PIN da área cliente deve ter pelo menos 4 caracteres' })
    }
    portalPinHash = await bcrypt.hash(String(body.portalPin).trim(), 10)
  }
  const portalPlain =
    body.portalPin != null && String(body.portalPin).trim() !== '' ? String(body.portalPin).trim() : null
  const client = await prisma.client.create({
    data: {
      nome: body.nome,
      whatsapp: whatsapp ?? body.whatsapp,
      localizacao: body.localizacao || null,
      servico,
      plano: body.plano || 'mensal',
      perfil: perfil || null,
      pin: pin || null,
      dataSubscricao: body.dataSubscricao ? new Date(body.dataSubscricao) : new Date(),
      dataInicio,
      dataFim,
      valor: Number(body.valor) || 0,
      inscricaoPaga: body.inscricaoPaga === true || body.inscricaoPaga === 'true' ? true : body.inscricaoPaga === false || body.inscricaoPaga === 'false' ? false : null,
      salaId,
      status: 'ativo',
      ...(portalPinHash ? { portalPinHash } : {}),
    },
  })
  // Primeiro pagamento: fica no histórico desde o registo do cliente.
  try {
    const meses = mesesPagos ?? Math.min(24, mesesEntre(dataInicio, dataFim))
    const r = await registarPagamentoCliente({
      clientId: client.id,
      meses,
      mesInicial: mesesPagos ? dataInicio : null,
      inicio: mesesPagos ? null : addMonthsKeepingBillingDay(dataFim, -meses),
      fim: mesesPagos ? null : dataFim,
      valorTotal: body.valorPago != null && body.valorPago !== '' ? Number(body.valorPago) : null,
      dataPagamento: optionalDate(body.dataPagamento) ?? new Date(),
      metodo: body.metodoPagamento || null,
      userId: user.userId,
      origem: mesesPagos ? 'painel' : 'inicial',
    })
    dataFim = r.dataFim
  } catch (e) {
    console.error('[clients] Erro ao registar pagamento inicial:', e)
  }
  if (portalPinHash && portalPlain) {
    await setPortalPinPlainInDb(client.id, portalPlain)
  }
  if (portalPinHash) {
    await ensurePortalFirstLoginColumn().catch(() => {})
    await prisma.$executeRawUnsafe('UPDATE clients SET portal_first_login = true WHERE id = $1', client.id).catch(() => {})
    void sendWhatsAppMessage(
      client.whatsapp,
      templates.areaClienteAtivada(client.nome, clientAreaUrl())
    ).catch(() => {})
  }
  const msg = templates.clienteCadastrado(client.nome, dataFim.toLocaleDateString('pt-BR'))
  void sendWhatsAppMessage(client.whatsapp, msg).catch(() => {})
  void notifyPanelUsers(
    'clientes_netflix',
    `Novo cliente: ${client.nome} (Netflix)\nWhatsApp: ${client.whatsapp}\nRenovação: ${formatDateBr(dataFim)}`
  )
  if (client.inscricaoPaga === false) {
    void notifyPanelUsers(
      'financeiro',
      `Inscrição Netflix pendente: ${client.nome} — plano ${client.plano}.`
    )
  }
  const roveId = await ensureClientRoveId(client.id)
  res.status(201).json({
    ...stripPortalPinHash({ ...client, valor: Number(client.valor) } as Record<string, unknown>),
    roveId,
    areaClienteAtiva: !!client.portalPinHash,
  })
})

router.patch('/:id', auditLog('update_client', 'client'), async (req, res) => {
  await ensurePortalPinPlainColumn().catch(() => {})
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  const body = req.body
  if (body.whatsapp != null) {
    const whatsapp = normalizeWhatsappOptional(body.whatsapp)
    if (body.whatsapp != null && String(body.whatsapp).trim() !== '' && whatsapp === null) {
      return res.status(400).json({ error: 'Telefone inválido' })
    }
    if (whatsapp) {
      try {
        await ensureUniqueClientWhatsapp(whatsapp, id)
      } catch (err) {
        if (err instanceof Error && err.message === 'whatsapp-duplicate') {
          return res.status(400).json({ error: 'Contacto já existe' })
        }
        throw err
      }
    }
  }
  if (body.perfil != null) {
    const perfil = String(body.perfil).trim()
    if (perfil !== '' && perfil.length < 2) {
      return res.status(400).json({ error: 'Perfil inválido' })
    }
    if (perfil !== '') {
      try {
        await ensureUniqueClientPerfil(perfil, id)
      } catch (err) {
        if (err instanceof Error && err.message === 'perfil-duplicate') {
          return res.status(400).json({ error: 'Perfil já existe' })
        }
        throw err
      }
    }
  }
  if (user.role === 'financeiro') {
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    if (keys.length !== 1 || keys[0] !== 'inscricaoPaga') {
      return res.status(403).json({ error: 'Perfil financeiro só pode marcar inscrição como paga' })
    }
  } else if (!canManageClients(user.role)) {
    return res.status(403).json({ error: 'Sem permissão para alterar clientes' })
  }
  const data: AnyRecord = {}
  if (body.nome != null) data.nome = body.nome
  if (body.whatsapp != null) data.whatsapp = body.whatsapp
  if (body.localizacao !== undefined) data.localizacao = body.localizacao || null
  if (body.plano != null) data.plano = body.plano
  if (body.perfil != null) data.perfil = body.perfil
  if (body.pin !== undefined) data.pin = body.pin || null
  if (body.dataSubscricao != null) data.dataSubscricao = new Date(body.dataSubscricao)
  if (body.dataInicio != null) data.dataInicio = new Date(body.dataInicio)
  // Correção manual só deste cliente (não mexe na sala nem nos outros clientes da sala).
  if (body.dataFim != null) data.dataFim = new Date(body.dataFim)
  if (body.valor != null) data.valor = Number(body.valor)
  if (body.inscricaoPaga !== undefined) data.inscricaoPaga = body.inscricaoPaga === true || body.inscricaoPaga === 'true'
  if (body.salaId !== undefined) {
    const novaSalaId = body.salaId != null && body.salaId !== '' ? Number(body.salaId) : null
    if (novaSalaId != null && !(await prisma.sala.findUnique({ where: { id: novaSalaId }, select: { id: true } }))) {
      return res.status(400).json({ error: 'Sala não encontrada' })
    }
    // Só verifica o limite quando o cliente muda para outra sala.
    if (
      novaSalaId != null &&
      novaSalaId !== existing.salaId &&
      (await lugaresOcupados(novaSalaId, id)) >= MAX_CLIENTES_POR_SALA
    ) {
      return res.status(400).json({ error: `Esta sala já tem ${MAX_CLIENTES_POR_SALA} clientes (máximo). Escolha outra sala.` })
    }
    data.salaId = novaSalaId
  }
  if (body.status != null) data.status = body.status
  if (body.portalPin !== undefined) {
    if (body.portalPin === null || String(body.portalPin).trim() === '') {
      data.portalPinHash = null
    } else if (String(body.portalPin).trim().length < 4) {
      return res.status(400).json({ error: 'PIN da área cliente deve ter pelo menos 4 caracteres' })
    } else {
      const plain = String(body.portalPin).trim()
      data.portalPinHash = await bcrypt.hash(plain, 10)
    }
  }
  const client = await prisma.client.update({ where: { id }, data })
  if (body.portalPin !== undefined) {
    if (body.portalPin === null || String(body.portalPin).trim() === '') {
      await setPortalPinPlainInDb(id, null)
    } else {
      await setPortalPinPlainInDb(id, String(body.portalPin).trim())
    }
    await ensurePortalFirstLoginColumn().catch(() => {})
    const mustChange = !(body.portalPin === null || String(body.portalPin).trim() === '')
    await prisma.$executeRawUnsafe('UPDATE clients SET portal_first_login = $1 WHERE id = $2', mustChange, id).catch(() => {})
  }

  const fimStr = formatDateBr(client.dataFim)
  const hadPortalPin = !!existing.portalPinHash
  const hasPortalPin = !!client.portalPinHash
  if (!hadPortalPin && hasPortalPin && body.portalPin != null && String(body.portalPin).trim() !== '') {
    void sendWhatsAppMessage(
      client.whatsapp,
      templates.areaClienteAtivada(client.nome, clientAreaUrl())
    ).catch(() => {})
  }
  if (body.inscricaoPaga === true && existing.inscricaoPaga !== true) {
    void sendWhatsAppMessage(
      client.whatsapp,
      templates.inscricaoConfirmada(client.nome, client.plano)
    ).catch(() => {})
    void notifyPanelUsers('financeiro', `Inscrição paga: ${client.nome} — plano ${client.plano}.`)
  }
  if (body.status === 'cancelado' && existing.status !== 'cancelado') {
    void sendWhatsAppMessage(client.whatsapp, templates.contaCancelada(client.nome)).catch(() => {})
    void notifyPanelUsers(
      'clientes_netflix',
      `Cliente cancelado: ${client.nome} (${client.whatsapp}).`
    )
  }
  if (body.dataFim != null && !sameCalendarDay(new Date(body.dataFim), existing.dataFim)) {
    void sendWhatsAppMessage(
      client.whatsapp,
      templates.dataRenovacaoAlterada(client.nome, fimStr)
    ).catch(() => {})
  }
  const netflixChanged =
    (body.pin !== undefined && body.pin !== existing.pin) ||
    (body.perfil != null && body.perfil !== existing.perfil)
  if (netflixChanged) {
    void sendWhatsAppMessage(
      client.whatsapp,
      templates.credenciaisNetflixAtualizadas(client.nome, client.perfil)
    ).catch(() => {})
  }

  const roveId = await ensureClientRoveId(client.id)
  res.json({
    ...stripPortalPinHash({ ...client, valor: Number(client.valor) } as Record<string, unknown>),
    roveId,
    areaClienteAtiva: !!client.portalPinHash,
  })
})

/** `atrasoManual` do body: undefined = não enviado; 'auto'/null = automático; true/false = marcado pelo gestor. */
function parseAtrasoManual(v: unknown): boolean | null | undefined {
  if (v === undefined) return undefined
  if (v === true || v === 'true' || v === 'sim') return true
  if (v === false || v === 'false' || v === 'nao') return false
  return null
}

/** Erro `mes-ja-pago:AAAA-MM` de pagamentos.ts → mensagem para o painel. */
function mesJaPagoMensagem(e: unknown): string | null {
  if (!(e instanceof Error) || !e.message.startsWith('mes-ja-pago:')) return null
  const [ano, mes] = e.message.slice('mes-ja-pago:'.length).split('-').map(Number)
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  return `O mês de ${nome} já está pago noutro pagamento.`
}

/**
 * Regista um pagamento de N meses só para este cliente (cria Pagamento + 1 PeriodoPago por mês).
 * Body: meses, valorTotal? (por omissão valor mensal × meses), dataPagamento?, mesInicial?, metodo?, observacoes?,
 * atrasoManual? (omisso = automático)
 * `valor` (mensalidade) e `dias` mantêm-se por compatibilidade com o antigo /renovar.
 */
async function registarPagamentoHandler(req: Request, res: Response) {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, client.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  if (client.status === 'cancelado') return res.status(400).json({ error: 'Cliente cancelado.' })
  const body = req.body ?? {}
  const meses = Number(body.meses) || (body.dias ? Math.max(1, Math.round(Number(body.dias) / 30)) : 1)
  if (meses < 1 || meses > 24) return res.status(400).json({ error: 'Meses inválidos (1 a 24).' })
  if (body.valor != null && Number(body.valor) > 0 && Number(body.valor) !== Number(client.valor)) {
    await prisma.client.update({ where: { id }, data: { valor: Number(body.valor) } })
  }
  const valorTotal = body.valorTotal != null && body.valorTotal !== '' ? Number(body.valorTotal) : null
  if (valorTotal != null && (Number.isNaN(valorTotal) || valorTotal < 0)) {
    return res.status(400).json({ error: 'Valor pago inválido.' })
  }
  let registo: Awaited<ReturnType<typeof registarPagamentoCliente>>
  try {
    registo = await registarPagamentoCliente({
      clientId: id,
      meses,
      valorTotal,
      dataPagamento: optionalDate(body.dataPagamento),
      mesInicial: optionalDate(body.mesInicial ?? body.inicio),
      metodo: body.metodo ? String(body.metodo) : null,
      observacoes: body.observacoes ? String(body.observacoes).trim() : null,
      atrasoManual: parseAtrasoManual(body.atrasoManual) ?? null,
      userId: user.userId,
    })
  } catch (e) {
    const msg = mesJaPagoMensagem(e)
    if (msg) return res.status(400).json({ error: msg })
    throw e
  }
  const { pagamento, dataFim } = registo
  const updated = await prisma.client.findUnique({ where: { id }, include: { sala: true } })
  if (!updated) return res.status(404).json({ error: 'Cliente não encontrado' })
  void sendWhatsAppMessage(
    updated.whatsapp,
    templates.pagamentoMesesRegistado(
      updated.nome,
      pagamento.meses,
      formatDateBr(pagamento.dataPagamento),
      formatDateBr(dataFim)
    )
  ).catch(() => {})
  void notifyPanelUsers(
    'financeiro',
    `Pagamento registado: ${updated.nome} — ${pagamento.meses} mês(es), ${Number(pagamento.valorTotal).toLocaleString('pt-PT')} kz — pago até ${formatDateBr(dataFim)}.`
  )
  res.json({
    ...stripPortalPinHash({ ...updated, valor: Number(updated.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!updated.portalPinHash,
    pagamento: serializePagamento(pagamento),
  })
}

router.post('/:id/renovar', auditLog('renew_client', 'client'), registarPagamentoHandler)
router.post('/:id/pagamentos', auditLog('pay_client', 'client'), registarPagamentoHandler)

router.get('/:id/pagamentos', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, servico: true } })
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, client.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  res.json(await listarPagamentosCliente(id))
})

/** Corrige um pagamento: data em que pagou, meses cobertos (mesInicial + meses), valor, método, atraso. */
router.patch('/:id/pagamentos/:pagamentoId', auditLog('update_client_payment', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessFinanceiro(user.role)) {
    return res.status(403).json({ error: 'Só administradores ou financeiro podem editar pagamentos' })
  }
  const id = Number(req.params.id)
  const body = req.body ?? {}
  if (body.meses != null && (Number(body.meses) < 1 || Number(body.meses) > 24)) {
    return res.status(400).json({ error: 'Meses inválidos (1 a 24).' })
  }
  const valorTotal = body.valorTotal != null && body.valorTotal !== '' ? Number(body.valorTotal) : null
  if (valorTotal != null && (Number.isNaN(valorTotal) || valorTotal < 0)) {
    return res.status(400).json({ error: 'Valor pago inválido.' })
  }
  try {
    const r = await editarPagamentoCliente(id, Number(req.params.pagamentoId), {
      dataPagamento: optionalDate(body.dataPagamento),
      meses: body.meses != null ? Number(body.meses) : null,
      mesInicial: optionalDate(body.mesInicial),
      valorTotal,
      metodo: body.metodo !== undefined ? (body.metodo ? String(body.metodo) : null) : undefined,
      observacoes: body.observacoes !== undefined ? (body.observacoes ? String(body.observacoes).trim() : null) : undefined,
      atrasoManual: parseAtrasoManual(body.atrasoManual),
    })
    if (!r) return res.status(404).json({ error: 'Pagamento não encontrado' })
  } catch (e) {
    const msg = mesJaPagoMensagem(e)
    if (msg) return res.status(400).json({ error: msg })
    throw e
  }
  res.json(await listarPagamentosCliente(id))
})

router.delete('/:id/pagamentos/:pagamentoId', auditLog('delete_client_payment', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessFinanceiro(user.role)) {
    return res.status(403).json({ error: 'Só administradores ou financeiro podem anular pagamentos' })
  }
  const id = Number(req.params.id)
  const removed = await removerPagamentoCliente(id, Number(req.params.pagamentoId))
  if (!removed) return res.status(404).json({ error: 'Pagamento não encontrado' })
  res.json(await listarPagamentosCliente(id))
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

router.post('/:id/inativar', auditLog('suspend_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canManageClients(user.role)) return res.status(403).json({ error: 'Sem permissão para inativar clientes' })
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  if (existing.status === 'inativo') return res.status(400).json({ error: 'Cliente já está inativo.' })
  const updated = await prisma.client.update({
    where: { id },
    data: { status: 'inativo', whatsappNotificadoVencimentoAt: new Date() },
  })
  void notifyPanelUsers(
    'clientes_netflix',
    `Cliente inativado: ${updated.nome} (${updated.whatsapp}).`
  )
  res.json({
    ...stripPortalPinHash({ ...updated, valor: Number(updated.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!updated.portalPinHash,
  })
})

router.post('/:id/suspender', auditLog('suspend_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canManageClients(user.role)) return res.status(403).json({ error: 'Sem permissão para suspender clientes' })
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  const updated = await prisma.client.update({
    where: { id },
    data: { status: 'inativo', whatsappNotificadoVencimentoAt: new Date() },
  })
  void notifyPanelUsers(
    'clientes_netflix',
    `Cliente inativado: ${updated.nome} (${updated.whatsapp}).`
  )
  res.json({
    ...stripPortalPinHash({ ...updated, valor: Number(updated.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!updated.portalPinHash,
  })
})

/** Próximo dia 10 (limite de renovação) a partir de hoje: o cliente reativado tem até lá para pagar. */
function proximoLimiteRenovacao(): Date {
  const hoje = startOfToday()
  const limite = limiteRenovacaoDoMes(hoje)
  if (hoje <= limite) return limite
  return limiteRenovacaoDoMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1))
}

router.post('/:id/ativar', auditLog('activate_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  const dataFim = proximoLimiteRenovacao()
  const updated = await prisma.client.update({
    where: { id },
    data: { status: 'ativo', dataFim, whatsappNotificadoVencimentoAt: null },
  })
  const fimStr = dataFim.toLocaleDateString('pt-BR')
  const msgAtiv = templates.reativado(updated.nome, fimStr)
  void sendWhatsAppMessage(updated.whatsapp, msgAtiv).catch(() => {})
  void notifyPanelUsers(
    'clientes_netflix',
    `Cliente reativado: ${updated.nome} — renovação ${fimStr}.`
  )
  res.json({
    ...stripPortalPinHash({ ...updated, valor: Number(updated.valor) } as Record<string, unknown>),
    areaClienteAtiva: !!updated.portalPinHash,
  })
})

router.delete('/:id', auditLog('delete_client', 'client'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canManageClients(user.role)) return res.status(403).json({ error: 'Sem permissão para eliminar clientes' })
  const id = Number(req.params.id)
  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (!canAccessServico(user.role, existing.servico)) return res.status(403).json({ error: 'Sem acesso a este cliente' })
  void sendWhatsAppMessage(existing.whatsapp, templates.contaEncerrada(existing.nome)).catch(() => {})
  void notifyPanelUsers(
    'clientes_netflix',
    `Cliente eliminado: ${existing.nome} (${existing.whatsapp}).`
  )
  await prisma.client.delete({ where: { id } })
  res.status(204).send()
})

export default router
