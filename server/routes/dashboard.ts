import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, canAccessSalas } from '../middleware/auth.js'
import type { AuthPayload } from '../middleware/auth.js'
import { orcamentoMensalSalas, salaCustoMensal } from '../lib/salasConfig.js'
import { ensurePagamentosTables, limiteRenovacaoDoMes } from '../lib/pagamentos.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Atualizar automaticamente para vencido: clientes ativos cuja dataFim já passou
  await prisma.client.updateMany({
    where: { servico: 'netflix', status: 'ativo', dataFim: { lt: today } },
    data: { status: 'vencido' },
  })

  const servico = 'netflix'
  const clientWhereBase = { status: 'ativo' as const, servico }
  const vencendoWhere = {
    ...clientWhereBase,
    dataFim: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
  }
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)
  const vencendoEm7DiasWhere = { ...clientWhereBase, dataFim: { gte: today, lte: in7Days } }
  // Salas a vencer (pagamento/data fim nos próximos 7 dias) e já vencidas – antecipar alertas
  const salasVencendoWhere = { status: 'ativo' as const, dataFim: { gte: today, lte: in7Days } }
  const salasVencidasWhere = { status: 'ativo' as const, dataFim: { lt: today } }
  const inicioMes = new Date(today.getFullYear(), today.getMonth(), 1)
  const fimMes = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const inicioMesAnterior = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const fimMesAnterior = new Date(today.getFullYear(), today.getMonth(), 0)

  const [
    totalNetflix,
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
    clients,
    vencidosValores,
    salasVencendo,
    salasVencidas,
    salas,
    totalSalasAtivas,
  ] = await Promise.all([
    prisma.client.count({ where: clientWhereBase }),
    prisma.client.count({ where: vencendoWhere }),
    prisma.client.count({ where: vencendoEm7DiasWhere }),
    prisma.client.count({ where: { status: 'vencido', servico } }),
    prisma.client.count({ where: { status: 'cancelado', servico } }),
    prisma.client.count({ where: { servico, createdAt: { gte: inicioMes, lte: fimMes } } }),
    prisma.indicacao.count(),
    prisma.indicacao.count({ where: { status: 'pendente' } }),
    prisma.indicacao.count({ where: { status: 'confirmada' } }),
    prisma.indicacao.count({
      where: { createdAt: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.client
      .findMany({
        where: { servico, dataFim: { gte: inicioMesAnterior, lte: fimMesAnterior } },
        select: { valor: true },
      })
      .then((arr) => arr.reduce((s, c) => s + Number(c.valor), 0)),
    prisma.client.findMany({
      where: clientWhereBase,
      select: { valor: true, dataFim: true },
    }),
    prisma.client.findMany({
      where: { servico, status: { in: ['vencido', 'Vencido'] } },
      select: { valor: true },
    }),
    canAccessSalas(user.role) ? prisma.sala.count({ where: salasVencendoWhere }) : 0,
    canAccessSalas(user.role) ? prisma.sala.count({ where: salasVencidasWhere }) : 0,
    canAccessSalas(user.role)
      ? prisma.sala.findMany({
          select: {
            id: true,
            nome: true,
            _count: { select: { clients: true } },
          },
        })
      : [],
    canAccessSalas(user.role) ? prisma.sala.count({ where: { status: 'ativo' } }) : 0,
  ])

  const round2 = (n: number) => Math.round(n * 100) / 100

  // Receita do mês = soma dos valores dos clientes cujo vencimento (dataFim) cai no mês atual (dia 1 a fim do mês)
  const receitaMes = clients
    .filter((c) => {
      const df = new Date(c.dataFim)
      return df >= inicioMes && df <= fimMes
    })
    .reduce((s, c) => s + Number(c.valor), 0)

  // Receita mensal projetada = soma de todos os valores dos clientes ativos (quanto entra por mês)
  const receitaMensalProjetada = clients.reduce((s, c) => s + Number(c.valor), 0)

  // Valor em dívida (clientes vencidos)
  const valorVencido = (vencidosValores || []).reduce(
    (s, v) => s + (v.valor != null ? Number(v.valor) : 0),
    0
  )

  // Últimos 6 meses: receita (soma de valor onde dataFim cai no mês)
  const receitaUltimosMeses: { mes: string; valor: number }[] = []
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const total = clients
      .filter((c) => {
        const df = new Date(c.dataFim)
        return df >= start && df <= end
      })
      .reduce((s, c) => s + Number(c.valor), 0)
    receitaUltimosMeses.push({ mes: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, valor: round2(total) })
  }

  const receitaMesVal = round2(receitaMes)
  const receitaMesAntVal = round2(receitaMesAnterior || 0)
  const variacaoReceita =
    receitaMesAntVal > 0 ? Math.round(((receitaMesVal - receitaMesAntVal) / receitaMesAntVal) * 1000) / 10 : 0
  const receitaProjetadaVal = round2(receitaMensalProjetada)
  // Orçamento das salas: nº de salas ativas × custo mensal por sala.
  const custoSalasNetflixVal = round2(orcamentoMensalSalas(Number(totalSalasAtivas || 0)))

  // Arrecadação do mês atual.
  // - Previsto: soma das mensalidades de todos os clientes que devem pagar (ativos + vencidos).
  // - Já arrecadado: pagamentos registados no painel com data deste mês.
  // - Falta arrecadar: clientes cujo mês atual ainda não está pago (data fim antes do dia 10 do mês seguinte).
  const limiteMesAtualPago = limiteRenovacaoDoMes(new Date(today.getFullYear(), today.getMonth() + 1, 1))
  const [pagantes, arrecadadoMes] = await Promise.all([
    prisma.client.findMany({
      where: { servico, status: { in: ['ativo', 'vencido'] } },
      select: { valor: true, dataFim: true },
    }),
    ensurePagamentosTables()
      .then(() =>
        prisma.pagamento.aggregate({
          _sum: { valorTotal: true },
          _count: true,
          where: {
            origem: 'painel',
            dataPagamento: { gte: inicioMes, lt: new Date(today.getFullYear(), today.getMonth() + 1, 1) },
            client: { servico },
          },
        })
      )
      .catch(() => ({ _sum: { valorTotal: 0 }, _count: 0 })),
  ])
  const previstoMensal = pagantes.reduce((s, c) => s + Number(c.valor), 0)
  const porPagar = pagantes.filter((c) => new Date(c.dataFim) < limiteMesAtualPago)
  const arrecadacaoMes = {
    mes: today.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
    previsto: round2(previstoMensal),
    previstoClientes: pagantes.length,
    arrecadado: round2(Number(arrecadadoMes._sum.valorTotal ?? 0)),
    pagamentos: arrecadadoMes._count,
    porArrecadar: round2(porPagar.reduce((s, c) => s + Number(c.valor), 0)),
    clientesPorPagar: porPagar.length,
    lucroPrevisto: round2(previstoMensal - custoSalasNetflixVal),
  }

  res.json({
    totalNetflix,
    totalClientes: totalNetflix,
    clientesVencidos,
    clientesCancelados,
    vencendoHoje,
    vencendoEm7Dias,
    clientesNovosEsteMes,
    clientsBySala: canAccessSalas(user.role)
      ? salas.map((s: { id: number; nome: string; _count: { clients: number } }) => ({
          id: s.id,
          nome: s.nome,
          totalClientes: s._count.clients,
        }))
      : [],
    receitaMes: receitaMesVal,
    receitaMesAnterior: receitaMesAntVal,
    variacaoReceita,
    receitaMensalProjetada: receitaProjetadaVal,
    valorVencidoTotal: round2(valorVencido),
    indicacoesTotal,
    indicacoesPendentes,
    indicacoesConfirmadas,
    indicacoesEsteMes,
    receitaUltimosMeses,
    salasVencendo: salasVencendo ?? 0,
    salasVencidas: salasVencidas ?? 0,
    custoSalasNetflix: custoSalasNetflixVal,
    custoPorSala: salaCustoMensal(),
    lucroEstimado: round2(receitaProjetadaVal - custoSalasNetflixVal),
    totalSalasAtivas: totalSalasAtivas ?? 0,
    arrecadacaoMes,
  })
})

export default router
