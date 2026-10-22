import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, canAccessSalas, canManageSalas } from '../middleware/auth.js'
import type { AuthPayload } from '../middleware/auth.js'
import { auditLog } from '../middleware/audit.js'
import { templates } from '../services/whatsapp.js'
import { notifyPanelUsers, notifySalaClients, formatDateBr } from '../lib/whatsappNotify.js'
import { addMonthsKeepingBillingDay, ensurePagamentosTables } from '../lib/pagamentos.js'
import { MAX_CLIENTES_POR_SALA, lugaresOcupados, salaCustoMensal } from '../lib/salasConfig.js'

const router = Router()

/** Garante que a coluna status existe em salas (para quando o Prisma Client ainda não foi regenerado). */
async function ensureSalaStatusColumn(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE salas ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo'
  `)
}

router.use(authMiddleware)

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessSalas(user.role)) return res.status(403).json({ error: 'Sem acesso a salas' })
  await ensureSalaStatusColumn().catch(() => {})
  const list = await prisma.sala.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { clients: true } } },
  })
  let statusMap: Record<number, string> = {}
  try {
    const withStatus = await prisma.$queryRawUnsafe<Array<{ id: number; status: string }>>(
      'SELECT id, status FROM salas ORDER BY nome ASC'
    )
    statusMap = Object.fromEntries((withStatus ?? []).map((r) => [r.id, r.status]))
  } catch {
    // coluna status pode não existir ainda
  }
  // Lugares ocupados (clientes não cancelados) para mostrar "x/5" e bloquear salas cheias.
  const ocupadosRows = await prisma.client.groupBy({
    by: ['salaId'],
    where: { salaId: { not: null }, status: { not: 'cancelado' } },
    _count: { _all: true },
  })
  const ocupadosMap = new Map(ocupadosRows.map((r) => [r.salaId as number, r._count._all]))
  res.json(
    list.map((s) => {
      const { _count, ...rest } = s
      return {
        ...rest,
        status: statusMap[s.id] ?? 'ativo',
        totalClientes: _count.clients,
        lugaresOcupados: ocupadosMap.get(s.id) ?? 0,
        maxClientes: MAX_CLIENTES_POR_SALA,
      }
    })
  )
})

router.post('/', auditLog('create_sala', 'sala'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canManageSalas(user.role)) return res.status(403).json({ error: 'Sem permissão para criar salas' })
  const { nome, email, senha, observacoes, dataFim } = req.body
  if (!nome || String(nome).trim() === '') return res.status(400).json({ error: 'Nome da sala é obrigatório' })
  await ensureSalaStatusColumn()
  const sala = await prisma.sala.create({
    data: {
      nome: String(nome).trim(),
      email: email != null && String(email).trim() !== '' ? String(email).trim() : null,
      senha: senha != null && String(senha) !== '' ? String(senha) : null,
      observacoes: observacoes != null ? String(observacoes).trim() || null : null,
      dataFim: dataFim ? new Date(dataFim) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  const withStatus = await prisma.$queryRawUnsafe<Array<{ status: string }>>('SELECT status FROM salas WHERE id = $1', sala.id).then((r) => r[0])
  void notifyPanelUsers('salas', `Nova sala Netflix: "${sala.nome}" — renovação ${formatDateBr(sala.dataFim ?? new Date())}.`)
  res.status(201).json({ ...sala, status: withStatus?.status ?? 'ativo' })
})

// Rotas com path específico antes de /:id para não serem capturadas por outras
router.post('/:id/suspender', auditLog('suspend_sala', 'sala'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canManageSalas(user.role)) return res.status(403).json({ error: 'Sem permissão para suspender salas' })
  const id = Number(req.params.id)
  const existing = await prisma.sala.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Sala não encontrada' })
  try {
    await ensureSalaStatusColumn()
    await prisma.$executeRawUnsafe('UPDATE salas SET status = $1 WHERE id = $2', 'suspenso', id)
    const [row] = await prisma.$queryRawUnsafe<Array<{ id: number; nome: string; observacoes: string | null; data_fim: Date | null; status: string; createdAt: Date; updatedAt: Date }>>(
      'SELECT id, nome, observacoes, data_fim, status, "createdAt", "updatedAt" FROM salas WHERE id = $1',
      id
    )
    const countResult = await prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int as count FROM clients WHERE sala_id = $1', id)
    const totalClientes = countResult[0]?.count ?? 0
    if (!row) return res.status(500).json({ error: 'Erro ao obter sala após suspender' })
    void notifySalaClients(id, (nome) => templates.salaSuspensa(nome, row.nome))
    void notifyPanelUsers('salas', `Sala Netflix suspensa: "${row.nome}" (${totalClientes} cliente(s)).`)
    res.json({
      id: row.id,
      nome: row.nome,
      observacoes: row.observacoes,
      dataFim: row.data_fim,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      totalClientes,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao suspender'
    res.status(500).json({ error: message })
  }
})

router.post('/:id/ativar', auditLog('activate_sala', 'sala'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canManageSalas(user.role)) return res.status(403).json({ error: 'Sem permissão para ativar salas' })
  const id = Number(req.params.id)
  const existing = await prisma.sala.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Sala não encontrada' })
  try {
    await ensureSalaStatusColumn()
    await prisma.$executeRawUnsafe('UPDATE salas SET status = $1 WHERE id = $2', 'ativo', id)
    const [row] = await prisma.$queryRawUnsafe<Array<{ id: number; nome: string; observacoes: string | null; data_fim: Date | null; status: string; createdAt: Date; updatedAt: Date }>>(
      'SELECT id, nome, observacoes, data_fim, status, "createdAt", "updatedAt" FROM salas WHERE id = $1',
      id
    )
    const countResult = await prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int as count FROM clients WHERE sala_id = $1', id)
    const totalClientes = countResult[0]?.count ?? 0
    if (!row) return res.status(500).json({ error: 'Erro ao obter sala após ativar' })
    const fimStr = row.data_fim ? formatDateBr(row.data_fim) : '—'
    void notifySalaClients(id, (nome) => templates.salaReativada(nome, row.nome, fimStr))
    void notifyPanelUsers('salas', `Sala Netflix reativada: "${row.nome}" — renovação ${fimStr}.`)
    res.json({
      id: row.id,
      nome: row.nome,
      observacoes: row.observacoes,
      dataFim: row.data_fim,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      totalClientes,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao ativar'
    res.status(500).json({ error: message })
  }
})

router.post('/:id/pagar-mes', auditLog('pay_sala_month', 'sala'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessSalas(user.role)) return res.status(403).json({ error: 'Sem acesso a salas' })
  const id = Number(req.params.id)
  const existing = await prisma.sala.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Sala não encontrada' })

  // Regra do negócio: pagamento de sala soma N meses (por omissão 1) à data fim da própria sala,
  // mantendo o mesmo dia de cobrança. A data fim dos clientes NÃO muda: cada cliente tem os seus meses pagos.
  const meses = Math.min(24, Math.max(1, Math.round(Number(req.body?.meses) || 1)))
  const valorMensal = salaCustoMensal()
  const valor =
    req.body?.valor != null && req.body.valor !== '' && !Number.isNaN(Number(req.body.valor))
      ? Number(req.body.valor)
      : valorMensal * meses
  const dataPagamento = req.body?.dataPagamento ? new Date(req.body.dataPagamento) : new Date()
  const baseDate = existing.dataFim ?? new Date()
  const nextMonth = addMonthsKeepingBillingDay(baseDate, meses)

  await ensurePagamentosTables()
  const [sala] = await prisma.$transaction([
    prisma.sala.update({
      where: { id },
      data: { dataFim: nextMonth },
    }),
    prisma.pagamentoSala.create({
      data: {
        salaId: id,
        dataPagamento: Number.isNaN(dataPagamento.getTime()) ? new Date() : dataPagamento,
        meses,
        valor,
        periodoInicio: addMonthsKeepingBillingDay(baseDate, 0),
        periodoFim: nextMonth,
        userId: user.userId,
      },
    }),
  ])

  const countResult = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    'SELECT COUNT(*)::int as count FROM clients WHERE sala_id = $1',
    id
  )
  const totalClientes = countResult[0]?.count ?? 0

  let statusVal = 'ativo'
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
      'SELECT status FROM salas WHERE id = $1',
      id
    ).then((r) => r[0])
    statusVal = row?.status ?? 'ativo'
  } catch {
    // coluna status pode não existir
  }

  const fimStr = formatDateBr(nextMonth)
  // Os clientes recebem a sua própria data (meses que pagaram), não a data da sala.
  void notifySalaClients(id, (nome, fimCliente) => templates.salaContaRenovada(nome, sala.nome, fimCliente))
  void notifyPanelUsers(
    'salas',
    `Conta Netflix renovada: sala "${sala.nome}" — ${meses} mês(es) — ${totalClientes} cliente(s) — próxima renovação ${fimStr}.`
  )

  res.json({ ...sala, status: statusVal, totalClientes })
})

router.get('/:id/pagamentos', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessSalas(user.role)) return res.status(403).json({ error: 'Sem acesso a salas' })
  await ensurePagamentosTables()
  const rows = await prisma.pagamentoSala.findMany({
    where: { salaId: Number(req.params.id) },
    orderBy: [{ dataPagamento: 'desc' }, { id: 'desc' }],
  })
  res.json(rows.map((r) => ({ ...r, valor: Number(r.valor) })))
})

router.get('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessSalas(user.role)) return res.status(403).json({ error: 'Sem acesso a salas' })
  await ensurePagamentosTables()
  // Detalhes da sala: dados da conta, clientes (só campos necessários, sem PINs da área cliente) e pagamentos da conta.
  const s = await prisma.sala.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      clients: {
        where: { servico: 'netflix' },
        select: {
          id: true,
          roveId: true,
          nome: true,
          whatsapp: true,
          plano: true,
          perfil: true,
          pin: true,
          dataFim: true,
          valor: true,
          status: true,
        },
        orderBy: { nome: 'asc' },
      },
      pagamentos: { orderBy: [{ dataPagamento: 'desc' }, { id: 'desc' }] },
    },
  })
  if (!s) return res.status(404).json({ error: 'Sala não encontrada' })
  res.json({
    ...s,
    clients: s.clients.map((c) => ({ ...c, valor: Number(c.valor) })),
    pagamentos: s.pagamentos.map((p) => ({ ...p, valor: Number(p.valor) })),
  })
})

router.patch('/:id', auditLog('update_sala', 'sala'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canManageSalas(user.role)) return res.status(403).json({ error: 'Sem permissão para editar salas' })
  const id = Number(req.params.id)
  const existing = await prisma.sala.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Sala não encontrada' })
  const { nome, email, senha, observacoes, dataFim, status } = req.body
  const update: Record<string, unknown> = {}
  if (nome != null) update.nome = String(nome).trim()
  if (email !== undefined) update.email = email != null && String(email).trim() !== '' ? String(email).trim() : null
  if (senha !== undefined) update.senha = senha != null && String(senha) !== '' ? String(senha) : null
  if (observacoes !== undefined) update.observacoes = observacoes != null && String(observacoes).trim() !== '' ? String(observacoes).trim() : null
  if (dataFim !== undefined) update.dataFim = dataFim ? new Date(dataFim) : null
  if (Object.keys(update).length > 0) {
    await prisma.sala.update({ where: { id }, data: update })
  }
  if (status != null) {
    await ensureSalaStatusColumn()
    await prisma.$executeRawUnsafe('UPDATE salas SET status = $1 WHERE id = $2', status, id)
  }
  const sala = await prisma.sala.findUnique({ where: { id } })
  if (!sala) return res.status(500).json({ error: 'Sala não encontrada' })
  const countResult = await prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int as count FROM clients WHERE sala_id = $1', id)
  const totalClientes = countResult[0]?.count ?? 0
  let statusVal = 'ativo'
  try {
    const row = await prisma.$queryRawUnsafe<Array<{ status: string }>>('SELECT status FROM salas WHERE id = $1', id).then((r) => r[0])
    statusVal = row?.status ?? 'ativo'
  } catch {
    // coluna status pode não existir
  }
  res.json({ ...sala, status: statusVal, totalClientes })
})

router.delete('/:id', auditLog('delete_sala', 'sala'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canManageSalas(user.role)) return res.status(403).json({ error: 'Sem permissão para eliminar salas' })
  const id = Number(req.params.id)
  const existing = await prisma.sala.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Sala não encontrada' })
  // ?transferirPara=<id>: os clientes passam para essa sala; sem parâmetro ficam sem sala.
  const destinoId = req.query.transferirPara ? Number(req.query.transferirPara) : null
  let destino: { id: number; nome: string } | null = null
  if (destinoId != null) {
    if (!Number.isInteger(destinoId) || destinoId === id) {
      return res.status(400).json({ error: 'Sala de destino inválida' })
    }
    destino = await prisma.sala.findUnique({ where: { id: destinoId }, select: { id: true, nome: true } })
    if (!destino) return res.status(400).json({ error: 'Sala de destino não encontrada' })
    const aTransferir = await lugaresOcupados(id)
    const ocupados = await lugaresOcupados(destino.id)
    if (ocupados + aTransferir > MAX_CLIENTES_POR_SALA) {
      return res.status(400).json({
        error: `A sala "${destino.nome}" tem ${ocupados} cliente(s); não cabem mais ${aTransferir} (máximo ${MAX_CLIENTES_POR_SALA} por sala).`,
      })
    }
  }
  const [moved] = await prisma.$transaction([
    prisma.client.updateMany({ where: { salaId: id }, data: { salaId: destino?.id ?? null } }),
    prisma.sala.delete({ where: { id } }),
  ])
  void notifyPanelUsers(
    'salas',
    destino
      ? `Sala Netflix eliminada: "${existing.nome}" — ${moved.count} cliente(s) transferido(s) para "${destino.nome}".`
      : `Sala Netflix eliminada: "${existing.nome}" — ${moved.count} cliente(s) ficaram sem sala.`
  )
  res.status(204).send()
})

export default router
