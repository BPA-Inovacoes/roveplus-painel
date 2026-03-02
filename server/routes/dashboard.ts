import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, getRoleServicoFilter, canAccessServidores } from '../middleware/auth.js'
import type { AuthPayload } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const roleFilter = getRoleServicoFilter(user.role)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const clientWhereBase = { status: 'ativo' as const }
  const clientWhereNetflix = { ...clientWhereBase, servico: 'netflix' }
  const clientWhereIptv = { ...clientWhereBase, servico: 'iptv' }
  const vencendoWhere = {
    status: 'ativo' as const,
    dataFim: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
  }
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)
  const vencendoEm7DiasWhere = {
    status: 'ativo' as const,
    dataFim: { gte: today, lte: in7Days },
  }
  const inicioMes = new Date(today.getFullYear(), today.getMonth(), 1)
  const fimMes = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const inicioMesAnterior = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const fimMesAnterior = new Date(today.getFullYear(), today.getMonth(), 0)

  const clientWhereRole = roleFilter ? { servico: roleFilter } : {}
  const clientWhereVencido = { status: 'vencido' as const, ...clientWhereRole }
  const clientWhereCancelado = { status: 'cancelado' as const, ...clientWhereRole }

  const [
    totalNetflix,
    totalIptv,
    servidores,
    vencendoHoje,
    vencendoEm7Dias,
    clientesVencidos,
    clientesCancelados,
    clientesNovosEsteMes,
    indicacoesTotal,
    indicacoesPendentes,
    indicacoesConfirmadas,
    indicacoesEsteMes,
    receitaMesAnterior,
    totalRevendedores,
    clientesComRevendedor,
    clients,
  ] = await Promise.all([
    roleFilter === 'iptv' ? 0 : prisma.client.count({ where: clientWhereNetflix }),
    roleFilter === 'netflix' ? 0 : prisma.client.count({ where: clientWhereIptv }),
    canAccessServidores(user.role) ? prisma.servidor.findMany({
      select: {
        id: true,
        nome: true,
        status: true,
        _count: { select: { clients: true } },
      },
    }) : [],
    prisma.client.count({
      where: roleFilter ? { ...vencendoWhere, servico: roleFilter } : vencendoWhere,
    }),
    prisma.client.count({
      where: roleFilter ? { ...vencendoEm7DiasWhere, servico: roleFilter } : vencendoEm7DiasWhere,
    }),
    prisma.client.count({ where: clientWhereVencido }),
    prisma.client.count({ where: clientWhereCancelado }),
    prisma.client.count({
      where: { ...clientWhereRole, createdAt: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.indicacao.count(),
    prisma.indicacao.count({ where: { status: 'pendente' } }),
    prisma.indicacao.count({ where: { status: 'confirmada' } }),
    prisma.indicacao.count({
      where: { createdAt: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.client.findMany({
      where: roleFilter ? { servico: roleFilter, dataFim: { gte: inicioMesAnterior, lte: fimMesAnterior } } : { dataFim: { gte: inicioMesAnterior, lte: fimMesAnterior } },
      select: { valor: true },
    }).then((arr) => arr.reduce((s, c) => s + Number(c.valor), 0)),
    canAccessServidores(user.role) ? prisma.revendedor.count() : 0,
    canAccessServidores(user.role) ? prisma.client.count({ where: { ...clientWhereRole, revendedorId: { not: null } } }) : 0,
    prisma.client.findMany({
      where: roleFilter ? { ...clientWhereBase, servico: roleFilter } : clientWhereBase,
      select: { valor: true, dataFim: true },
    }),
  ])

  const receitaMes = clients
    .filter((c) => c.dataFim >= inicioMes && c.dataFim <= today)
    .reduce((s, c) => s + Number(c.valor), 0)

  // Últimos 6 meses: receita (soma de valor onde dataFim cai no mês)
  const receitaUltimosMeses: { mes: string; valor: number }[] = []
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const total = clients
      .filter((c) => c.dataFim >= start && c.dataFim <= end)
      .reduce((s, c) => s + Number(c.valor), 0)
    receitaUltimosMeses.push({
      mes: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      valor: Math.round(total * 100) / 100,
    })
  }

  const receitaMesVal = Math.round(receitaMes * 100) / 100
  const receitaMesAntVal = Math.round((receitaMesAnterior || 0) * 100) / 100
  const variacaoReceita =
    receitaMesAntVal > 0 ? Math.round(((receitaMesVal - receitaMesAntVal) / receitaMesAntVal) * 1000) / 10 : 0

  res.json({
    totalNetflix: roleFilter === 'iptv' ? 0 : totalNetflix,
    totalIptv: roleFilter === 'netflix' ? 0 : totalIptv,
    totalClientes: totalNetflix + totalIptv,
    clientesVencidos,
    clientesCancelados,
    vencendoHoje,
    vencendoEm7Dias,
    clientesNovosEsteMes,
    clientsByServidor: canAccessServidores(user.role)
      ? servidores.map((s: { id: number; nome: string; status: string; _count: { clients: number } }) => ({
          id: s.id,
          nome: s.nome,
          status: s.status,
          totalClientes: s._count.clients,
        }))
      : [],
    receitaMes: receitaMesVal,
    receitaMesAnterior: receitaMesAntVal,
    variacaoReceita,
    indicacoesTotal,
    indicacoesPendentes,
    indicacoesConfirmadas,
    indicacoesEsteMes,
    totalRevendedores: totalRevendedores ?? 0,
    clientesComRevendedor: clientesComRevendedor ?? 0,
    receitaUltimosMeses,
  })
})

export default router
