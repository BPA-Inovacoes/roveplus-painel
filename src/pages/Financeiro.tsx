import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { DollarSign, LayoutDashboard, CalendarClock, TrendingUp, Tv, Server, LayoutGrid, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'
import { useAuth } from '../contexts/AuthContext'
import { TablePagination, ROWS_PER_PAGE } from '../components/TablePagination'

interface ReceitaPorServidor {
  servidorId: number
  servidorNome: string
  receita: number
  clientes: number
}

interface FinanceData {
  receitaMes: number
  receitaMesNetflix?: number
  receitaMesIptv?: number
  receitaMesAnterior?: number
  variacaoReceita?: number
  totalClientes: number
  totalNetflix: number
  totalIptv: number
  vencendoHoje: number
  vencendoEm7Dias?: number
  receitaUltimosMeses?: { mes: string; valor: number; valorNetflix?: number; valorIptv?: number }[]
  valorVencidoNetflix?: number
  valorVencidoIptv?: number
  valorVencidoTotal?: number
  receitaMensalProjetada?: number
  receitaMensalProjetadaNetflix?: number
  receitaMensalProjetadaIptv?: number
  receitaPorServidor?: ReceitaPorServidor[]
  clientsByServidor?: { id: number; nome: string; totalClientes: number; status: string }[]
  custoSalasNetflix?: number
  custoServidoresIptv?: number
  lucroEstimado?: number
}

interface SalaFinanceira {
  id: number
  nome: string
  dataFim: string | null
  status: string
  totalClientes: number
}

interface ServidorFinanceiro {
  id: number
  nome: string
  tipo: string
  status: string
  totalClientes: number
  mensalidade?: number | null
  dataPagamento?: string | null
}

const CHART_COLORS = {
  netflix: '#ef4444',
  netflixFill: '#ef4444',
  iptv: '#3b82f6',
  iptvFill: '#60a5fa',
  total: '#22c55e',
  grid: 'rgba(75, 85, 99, 0.3)',
}

export default function Financeiro() {
  const { user } = useAuth()
  const { showWarning, showError, showInfo } = useAlert()
  const [data, setData] = useState<FinanceData | null>(null)
  const [salas, setSalas] = useState<SalaFinanceira[]>([])
  const [servidores, setServidores] = useState<ServidorFinanceiro[]>([])
  const [loading, setLoading] = useState(true)
  const [mesesProjecao, setMesesProjecao] = useState(3)
  const [novosClientesMes, setNovosClientesMes] = useState(0)
  const [valorMedioNovo, setValorMedioNovo] = useState(0)
  const [servicoView, setServicoView] = useState<'todos' | 'iptv' | 'netflix'>('todos')
  const [servidorTablePage, setServidorTablePage] = useState(1)
  const [servidorGestaoPage, setServidorGestaoPage] = useState(1)
  const [salaTablePage, setSalaTablePage] = useState(1)
  const [suspendingServidorId, setSuspendingServidorId] = useState<number | null>(null)

  useEffect(() => {
    if (user?.role === 'iptv') setServicoView('iptv')
    else if (user?.role === 'netflix') setServicoView('netflix')
  }, [user?.role])

  async function loadDashboardFinance() {
    return api
      .get<FinanceData>('/api/dashboard')
      .then(setData)
      .catch((e) => {
        showWarning(
          e instanceof Error ? e.message : 'Não foi possível carregar os dados financeiros. Verifique a ligação ou tente mais tarde.'
        )
      })
  }

  async function loadSalasFinance() {
    return api
      .get<SalaFinanceira[]>('/api/salas')
      .then((rows) => setSalas(Array.isArray(rows) ? rows : []))
      .catch(() => setSalas([]))
  }

  async function loadServidoresFinance() {
    return api
      .get<ServidorFinanceiro[]>('/api/servidores')
      .then((rows) => setServidores(Array.isArray(rows) ? rows : []))
      .catch(() => setServidores([]))
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadDashboardFinance(), loadSalasFinance(), loadServidoresFinance()]).finally(() => setLoading(false))
  }, [showWarning])

  const variacaoReceita = data?.variacaoReceita ?? 0
  const receitaMeses = data?.receitaUltimosMeses ?? []
  const receitaMensal = Number(data?.receitaMensalProjetada ?? 0)
  const receitaMensalNetflix = Number(data?.receitaMensalProjetadaNetflix ?? 0)
  const receitaMensalIptv = Number(data?.receitaMensalProjetadaIptv ?? 0)
  const receitaPorServidor = data?.receitaPorServidor ?? []
  const valorDevidoNetflix = Number(data?.valorVencidoNetflix ?? 0)
  const valorDevidoIptv = Number(data?.valorVencidoIptv ?? 0)
  const valorDevidoTotal = Number(data?.valorVencidoTotal ?? 0)
  const canShowNetflix = servicoView === 'todos' || servicoView === 'netflix'
  const canShowIptv = servicoView === 'todos' || servicoView === 'iptv'
  const totalClientesServico =
    servicoView === 'netflix' ? (data?.totalNetflix ?? 0) : servicoView === 'iptv' ? (data?.totalIptv ?? 0) : (data?.totalClientes ?? 0)
  const receitaMensalServico =
    servicoView === 'netflix'
      ? Number(data?.receitaMensalProjetadaNetflix ?? 0)
      : servicoView === 'iptv'
        ? Number(data?.receitaMensalProjetadaIptv ?? 0)
        : receitaMensal
  const receitaMesServico =
    servicoView === 'netflix'
      ? Number(data?.receitaMesNetflix ?? 0)
      : servicoView === 'iptv'
        ? Number(data?.receitaMesIptv ?? 0)
        : Number(data?.receitaMes ?? 0)
  const valorDevidoServico =
    servicoView === 'netflix' ? valorDevidoNetflix : servicoView === 'iptv' ? valorDevidoIptv : valorDevidoTotal

  function daysUntilSala(dateStr: string | null): number | null {
    if (!dateStr) return null
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  }

  async function pagarMesSala(sala: SalaFinanceira) {
    try {
      await api.post(`/api/salas/${sala.id}/pagar-mes`, {})
      showInfo(`Sala "${sala.nome}" renovada por +1 mês.`)
      const rows = await api.get<SalaFinanceira[]>('/api/salas')
      setSalas(Array.isArray(rows) ? rows : [])
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao renovar sala')
    }
  }

  async function suspenderServidorFinanceiro(servidorId: number, nome: string) {
    if (!confirm(`Suspender servidor "${nome}"? O estado ficará Offline.`)) return
    setSuspendingServidorId(servidorId)
    try {
      await api.post(`/api/servidores/${servidorId}/suspender`, {})
      await Promise.all([loadDashboardFinance(), loadServidoresFinance()])
      showInfo(`Servidor "${nome}" suspenso.`)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao suspender servidor')
    } finally {
      setSuspendingServidorId(null)
    }
  }

  async function pagarMesServidorPrincipal(servidor: ServidorFinanceiro) {
    try {
      await api.post(`/api/servidores/${servidor.id}/pagar-mes-principal`, {})
      await loadServidoresFinance()
      showInfo(`Pagamento do servidor "${servidor.nome}" registado (+1 mês).`)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao registar pagamento do servidor')
    }
  }

  // Projeção: receita mensal × N meses (clientes ativos mantêm-se)
  const projecaoSimples = receitaMensal * Math.max(0, Math.min(24, mesesProjecao))

  // Com crescimento: adiciona (novosClientesMes × valorMedioNovo) por cada mês futuro
  const valorMedio = valorMedioNovo > 0 ? valorMedioNovo : (data?.totalClientes ? receitaMensal / data.totalClientes : 0)
  const incrementoMensal = novosClientesMes * valorMedio
  const projecaoComCrescimento = projecaoSimples + (incrementoMensal * (mesesProjecao * (mesesProjecao + 1)) / 2)

  const totalClientes = data?.totalClientes ?? 0
  const valorMedioCliente = totalClientes > 0 ? receitaMensal / totalClientes : 0
  const totalUltimos6Meses = receitaMeses.reduce((s, m) => s + m.valor, 0)
  const percentNetflix = receitaMensal > 0 ? (Number(data?.receitaMensalProjetadaNetflix ?? 0) / receitaMensal) * 100 : 0
  const percentIptv = receitaMensal > 0 ? (Number(data?.receitaMensalProjetadaIptv ?? 0) / receitaMensal) * 100 : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
          <span className="text-sm">A carregar dados financeiros...</span>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div>
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-1">
          <span>Dashboard</span>
          <LayoutDashboard className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300">Financeiro</span>
        </nav>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <DollarSign className="w-6 h-6" />
          Financeiro
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Controlo financeiro simples para gestão interna: acompanha clientes, tipos de serviço (Netflix, IPTV), quanto cada um paga e quanto deve entrar mensalmente. Não é contabilidade formal – apenas projeção de receitas e fluxo de entradas.
        </p>
        <div className="mt-4 inline-flex items-center gap-1 p-1 rounded-xl border border-netflix-border/70 bg-netflix-panel/70">
          <button
            type="button"
            onClick={() => setServicoView('todos')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              servicoView === 'todos' ? 'bg-white text-black' : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setServicoView('iptv')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              servicoView === 'iptv' ? 'bg-primary-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            IPTV
          </button>
          <button
            type="button"
            onClick={() => setServicoView('netflix')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              servicoView === 'netflix' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Netflix
          </button>
        </div>
      </div>

      {/* Resumo geral */}
      <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-5 shadow-lg shadow-black/20">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-gray-400" />
          Resumo geral
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-green-600/40 bg-green-900/20 p-4">
            <p className="text-xs text-green-300 uppercase tracking-wider">Receita mensal projetada</p>
            <p className="text-xl font-bold text-white mt-0.5">{receitaMensalServico.toFixed(2)} kz</p>
            <p className="text-xs text-gray-500 mt-1">{totalClientesServico} clientes ativos</p>
          </div>
          <div className="rounded-lg border border-netflix-border/80 bg-netflix-panel/60 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Receita deste mês (est.)</p>
            <p className="text-xl font-bold text-white mt-0.5">{receitaMesServico.toFixed(2)} kz</p>
            <p className="text-xs text-gray-500 mt-1">Vencimentos que caem neste mês</p>
            {data?.receitaMesAnterior != null && data.receitaMesAnterior > 0 && (
              <p className={`text-xs mt-1 ${variacaoReceita >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {variacaoReceita >= 0 ? '+' : ''}{variacaoReceita}% vs mês anterior
              </p>
            )}
          </div>
          <div className="rounded-lg border border-amber-600/40 bg-amber-900/20 p-4">
            <p className="text-xs text-amber-300 uppercase tracking-wider">Total em dívida</p>
            <p className="text-xl font-bold text-white mt-0.5">{valorDevidoServico.toFixed(2)} kz</p>
            <p className="text-xs text-gray-500 mt-1">Clientes com renovação em atraso</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-netflix-border/60 flex flex-wrap gap-6 text-sm text-gray-400">
          <span><strong className="text-gray-300">Valor médio por cliente:</strong> {valorMedioCliente.toFixed(2)} kz</span>
          <span><strong className="text-gray-300">Receita acumulada (6 meses):</strong> {totalUltimos6Meses.toFixed(2)} kz</span>
        </div>
      </div>

      {/* Netflix */}
      {canShowNetflix && (
      <div className="rounded-xl border border-primary-600/50 bg-primary-900/20 p-6 shadow-lg shadow-black/20">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Tv className="w-5 h-5 text-primary-400" />
          Netflix
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-primary-600/40 bg-primary-900/30 p-4">
            <p className="text-xs text-primary-300 uppercase tracking-wider">Receita mensal projetada</p>
            <p className="text-xl font-bold text-white mt-0.5">{Number(data?.receitaMensalProjetadaNetflix ?? 0).toFixed(2)} kz</p>
            <p className="text-xs text-gray-500 mt-1">{data?.totalNetflix ?? 0} clientes ({percentNetflix.toFixed(0)}% do total)</p>
          </div>
          <div className="rounded-lg border border-primary-500/30 bg-netflix-card/80 p-4">
            <p className="text-xs text-primary-300/90 uppercase tracking-wider">Receita deste mês (est.)</p>
            <p className="text-xl font-bold text-white mt-0.5">{Number(data?.receitaMesNetflix ?? 0).toFixed(2)} kz</p>
          </div>
          <div className="rounded-lg border border-amber-600/40 bg-amber-900/20 p-4">
            <p className="text-xs text-amber-300 uppercase tracking-wider">Em dívida</p>
            <p className="text-xl font-bold text-white mt-0.5">{valorDevidoNetflix.toFixed(2)} kz</p>
          </div>
        </div>
      </div>
      )}

      {/* IPTV */}
      {canShowIptv && (
      <div className="rounded-xl border border-blue-600/50 bg-blue-900/20 p-6 shadow-lg shadow-black/20">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-400" />
          IPTV
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-blue-600/40 bg-blue-900/30 p-4">
            <p className="text-xs text-blue-300 uppercase tracking-wider">Receita mensal projetada</p>
            <p className="text-xl font-bold text-white mt-0.5">{Number(data?.receitaMensalProjetadaIptv ?? 0).toFixed(2)} kz</p>
            <p className="text-xs text-gray-500 mt-1">{data?.totalIptv ?? 0} clientes ({percentIptv.toFixed(0)}% do total)</p>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-netflix-card/80 p-4">
            <p className="text-xs text-blue-300/90 uppercase tracking-wider">Receita deste mês (est.)</p>
            <p className="text-xl font-bold text-white mt-0.5">{Number(data?.receitaMesIptv ?? 0).toFixed(2)} kz</p>
          </div>
          <div className="rounded-lg border border-amber-600/40 bg-amber-900/20 p-4">
            <p className="text-xs text-amber-300 uppercase tracking-wider">Em dívida</p>
            <p className="text-xl font-bold text-white mt-0.5">{valorDevidoIptv.toFixed(2)} kz</p>
          </div>
        </div>
      </div>
      )}

      {/* Alertas e totais */}
      <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-5 shadow-lg shadow-black/20">
        <h3 className="text-base font-semibold text-white mb-4">Alertas e totais</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-netflix-border/80 bg-netflix-panel/60 p-4">
            <p className="text-sm text-gray-400">Total clientes</p>
            <p className="text-2xl font-bold text-white mt-0.5">{totalClientes}</p>
            <p className="text-xs text-gray-500 mt-1">Netflix: {data?.totalNetflix ?? 0} • IPTV: {data?.totalIptv ?? 0}</p>
          </div>
          <div className="rounded-lg border border-amber-600/40 bg-amber-900/20 p-4 flex items-start justify-between">
            <div>
              <p className="text-sm text-amber-300">Vencem hoje</p>
              <p className="text-2xl font-bold text-white mt-0.5">{data?.vencendoHoje ?? 0}</p>
            </div>
            <CalendarClock className="w-5 h-5 text-amber-400 shrink-0" />
          </div>
          <div className="rounded-lg border border-amber-600/30 bg-amber-900/10 p-4 flex items-start justify-between">
            <div>
              <p className="text-sm text-amber-300/90">Vencem em 7 dias</p>
              <p className="text-2xl font-bold text-white mt-0.5">{data?.vencendoEm7Dias ?? 0}</p>
            </div>
            <CalendarClock className="w-5 h-5 text-amber-300 shrink-0" />
          </div>
        </div>
      </div>

      {/* Projeção de receita futura */}
      <div className="rounded-xl border border-green-700/40 bg-green-900/20 p-6 shadow-lg shadow-black/20">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          Projeção de receita futura
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Receita mensal × meses. Opcional: novos clientes por mês para incluir crescimento.
        </p>
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Meses a prever</label>
            <input
              type="number"
              min={1}
              max={24}
              value={mesesProjecao}
              onChange={(e) => setMesesProjecao(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
              className="w-20 px-3 py-2 rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Novos clientes/mês (opcional)</label>
            <input
              type="number"
              min={0}
              value={novosClientesMes}
              onChange={(e) => setNovosClientesMes(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 px-3 py-2 rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Valor médio novo cliente (kz)</label>
            <input
              type="number"
              min={0}
              value={valorMedioNovo || ''}
              onChange={(e) => setValorMedioNovo(Number(e.target.value) || 0)}
              placeholder={valorMedio > 0 ? valorMedio.toFixed(0) : 'média atual'}
              className="w-28 px-3 py-2 rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm placeholder-gray-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-netflix-border/80 bg-netflix-card/80 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total ({mesesProjecao} meses)</p>
            <p className="text-xl font-bold text-green-400 mt-0.5">{projecaoSimples.toFixed(2)} kz</p>
            <p className="text-xs text-gray-500 mt-1">Receita mensal × {mesesProjecao}</p>
          </div>
          <div className="rounded-lg border border-primary-600/40 bg-primary-900/20 p-4">
            <p className="text-xs text-primary-300 uppercase tracking-wider flex items-center gap-1"><Tv className="w-3 h-3" /> Netflix</p>
            <p className="text-xl font-bold text-white mt-0.5">{(receitaMensalNetflix * Math.max(0, Math.min(24, mesesProjecao))).toFixed(2)} kz</p>
            <p className="text-xs text-gray-500 mt-1">{receitaMensalNetflix.toFixed(2)} kz/mês × {mesesProjecao}</p>
          </div>
          <div className="rounded-lg border border-blue-600/40 bg-blue-900/20 p-4">
            <p className="text-xs text-blue-300 uppercase tracking-wider flex items-center gap-1"><Server className="w-3 h-3" /> IPTV</p>
            <p className="text-xl font-bold text-white mt-0.5">{(receitaMensalIptv * Math.max(0, Math.min(24, mesesProjecao))).toFixed(2)} kz</p>
            <p className="text-xs text-gray-500 mt-1">{receitaMensalIptv.toFixed(2)} kz/mês × {mesesProjecao}</p>
          </div>
          {novosClientesMes > 0 && (
            <div className="rounded-lg border-2 border-green-600/50 bg-green-900/20 p-4">
              <p className="text-xs text-green-300 uppercase tracking-wider">Com crescimento ({mesesProjecao} meses)</p>
              <p className="text-xl font-bold text-green-400 mt-0.5">{projecaoComCrescimento.toFixed(2)} kz</p>
              <p className="text-xs text-gray-500 mt-1">+{novosClientesMes} clientes/mês × {valorMedio.toFixed(0)} kz</p>
            </div>
          )}
        </div>
      </div>

      {/* Receita por servidor (IPTV) */}
      {canShowIptv && receitaPorServidor.length > 0 && (
        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 shadow-lg shadow-black/20 overflow-hidden">
          <div className="p-6 pb-0">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              Receita por servidor (IPTV) – mês atual
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Quanto entra por servidor, com base nos clientes cujo vencimento cai no mês atual.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-netflix-border">
                  <th className="text-left py-2 px-3">Servidor</th>
                  <th className="text-right py-2 px-3">Clientes</th>
                  <th className="text-right py-2 px-3">Receita (kz)</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(receitaPorServidor.length / ROWS_PER_PAGE))
                  const page = Math.min(servidorTablePage, totalPages)
                  const paged = receitaPorServidor.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)
                  return paged.map((r) => (
                    <tr key={r.servidorId} className="border-b border-netflix-border/60">
                      <td className="py-2 px-3 text-white">{r.servidorNome}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{r.clientes}</td>
                      <td className="py-2 px-3 text-right font-medium text-white">{r.receita.toFixed(2)}</td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalItems={receitaPorServidor.length}
            currentPage={Math.min(servidorTablePage, Math.max(1, Math.ceil(receitaPorServidor.length / ROWS_PER_PAGE)))}
            onPageChange={setServidorTablePage}
          />
        </div>
      )}

      {/* Gestão de servidores (IPTV) */}
      {canShowIptv && servidores.filter((s) => s.tipo === 'principal').length > 0 && (
        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 shadow-lg shadow-black/20 overflow-hidden">
          <div className="p-6 pb-0">
            <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              Gestão de servidores (IPTV)
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Controle rápido de estado e pagamentos dos servidores principais.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-netflix-border">
                  <th className="text-left py-2 px-3">Servidor</th>
                  <th className="text-right py-2 px-3">Clientes</th>
                  <th className="text-right py-2 px-3">Mensalidade</th>
                  <th className="text-left py-2 px-3">Data pagamento</th>
                  <th className="text-left py-2 px-3">Estado</th>
                  <th className="text-right py-2 px-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const list = servidores.filter((s) => s.tipo === 'principal')
                  const totalPages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE))
                  const page = Math.min(servidorGestaoPage, totalPages)
                  const paged = list.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)
                  return paged.map((s) => (
                    <tr key={s.id} className="border-b border-netflix-border/60">
                      <td className="py-2 px-3 text-white">{s.nome}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{s.totalClientes}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{Number(s.mensalidade ?? 0).toFixed(2)} kz</td>
                      <td className="py-2 px-3 text-gray-300">
                        {s.dataPagamento ? new Date(s.dataPagamento).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          s.status === 'online'
                            ? 'bg-green-900/50 text-green-300'
                            : s.status === 'instável'
                              ? 'bg-amber-900/50 text-amber-300'
                              : 'bg-red-900/50 text-red-300'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => pagarMesServidorPrincipal(s)}
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/30 hover:text-white transition-colors"
                            title="Pagar +1 mês"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          {s.status !== 'offline' ? (
                            <button
                              type="button"
                              onClick={() => suspenderServidorFinanceiro(s.id, s.nome)}
                              disabled={suspendingServidorId === s.id}
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/30 hover:text-white disabled:opacity-50 transition-colors"
                              title="Suspender servidor"
                            >
                              Suspender
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalItems={servidores.filter((s) => s.tipo === 'principal').length}
            currentPage={Math.min(servidorGestaoPage, Math.max(1, Math.ceil(servidores.filter((s) => s.tipo === 'principal').length / ROWS_PER_PAGE)))}
            onPageChange={setServidorGestaoPage}
          />
        </div>
      )}

      {/* Gestão por sala (Netflix) */}
      {canShowNetflix && (
        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 shadow-lg shadow-black/20 overflow-hidden">
          <div className="p-6 pb-0">
            <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary-400" />
              Gestão por sala (Netflix)
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Controlo de pagamentos e renovação das salas sem sair do Financeiro.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-netflix-border">
                  <th className="text-left py-2 px-3">Sala</th>
                  <th className="text-right py-2 px-3">Clientes</th>
                  <th className="text-left py-2 px-3">Data renovação</th>
                  <th className="text-left py-2 px-3">Estado</th>
                  <th className="text-right py-2 px-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(salas.length / ROWS_PER_PAGE))
                  const page = Math.min(salaTablePage, totalPages)
                  const paged = salas.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)
                  return paged.map((s) => {
                    const days = daysUntilSala(s.dataFim)
                    const urgent = days !== null && days <= 3 && days >= 0
                    const exp = days !== null && days < 0
                    return (
                      <tr key={s.id} className="border-b border-netflix-border/60">
                        <td className="py-2 px-3 text-white">{s.nome}</td>
                        <td className="py-2 px-3 text-right text-gray-300">{s.totalClientes}</td>
                        <td className="py-2 px-3">
                          <span className={`text-sm ${exp ? 'text-red-400' : urgent ? 'text-amber-300' : 'text-gray-300'}`}>
                            {s.dataFim ? new Date(s.dataFim).toLocaleDateString('pt-BR') : '—'}
                            {days !== null && <span className="text-xs text-gray-500 ml-1">({days > 0 ? `${days}d` : days === 0 ? 'hoje' : 'vencido'})</span>}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${s.status === 'ativo' ? 'bg-green-900/50 text-green-300' : 'bg-amber-900/50 text-amber-300'}`}>
                            {s.status === 'ativo' ? 'Ativo' : 'Suspenso'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => pagarMesSala(s)}
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/30 hover:text-white transition-colors"
                              title="Pagar +1 mês"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalItems={salas.length}
            currentPage={Math.min(salaTablePage, Math.max(1, Math.ceil(salas.length / ROWS_PER_PAGE)))}
            onPageChange={setSalaTablePage}
          />
        </div>
      )}

      <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-6 shadow-lg shadow-black/20">
        <h3 className="text-base font-semibold text-white">
          Receita por mês (kz) {servicoView === 'todos' ? '– Netflix e IPTV' : servicoView === 'netflix' ? '– Netflix' : '– IPTV'}
        </h3>
        <p className="text-sm text-gray-400 mt-0.5 mb-4">
          Evolução das entradas estimadas pelos últimos meses (datas de vencimento). Receita acumulada (6 meses): <strong className="text-gray-300">{totalUltimos6Meses.toFixed(2)} kz</strong>.
        </p>
        <div className="h-[260px]">
          {receitaMeses.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={receitaMeses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="finance-receita-total" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.total} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={CHART_COLORS.total} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="finance-receita-netflix" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.netflixFill} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CHART_COLORS.netflixFill} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="finance-receita-iptv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.iptvFill} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CHART_COLORS.iptvFill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis
                  dataKey="mes"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={{ stroke: '#374151' }}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={{ stroke: '#374151' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f3f4f6',
                  }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(value: number | undefined, name: string | undefined) => {
                    const labelValue = `${Number(value ?? 0).toFixed(2)} kz`
                    const serieLabel =
                      name === 'valorNetflix' ? 'Netflix' : name === 'valorIptv' ? 'IPTV' : 'Total'
                    return [labelValue, serieLabel]
                  }}
                />
                {canShowNetflix && (
                  <Area
                    type="monotone"
                    dataKey="valorNetflix"
                    name="valorNetflix"
                    stackId={servicoView === 'todos' ? '1' : undefined}
                    stroke={CHART_COLORS.netflix}
                    strokeWidth={2.5}
                    fill="url(#finance-receita-netflix)"
                  />
                )}
                {canShowIptv && (
                  <Area
                    type="monotone"
                    dataKey="valorIptv"
                    name="valorIptv"
                    stackId={servicoView === 'todos' ? '1' : undefined}
                    stroke={CHART_COLORS.iptv}
                    strokeWidth={2.5}
                    fill="url(#finance-receita-iptv)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              Sem dados de receita suficientes para gerar o gráfico.
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          {canShowNetflix && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" /> Netflix</span>}
          {canShowIptv && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> IPTV</span>}
        </div>
      </div>
    </motion.div>
  )
}

