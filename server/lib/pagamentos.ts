import { prisma } from './prisma.js'

/**
 * Pagamentos de clientes (meses pagos) e pagamentos de salas.
 * - Pagamento: 1 linha por pagamento do cliente (dia em que pagou, nº de meses, valor).
 * - PeriodoPago: 1 linha por mês coberto; o cron usa `fim` + `notificadoAt` para avisar o cliente.
 * - Client.dataFim continua a existir como atalho = fim do último período pago.
 */

let ensurePromise: Promise<void> | null = null

/** Cria as tabelas se ainda não existirem (bases sem `prisma db push`). Corre uma vez por instância. */
export function ensurePagamentosTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS pagamentos (
          id SERIAL PRIMARY KEY,
          client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE ON UPDATE CASCADE,
          sala_id INTEGER,
          data_pagamento TIMESTAMP(3) NOT NULL,
          meses INTEGER NOT NULL,
          valor_total DECIMAL(10,2) NOT NULL,
          metodo TEXT,
          observacoes TEXT,
          origem TEXT NOT NULL DEFAULT 'painel',
          user_id INTEGER,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await prisma.$executeRawUnsafe(`ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS atraso_manual BOOLEAN`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS pagamentos_client_id_idx ON pagamentos(client_id)`)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS periodos_pagos (
          id SERIAL PRIMARY KEY,
          pagamento_id INTEGER NOT NULL REFERENCES pagamentos(id) ON DELETE CASCADE ON UPDATE CASCADE,
          client_id INTEGER NOT NULL,
          numero INTEGER NOT NULL,
          inicio TIMESTAMP(3) NOT NULL,
          fim TIMESTAMP(3) NOT NULL,
          valor DECIMAL(10,2) NOT NULL,
          notificado_at TIMESTAMP(3)
        )
      `)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS periodos_pagos_client_id_fim_idx ON periodos_pagos(client_id, fim)`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS periodos_pagos_fim_idx ON periodos_pagos(fim)`)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS pagamentos_sala (
          id SERIAL PRIMARY KEY,
          sala_id INTEGER NOT NULL REFERENCES salas(id) ON DELETE CASCADE ON UPDATE CASCADE,
          data_pagamento TIMESTAMP(3) NOT NULL,
          meses INTEGER NOT NULL,
          valor DECIMAL(10,2) NOT NULL,
          periodo_inicio TIMESTAMP(3) NOT NULL,
          periodo_fim TIMESTAMP(3) NOT NULL,
          user_id INTEGER,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS pagamentos_sala_sala_id_idx ON pagamentos_sala(sala_id)`)
    })().catch((e) => {
      ensurePromise = null
      throw e
    })
  }
  return ensurePromise
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Soma meses preservando o dia de cobrança.
 * Ex.: 31/01 + 1 → 28/02; 31/01 + 2 → 31/03 (calculado sempre a partir da base).
 */
export function addMonthsKeepingBillingDay(base: Date, months: number): Date {
  const d = new Date(base)
  d.setHours(0, 0, 0, 0)
  const billingDay = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(billingDay, lastDay))
  return d
}

/**
 * Regra de renovação: cada pagamento cobre meses de calendário. Quem pagou o mês M renova entre
 * o dia 1 e o dia 10 do mês M+1; a partir do dia 11 fica vencido. Por isso Client.dataFim = dia 10
 * do mês seguinte ao último mês pago.
 */
export const DIA_LIMITE_RENOVACAO = 10

export function inicioDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Data limite de renovação (dia 10) do mês indicado. */
export function limiteRenovacaoDoMes(mes: Date): Date {
  return new Date(mes.getFullYear(), mes.getMonth(), DIA_LIMITE_RENOVACAO)
}

/**
 * Primeiro mês ainda por pagar, a partir da data fim atual do cliente.
 * Data fim no dia 10 (regra atual) → esse mês. Datas antigas: até dia 15 conta esse mês, depois o seguinte.
 * Nunca antes do mês corrente: um cliente vencido há meses paga a partir do mês atual.
 */
export function proximoMesAPagar(dataFim: Date, today = startOfToday()): Date {
  const d = new Date(dataFim)
  const proximo = new Date(d.getFullYear(), d.getMonth() + (d.getDate() > 15 ? 1 : 0), 1)
  const atual = inicioDoMes(today)
  return proximo > atual ? proximo : atual
}

/** Períodos (meses de calendário) cobertos por N meses a partir de `mesInicial`, e a nova data fim (dia 10). */
export function calcularCobertura(mesInicial: Date, meses: number) {
  const base = inicioDoMes(mesInicial)
  const periodos = Array.from({ length: meses }, (_, i) => ({
    inicio: new Date(base.getFullYear(), base.getMonth() + i, 1),
    fim: new Date(base.getFullYear(), base.getMonth() + i + 1, 1),
  }))
  return { periodos, dataFim: limiteRenovacaoDoMes(new Date(base.getFullYear(), base.getMonth() + meses, 1)) }
}

/** Data fim do cliente a partir do fim de um período: períodos de calendário → dia 10; antigos → o próprio fim. */
function dataFimDoPeriodo(fim: Date): Date {
  return fim.getDate() === 1 ? limiteRenovacaoDoMes(fim) : fim
}

/**
 * Mês de calendário que um período cobre. Períodos de calendário começam no dia 1;
 * períodos antigos (dia de cobrança) contam o próprio mês até ao dia 15, depois o seguinte (como proximoMesAPagar).
 */
export function mesCoberto(inicio: Date): Date {
  const d = new Date(inicio)
  return new Date(d.getFullYear(), d.getMonth() + (d.getDate() > 15 ? 1 : 0), 1)
}

function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Lança `mes-ja-pago:<AAAA-MM>` se algum dos meses já estiver coberto por outro pagamento do cliente. */
async function garantirMesesLivres(clientId: number, meses: Date[], ignorarPagamentoId?: number) {
  const existentes = await prisma.periodoPago.findMany({
    where: { clientId, ...(ignorarPagamentoId ? { NOT: { pagamentoId: ignorarPagamentoId } } : {}) },
    select: { inicio: true },
  })
  const ocupados = new Set(existentes.map((p) => chaveMes(mesCoberto(p.inicio))))
  const repetido = meses.find((m) => ocupados.has(chaveMes(m)))
  if (repetido) throw new Error(`mes-ja-pago:${chaveMes(repetido)}`)
}

/** Recalcula Client.dataFim (e ativo/vencido) a partir do último período pago. */
async function sincronizarDataFim(clientId: number) {
  const ultimo = await prisma.periodoPago.findFirst({ where: { clientId }, orderBy: { fim: 'desc' } })
  if (!ultimo) return null
  const dataFim = dataFimDoPeriodo(ultimo.fim)
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { status: true } })
  const today = startOfToday()
  await prisma.client.update({
    where: { id: clientId },
    data: {
      dataFim,
      ...(client?.status === 'ativo' && dataFim < today ? { status: 'vencido' } : {}),
      ...(client?.status === 'vencido' && dataFim >= today ? { status: 'ativo', whatsappNotificadoVencimentoAt: null } : {}),
    },
  })
  return dataFim
}

/** Nº de meses (mín. 1) entre duas datas, arredondado. */
export function mesesEntre(inicio: Date, fim: Date): number {
  const months =
    (fim.getFullYear() - inicio.getFullYear()) * 12 +
    (fim.getMonth() - inicio.getMonth()) +
    (fim.getDate() - inicio.getDate()) / 30
  return Math.max(1, Math.round(months))
}

/** Divide o total em N parcelas com 2 casas; a última absorve o arredondamento. */
function dividirValor(total: number, n: number): number[] {
  const parcela = Math.floor((total / n) * 100) / 100
  const out = Array.from({ length: n }, () => parcela)
  out[n - 1] = Math.round((total - parcela * (n - 1)) * 100) / 100
  return out
}

export type RegistarPagamentoInput = {
  clientId: number
  meses: number
  valorTotal?: number | null
  dataPagamento?: Date | null
  /** Primeiro mês a cobrir. Por omissão: o próximo mês por pagar (ver proximoMesAPagar). */
  mesInicial?: Date | null
  /** Registo inicial de dados antigos: início e fim exatos (não segue os meses de calendário). */
  inicio?: Date | null
  fim?: Date | null
  metodo?: string | null
  observacoes?: string | null
  /** null/omisso = atraso calculado automaticamente; true/false = marcado pelo gestor. */
  atrasoManual?: boolean | null
  userId?: number | null
  origem?: 'painel' | 'inicial'
}

export async function registarPagamentoCliente(input: RegistarPagamentoInput) {
  await ensurePagamentosTables()
  const client = await prisma.client.findUnique({ where: { id: input.clientId } })
  if (!client) throw new Error('client-not-found')

  const meses = Math.min(24, Math.max(1, Math.round(Number(input.meses) || 1)))
  const today = startOfToday()

  const valorTotal =
    input.valorTotal != null && !Number.isNaN(Number(input.valorTotal))
      ? Number(input.valorTotal)
      : Number(client.valor) * meses
  const parcelas = dividirValor(valorTotal, meses)

  let datas: Array<{ inicio: Date; fim: Date }>
  let novoFim: Date
  if (input.inicio && input.fim) {
    // Histórico antigo: mantém as datas exatas que já existiam.
    const inicio = new Date(input.inicio)
    inicio.setHours(0, 0, 0, 0)
    datas = parcelas.map((_, i) => ({
      inicio: addMonthsKeepingBillingDay(inicio, i),
      fim: i === meses - 1 ? new Date(input.fim!) : addMonthsKeepingBillingDay(inicio, i + 1),
    }))
    novoFim = datas[datas.length - 1].fim
  } else {
    const mesInicial = input.mesInicial ? inicioDoMes(input.mesInicial) : proximoMesAPagar(client.dataFim, today)
    const cobertura = calcularCobertura(mesInicial, meses)
    await garantirMesesLivres(client.id, cobertura.periodos.map((p) => p.inicio))
    datas = cobertura.periodos
    // Pagar um mês antigo em falta não recua a data fim de quem já pagou meses posteriores.
    novoFim = cobertura.dataFim > client.dataFim ? cobertura.dataFim : client.dataFim
  }
  const periodos = parcelas.map((valor, i) => ({
    clientId: client.id,
    numero: i + 1,
    inicio: datas[i].inicio,
    fim: datas[i].fim,
    valor,
    // Meses já terminados (ex.: registo de pagamentos antigos) não geram aviso.
    notificadoAt: datas[i].fim <= today ? new Date() : null,
  }))

  const [pagamento] = await prisma.$transaction([
    prisma.pagamento.create({
      data: {
        clientId: client.id,
        salaId: client.salaId,
        dataPagamento: input.dataPagamento ?? new Date(),
        meses,
        valorTotal,
        metodo: input.metodo || null,
        observacoes: input.observacoes || null,
        origem: input.origem ?? 'painel',
        atrasoManual: input.atrasoManual ?? null,
        userId: input.userId ?? null,
        periodos: { create: periodos },
      },
      include: { periodos: { orderBy: { numero: 'asc' } } },
    }),
    prisma.client.update({
      where: { id: client.id },
      data:
        input.origem === 'inicial'
          ? { dataFim: novoFim }
          : {
              dataFim: novoFim,
              ...(novoFim >= today ? { status: 'ativo', whatsappNotificadoVencimentoAt: null } : {}),
            },
    }),
  ])
  return { pagamento, client, dataFim: novoFim }
}

/** Recalcula Client.dataFim a partir dos períodos que restam (após apagar um pagamento). */
export async function removerPagamentoCliente(clientId: number, pagamentoId: number) {
  await ensurePagamentosTables()
  const pagamento = await prisma.pagamento.findFirst({
    where: { id: pagamentoId, clientId },
    include: { periodos: true },
  })
  if (!pagamento) return null
  await prisma.pagamento.delete({ where: { id: pagamentoId } })
  const ultimo = await prisma.periodoPago.findFirst({
    where: { clientId },
    orderBy: { fim: 'desc' },
  })
  const primeiroRemovido = pagamento.periodos.reduce<Date | null>(
    (acc, p) => (acc == null || p.inicio < acc ? p.inicio : acc),
    null
  )
  const dataFim = ultimo ? dataFimDoPeriodo(ultimo.fim) : primeiroRemovido && primeiroRemovido.getDate() === 1
    ? limiteRenovacaoDoMes(primeiroRemovido)
    : primeiroRemovido
  if (!dataFim) return pagamento
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  await prisma.client.update({
    where: { id: clientId },
    data: {
      dataFim,
      ...(client?.status === 'ativo' && dataFim < startOfToday() ? { status: 'vencido' } : {}),
    },
  })
  return pagamento
}

export type EditarPagamentoInput = {
  dataPagamento?: Date | null
  meses?: number | null
  /** Primeiro mês coberto; mudar `meses` ou `mesInicial` refaz os períodos em meses de calendário. */
  mesInicial?: Date | null
  valorTotal?: number | null
  metodo?: string | null
  observacoes?: string | null
  /** undefined = não mexe; null = volta ao automático; true/false = marcado pelo gestor. */
  atrasoManual?: boolean | null
}

/** Corrige um pagamento (data em que pagou, meses cobertos, valor, atraso...) e recalcula a data fim do cliente. */
export async function editarPagamentoCliente(clientId: number, pagamentoId: number, input: EditarPagamentoInput) {
  await ensurePagamentosTables()
  const atual = await prisma.pagamento.findFirst({
    where: { id: pagamentoId, clientId },
    include: { periodos: { orderBy: { numero: 'asc' } } },
  })
  if (!atual) return null

  const mesAtual = atual.periodos.length ? mesCoberto(atual.periodos[0].inicio) : null
  const meses = input.meses != null ? Math.min(24, Math.max(1, Math.round(Number(input.meses)))) : atual.meses
  const mesInicial = input.mesInicial ? inicioDoMes(input.mesInicial) : mesAtual ?? inicioDoMes(atual.dataPagamento)
  const valorTotal = input.valorTotal != null ? Number(input.valorTotal) : Number(atual.valorTotal)
  const refazerPeriodos =
    meses !== atual.meses || !mesAtual || mesInicial.getTime() !== mesAtual.getTime()
  const parcelas = dividirValor(valorTotal, meses)
  const today = startOfToday()

  const ops = []
  if (refazerPeriodos) {
    const { periodos } = calcularCobertura(mesInicial, meses)
    await garantirMesesLivres(clientId, periodos.map((p) => p.inicio), pagamentoId)
    // Mantém o "cliente avisado" dos meses que continuam no pagamento.
    const avisados = new Map(atual.periodos.map((p) => [chaveMes(mesCoberto(p.inicio)), p.notificadoAt]))
    ops.push(
      prisma.periodoPago.deleteMany({ where: { pagamentoId } }),
      prisma.periodoPago.createMany({
        data: periodos.map((p, i) => ({
          pagamentoId,
          clientId,
          numero: i + 1,
          inicio: p.inicio,
          fim: p.fim,
          valor: parcelas[i],
          notificadoAt: avisados.get(chaveMes(p.inicio)) ?? (p.fim <= today ? new Date() : null),
        })),
      })
    )
  } else if (valorTotal !== Number(atual.valorTotal)) {
    ops.push(
      ...atual.periodos.map((p, i) => prisma.periodoPago.update({ where: { id: p.id }, data: { valor: parcelas[i] } }))
    )
  }
  ops.push(
    prisma.pagamento.update({
      where: { id: pagamentoId },
      data: {
        meses,
        valorTotal,
        ...(input.dataPagamento ? { dataPagamento: input.dataPagamento } : {}),
        ...(input.metodo !== undefined ? { metodo: input.metodo || null } : {}),
        ...(input.observacoes !== undefined ? { observacoes: input.observacoes || null } : {}),
        ...(input.atrasoManual !== undefined ? { atrasoManual: input.atrasoManual } : {}),
      },
    })
  )
  await prisma.$transaction(ops)
  const dataFim = refazerPeriodos ? await sincronizarDataFim(clientId) : null
  return { pagamento: atual, dataFim }
}

type PeriodoRow = { id: number; numero: number; inicio: Date; fim: Date; valor: unknown; notificadoAt: Date | null }
type PagamentoRow = {
  id: number
  clientId: number
  salaId: number | null
  dataPagamento: Date
  meses: number
  valorTotal: unknown
  metodo: string | null
  observacoes: string | null
  origem: string
  atrasoManual?: boolean | null
  userId: number | null
  createdAt: Date
  periodos: PeriodoRow[]
}

export function estadoPeriodo(p: { inicio: Date; fim: Date }, today = startOfToday()): 'expirado' | 'em_curso' | 'futuro' {
  if (p.fim <= today) return 'expirado'
  if (p.inicio <= today) return 'em_curso'
  return 'futuro'
}

export function serializePagamento(p: PagamentoRow, today = startOfToday()) {
  return {
    ...p,
    valorTotal: Number(p.valorTotal),
    periodos: p.periodos.map((x) => ({
      ...x,
      valor: Number(x.valor),
      estado: estadoPeriodo(x, today),
      /** Mês de calendário coberto (dia 1). */
      mes: mesCoberto(x.inicio),
    })),
  }
}

const DIA_MS = 24 * 60 * 60 * 1000

/**
 * Atraso automático: o prazo é o limite de renovação do pagamento anterior (dia 10 do mês a seguir
 * ao último mês que ele cobriu). O primeiro pagamento do cliente nunca conta como atrasado.
 * O gestor pode sobrepor com `atrasoManual`.
 */
function calcularAtrasos(pagamentos: ReturnType<typeof serializePagamento>[]) {
  const comMeses = pagamentos.filter((p) => p.periodos.length > 0)
  return new Map(
    pagamentos.map((p) => {
      let prazo: Date | null = null
      if (p.periodos.length) {
        const primeiroMes = p.periodos[0].mes.getTime()
        // Pagamento anterior = o que cobre o mês mais recente antes do primeiro mês deste.
        let anteriorFim: Date | null = null
        for (const o of comMeses) {
          if (o.id === p.id) continue
          const ultimo = o.periodos[o.periodos.length - 1]
          if (ultimo.mes.getTime() < primeiroMes && (anteriorFim == null || ultimo.fim > anteriorFim)) anteriorFim = ultimo.fim
        }
        prazo = anteriorFim ? dataFimDoPeriodo(anteriorFim) : null
      }
      const dia = new Date(p.dataPagamento)
      dia.setHours(0, 0, 0, 0)
      const diasAtraso = prazo && dia > prazo ? Math.round((dia.getTime() - prazo.getTime()) / DIA_MS) : 0
      const atrasoAuto = diasAtraso > 0
      return [
        p.id,
        {
          prazo,
          diasAtraso,
          atrasoAuto,
          atraso: p.atrasoManual ?? atrasoAuto,
          atrasoManual: p.atrasoManual ?? null,
        },
      ] as const
    })
  )
}

export async function listarPagamentosCliente(clientId: number) {
  await ensurePagamentosTables()
  const rows = await prisma.pagamento.findMany({
    where: { clientId },
    include: { periodos: { orderBy: { numero: 'asc' } } },
    orderBy: [{ dataPagamento: 'desc' }, { id: 'desc' }],
  })
  const today = startOfToday()
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { dataFim: true } })
  const serializados = rows.map((p) => serializePagamento(p, today))
  const atrasos = calcularAtrasos(serializados)
  const pagamentos = serializados.map((p) => ({ ...p, ...atrasos.get(p.id)! }))
  const periodos = pagamentos.flatMap((p) => p.periodos)
  return {
    pagamentos,
    resumo: {
      totalPago: pagamentos.reduce((s, p) => s + p.valorTotal, 0),
      pagamentosEmAtraso: pagamentos.filter((p) => p.atraso).length,
      mesesPagos: periodos.length,
      mesesExpirados: periodos.filter((x) => x.estado === 'expirado').length,
      mesesRestantes: periodos.filter((x) => x.estado !== 'expirado').length,
      pagoAte: periodos.reduce<Date | null>((acc, x) => (acc == null || x.fim > acc ? x.fim : acc), null),
      /** Data limite para renovar (dia 10); a partir do dia seguinte o cliente fica vencido. */
      renovarAte: client?.dataFim ?? null,
      /** Primeiro mês que o próximo pagamento cobre. */
      proximoMes: client ? proximoMesAPagar(client.dataFim, today) : inicioDoMes(today),
    },
  }
}
