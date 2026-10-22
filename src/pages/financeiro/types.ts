import type { ArrecadacaoMes } from '../../components/ArrecadacaoMesCard'

export interface FinanceData {
  receitaMes: number
  receitaMesAnterior?: number
  variacaoReceita?: number
  totalClientes: number
  totalNetflix: number
  vencendoHoje: number
  vencendoEm7Dias?: number
  clientesVencidos?: number
  receitaUltimosMeses?: { mes: string; valor: number }[]
  valorVencidoTotal?: number
  receitaMensalProjetada?: number
  custoSalasNetflix?: number
  custoPorSala?: number
  lucroEstimado?: number
  totalSalasAtivas?: number
  salasVencendo?: number
  salasVencidas?: number
  arrecadacaoMes?: ArrecadacaoMes
}

export interface SalaFinanceira {
  id: number
  nome: string
  dataFim: string | null
  status: string
  totalClientes: number
}

export interface ClienteFinanceiro {
  id: number
  nome: string
  whatsapp: string
  servico: string
  plano: string
  valor: number
  dataFim: string
  status: string
  inscricaoPaga?: boolean | null
  sala?: { nome: string } | null
}

export type FinanceiroTab = 'visao' | 'cobrancas' | 'custos' | 'inscricoes' | 'planos'
export type CobrancaFiltro = 'porPagarMes' | 'vencidos' | 'hoje' | '7dias' | 'ativos' | 'todos'
