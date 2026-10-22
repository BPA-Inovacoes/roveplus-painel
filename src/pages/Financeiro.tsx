import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
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
import {
  DollarSign,
  LayoutDashboard,
  CalendarClock,
  TrendingUp,
  Tv,
  Wallet,
  Receipt,
  Tags,
} from 'lucide-react'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'
import { useAuth } from '../contexts/AuthContext'
import { FinanceiroCobrancas } from './financeiro/FinanceiroCobrancas'
import { FinanceiroCustos } from './financeiro/FinanceiroCustos'
import { FinanceiroInscricoes } from './financeiro/FinanceiroInscricoes'
import { FinanceiroPlanos } from './financeiro/FinanceiroPlanos'
import { ArrecadacaoMesCard } from '../components/ArrecadacaoMesCard'
import { canAccessFinanceiroPage, defaultPanelPath } from '../lib/panelRoles'
import type { CobrancaFiltro, FinanceData, FinanceiroTab, SalaFinanceira } from './financeiro/types'

const CHART_COLORS = {
  netflix: '#ef4444',
  netflixFill: '#ef4444',
  total: '#22c55e',
  grid: 'rgba(75, 85, 99, 0.3)',
}

const TABS: { id: FinanceiroTab; label: string; icon: typeof DollarSign }[] = [
  { id: 'visao', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'cobrancas', label: 'Cobranças', icon: Wallet },
  { id: 'custos', label: 'Custos', icon: Receipt },
  { id: 'inscricoes', label: 'Inscrições', icon: Tv },
  { id: 'planos', label: 'Planos', icon: Tags },
]

export default function Financeiro() {
  const { user } = useAuth()
  const { showWarning } = useAlert()
  const [tab, setTab] = useState<FinanceiroTab>('visao')
  const [data, setData] = useState<FinanceData | null>(null)
  const [salas, setSalas] = useState<SalaFinanceira[]>([])
  const [loading, setLoading] = useState(true)
  const [mesesProjecao, setMesesProjecao] = useState(3)
  const [novosClientesMes, setNovosClientesMes] = useState(0)
  const [valorMedioNovo, setValorMedioNovo] = useState(0)
  const [cobrancaFiltro, setCobrancaFiltro] = useState<CobrancaFiltro>('vencidos')

  function goCobrancas(filtro: CobrancaFiltro) {
    setCobrancaFiltro(filtro)
    setTab('cobrancas')
  }

  async function loadDashboardFinance() {
    return api
      .get<FinanceData>('/api/dashboard')
      .then(setData)
      .catch((e) => {
        showWarning(
          e instanceof Error ? e.message : 'Não foi possível carregar os dados financeiros.'
        )
      })
  }

  async function loadSalasFinance() {
    return api
      .get<SalaFinanceira[]>('/api/salas')
      .then((rows) => setSalas(Array.isArray(rows) ? rows : []))
      .catch(() => setSalas([]))
  }

  async function reloadAll() {
    await Promise.all([loadDashboardFinance(), loadSalasFinance()])
  }

  useEffect(() => {
    setLoading(true)
    reloadAll().finally(() => setLoading(false))
  }, [showWarning])

  const variacaoReceita = data?.variacaoReceita ?? 0
  const receitaMeses = data?.receitaUltimosMeses ?? []
  const receitaMensal = Number(data?.receitaMensalProjetada ?? 0)
  const valorDevidoTotal = Number(data?.valorVencidoTotal ?? 0)

  const projecaoSimples = receitaMensal * Math.max(0, Math.min(24, mesesProjecao))
  const valorMedio = valorMedioNovo > 0 ? valorMedioNovo : (data?.totalClientes ? receitaMensal / data.totalClientes : 0)
  const incrementoMensal = novosClientesMes * valorMedio
  const projecaoComCrescimento = projecaoSimples + (incrementoMensal * (mesesProjecao * (mesesProjecao + 1)) / 2)
  const totalClientes = data?.totalClientes ?? 0
  const valorMedioCliente = totalClientes > 0 ? receitaMensal / totalClientes : 0
  const totalUltimos6Meses = receitaMeses.reduce((s, m) => s + m.valor, 0)
  const custoSalas = Number(data?.custoSalasNetflix ?? 0)
  const lucroEstimado = Number(data?.lucroEstimado ?? receitaMensal - custoSalas)

  if (user && !canAccessFinanceiroPage(user.role)) {
    return <Navigate to={defaultPanelPath(user.role)} replace />
  }

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <DollarSign className="w-6 h-6" />
          Financeiro
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Centro financeiro do painel: receitas, cobranças, custos das salas, inscrições e preços.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-netflix-border/70 bg-netflix-panel/70">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    tab === t.id ? 'bg-white text-black' : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {tab === 'visao' && (
        <>
          {data?.arrecadacaoMes && (
            <ArrecadacaoMesCard
              data={data.arrecadacaoMes}
              custoSalas={custoSalas}
              onVerPorPagar={() => goCobrancas('porPagarMes')}
            />
          )}
          <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-5 shadow-lg shadow-black/20">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-gray-400" />
              Resumo geral
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-green-600/40 bg-green-900/20 p-4">
                <p className="text-xs text-green-300 uppercase tracking-wider">Receita mensal projetada</p>
                <p className="text-xl font-bold text-white mt-0.5">{receitaMensal.toFixed(2)} kz</p>
                <p className="text-xs text-gray-500 mt-1">{totalClientes} clientes ativos</p>
              </div>
              <div className="rounded-lg border border-netflix-border/80 bg-netflix-panel/60 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Receita deste mês (est.)</p>
                <p className="text-xl font-bold text-white mt-0.5">{Number(data?.receitaMes ?? 0).toFixed(2)} kz</p>
                {data?.receitaMesAnterior != null && data.receitaMesAnterior > 0 && (
                  <p className={`text-xs mt-1 ${variacaoReceita >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {variacaoReceita >= 0 ? '+' : ''}{variacaoReceita}% vs mês anterior
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => goCobrancas('vencidos')}
                className="rounded-lg border border-amber-600/40 bg-amber-900/20 p-4 text-left hover:bg-amber-900/30 transition-colors"
              >
                <p className="text-xs text-amber-300 uppercase tracking-wider">Total em dívida</p>
                <p className="text-xl font-bold text-white mt-0.5">{valorDevidoTotal.toFixed(2)} kz</p>
                <p className="text-xs text-amber-200/80 mt-1">Cobrar vencidos →</p>
              </button>
              <div className="rounded-lg border border-emerald-600/40 bg-emerald-900/20 p-4">
                <p className="text-xs text-emerald-300 uppercase tracking-wider">Lucro estimado / mês</p>
                <p className={`text-xl font-bold mt-0.5 ${lucroEstimado >= 0 ? 'text-white' : 'text-red-300'}`}>
                  {lucroEstimado.toFixed(2)} kz
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Orçamento salas: {data?.totalSalasAtivas ?? 0} × {Number(data?.custoPorSala ?? 0).toLocaleString('pt-PT')} = {custoSalas.toLocaleString('pt-PT')} kz
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-netflix-border/60 flex flex-wrap gap-6 text-sm text-gray-400">
              <span><strong className="text-gray-300">Valor médio/cliente:</strong> {valorMedioCliente.toFixed(2)} kz</span>
              <span><strong className="text-gray-300">Receita 6 meses:</strong> {totalUltimos6Meses.toFixed(2)} kz</span>
              <span><strong className="text-gray-300">Salas a vencer (7d):</strong> {data?.salasVencendo ?? 0}</span>
            </div>
          </div>

          <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-5">
            <h3 className="text-base font-semibold text-white mb-4">Ações rápidas</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <button type="button" onClick={() => goCobrancas('vencidos')} className="px-3 py-2 rounded-lg text-sm font-medium border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20">
                Cobrar vencidos ({data?.clientesVencidos ?? 0})
              </button>
              <button type="button" onClick={() => goCobrancas('hoje')} className="px-3 py-2 rounded-lg text-sm font-medium border border-amber-500/30 bg-amber-900/20 text-amber-100 hover:bg-amber-900/40">
                Vencem hoje ({data?.vencendoHoje ?? 0})
              </button>
              <button type="button" onClick={() => goCobrancas('7dias')} className="px-3 py-2 rounded-lg text-sm font-medium border border-netflix-border bg-netflix-panel text-gray-200 hover:bg-netflix-hover">
                Vencem em 7 dias ({data?.vencendoEm7Dias ?? 0})
              </button>
              <button type="button" onClick={() => setTab('custos')} className="px-3 py-2 rounded-lg text-sm font-medium border border-blue-500/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20">
                Pagar salas
              </button>
              <button type="button" onClick={() => setTab('inscricoes')} className="px-3 py-2 rounded-lg text-sm font-medium border border-primary-500/40 bg-primary-500/10 text-primary-200 hover:bg-primary-500/20">
                Inscrições pendentes
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => goCobrancas('hoje')}
                className="rounded-lg border border-amber-600/40 bg-amber-900/20 p-4 flex justify-between text-left hover:bg-amber-900/30 transition-colors"
              >
                <div>
                  <p className="text-sm text-amber-300">Vencem hoje</p>
                  <p className="text-2xl font-bold text-white">{data?.vencendoHoje ?? 0}</p>
                  <p className="text-xs text-amber-200/70 mt-1">Ver e cobrar →</p>
                </div>
                <CalendarClock className="w-5 h-5 text-amber-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => goCobrancas('7dias')}
                className="rounded-lg border border-amber-600/30 bg-amber-900/10 p-4 flex justify-between text-left hover:bg-amber-900/20 transition-colors"
              >
                <div>
                  <p className="text-sm text-amber-300/90">Vencem em 7 dias</p>
                  <p className="text-2xl font-bold text-white">{data?.vencendoEm7Dias ?? 0}</p>
                  <p className="text-xs text-amber-200/70 mt-1">Ver e renovar →</p>
                </div>
                <CalendarClock className="w-5 h-5 text-amber-300 shrink-0" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-green-700/40 bg-green-900/20 p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Projeção de receita
            </h3>
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Meses</label>
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
                <label className="block text-xs text-gray-400 mb-1">Novos clientes/mês</label>
                <input
                  type="number"
                  min={0}
                  value={novosClientesMes}
                  onChange={(e) => setNovosClientesMes(Math.max(0, Number(e.target.value) || 0))}
                  className="w-24 px-3 py-2 rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Valor médio novo (kz)</label>
                <input
                  type="number"
                  min={0}
                  value={valorMedioNovo || ''}
                  onChange={(e) => setValorMedioNovo(Number(e.target.value) || 0)}
                  placeholder={valorMedio > 0 ? valorMedio.toFixed(0) : ''}
                  className="w-28 px-3 py-2 rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-netflix-border/80 bg-netflix-card/80 p-4">
                <p className="text-xs text-gray-400 uppercase">Total ({mesesProjecao} meses)</p>
                <p className="text-xl font-bold text-green-400">{projecaoSimples.toFixed(2)} kz</p>
              </div>
              {novosClientesMes > 0 && (
                <div className="rounded-lg border border-green-600/50 bg-green-900/20 p-4">
                  <p className="text-xs text-green-300 uppercase">Com crescimento</p>
                  <p className="text-xl font-bold text-green-400">{projecaoComCrescimento.toFixed(2)} kz</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-6">
            <h3 className="text-base font-semibold text-white">Receita por mês (kz)</h3>
            <div className="h-[260px] mt-4">
              {receitaMeses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={receitaMeses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="finance-receita-netflix" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.netflixFill} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={CHART_COLORS.netflixFill} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      formatter={(value: number | undefined, name: string | undefined) => [
                        `${Number(value ?? 0).toFixed(2)} kz`,
                        name === 'valor' ? 'Netflix' : String(name ?? ''),
                      ]}
                    />
                    <Area type="monotone" dataKey="valor" stroke={CHART_COLORS.netflix} fill="url(#finance-receita-netflix)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">Sem dados suficientes.</div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'cobrancas' && (
        <FinanceiroCobrancas
          initialFiltro={cobrancaFiltro}
          onChanged={reloadAll}
        />
      )}

      {tab === 'custos' && (
        <FinanceiroCustos
          salas={salas}
          onReloadSalas={loadSalasFinance}
          onReloadDashboard={loadDashboardFinance}
        />
      )}

      {tab === 'inscricoes' && <FinanceiroInscricoes onChanged={reloadAll} />}

      {tab === 'planos' && <FinanceiroPlanos />}
    </motion.div>
  )
}
