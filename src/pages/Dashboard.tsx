import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Users,
  DollarSign,
  AlertCircle,
  Gift,
  Server,
  ChevronRight,
  UserPlus,
  Store,
  CalendarClock,
  LayoutDashboard,
  LayoutGrid,
} from 'lucide-react'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'
import { TablePagination, ROWS_PER_PAGE } from '../components/TablePagination'

interface DashboardData {
  totalNetflix: number
  totalIptv: number
  totalClientes: number
  clientesVencidos?: number
  clientesCancelados?: number
  clientsByServidor: { id: number; nome: string; totalClientes: number; status: string }[]
  vencendoHoje: number
  vencendoEm7Dias?: number
  clientesNovosEsteMes?: number
  receitaMes: number
  receitaMesAnterior?: number
  variacaoReceita?: number
  indicacoesTotal: number
  indicacoesPendentes?: number
  indicacoesConfirmadas?: number
  indicacoesEsteMes?: number
  totalRevendedores?: number
  clientesComRevendedor?: number
  receitaUltimosMeses?: { mes: string; valor: number }[]
  salasVencendo?: number
  salasVencidas?: number
}

const CHART_COLORS = {
  primary: '#e50914',
  primaryLight: '#b20710',
  secondary: '#6b7280',
  grid: 'rgba(75, 85, 99, 0.3)',
}

export default function Dashboard() {
  const { showError } = useAlert()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [servidorTablePage, setServidorTablePage] = useState(1)

  useEffect(() => {
    api
      .get<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((e) => {
        setData(null)
        showError(e instanceof Error ? e.message : 'Não foi possível carregar o dashboard.')
      })
      .finally(() => setLoading(false))
  }, [showError])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
          <span className="text-sm">A carregar overview...</span>
        </div>
      </div>
    )
  }

  const receita = data ? Number(data.receitaMes).toFixed(2) : '0.00'
  const pendentes = data?.indicacoesPendentes ?? 0
  const variacaoReceita = data?.variacaoReceita ?? 0
  const receitaMeses = data?.receitaUltimosMeses ?? []
  const pieData = [
    { name: 'Netflix', value: data?.totalNetflix ?? 0, color: CHART_COLORS.primary },
    { name: 'IPTV', value: data?.totalIptv ?? 0, color: CHART_COLORS.primaryLight },
  ].filter((d) => d.value > 0)
  const barData = (data?.clientsByServidor ?? []).map((s) => ({ nome: s.nome, clientes: s.totalClientes }))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Breadcrumb + título */}
      <div>
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-1">
          <span>Dashboard</span>
          <ChevronRight className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300">Overview</span>
        </nav>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6" />
          Overview
        </h1>
      </div>

      {/* KPIs – 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-5 shadow-lg shadow-black/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Total clientes</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {data?.totalClientes ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary-500/20 text-primary-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-5 shadow-lg shadow-black/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Receita do mês (est.)</p>
              <p className="text-2xl font-bold text-white mt-0.5">{receita} kz</p>
              {data?.receitaMesAnterior != null && data.receitaMesAnterior > 0 && (
                <p className={`text-xs mt-1 ${variacaoReceita >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {variacaoReceita >= 0 ? '+' : ''}{variacaoReceita}% vs mês anterior
                </p>
              )}
            </div>
            <div className="p-2.5 rounded-xl bg-green-500/20 text-green-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-5 shadow-lg shadow-black/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Vencem hoje</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {data?.vencendoHoje ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-5 shadow-lg shadow-black/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Indicações pendentes</p>
              <p className="text-2xl font-bold text-white mt-0.5">{pendentes}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary-500/20 text-primary-400">
              <Gift className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Resumo por status + Vencimentos + Este mês + Revendedores */}
      <div className="flex flex-wrap gap-3">
        <Link
        to="/clientes"
        className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-netflix-card/60 border border-netflix-border/80 hover:border-primary-500/50 transition-colors group"
      >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-300">Clientes por estado</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300 text-sm">
            <span className="font-semibold">{data?.totalClientes ?? 0}</span> ativos
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
            <span className="font-semibold">{data?.clientesVencidos ?? 0}</span> vencidos
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-700/50 border border-gray-600/50 text-gray-300 text-sm">
            <span className="font-semibold">{data?.clientesCancelados ?? 0}</span> cancelados
          </span>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-primary-400" />
        </Link>
        <Link
          to="/clientes"
          className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-netflix-card/60 border border-netflix-border/80 hover:border-primary-500/50 transition-colors group"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-300">Vencimentos</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-300 text-sm">
            <CalendarClock className="w-3.5 h-3.5" />
            <span className="font-semibold">{data?.vencendoHoje ?? 0}</span> hoje
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-800/20 border border-amber-600/40 text-amber-200/90 text-sm">
            <span className="font-semibold">{data?.vencendoEm7Dias ?? 0}</span> em 7 dias
          </span>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-primary-400" />
        </Link>
        <Link
          to="/salas"
          className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-netflix-card/60 border border-netflix-border/80 hover:border-primary-500/50 transition-colors group"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-300">Salas Netflix</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-300 text-sm">
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="font-semibold">{data?.salasVencendo ?? 0}</span> a vencer (7 dias)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
            <span className="font-semibold">{data?.salasVencidas ?? 0}</span> vencidas
          </span>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-primary-400" />
        </Link>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-netflix-card/60 border border-netflix-border/80">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Este mês</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-500/20 border border-primary-500/40 text-primary-300 text-sm">
            <UserPlus className="w-3.5 h-3.5" />
            <span className="font-semibold">{data?.clientesNovosEsteMes ?? 0}</span> novos clientes
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-500/20 border border-primary-500/40 text-primary-300 text-sm">
            <Gift className="w-3.5 h-3.5" />
            <span className="font-semibold">{data?.indicacoesEsteMes ?? 0}</span> indicações
          </span>
        </div>
        <Link
          to="/indicacoes"
          className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-netflix-card/60 border border-netflix-border/80 hover:border-primary-500/50 transition-colors group"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-300">Indicações</span>
          <span className="text-sm text-gray-300">
            <span className="font-semibold text-white">{data?.indicacoesTotal ?? 0}</span> total
          </span>
          <span className="text-sm text-green-400">
            <span className="font-semibold">{data?.indicacoesConfirmadas ?? 0}</span> confirmadas
          </span>
          <span className="text-sm text-amber-400">
            <span className="font-semibold">{pendentes}</span> pendentes
          </span>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-primary-400" />
        </Link>
        {(data?.totalRevendedores ?? 0) > 0 && (
          <Link
            to="/revendedores"
            className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-netflix-card/60 border border-netflix-border/80 hover:border-primary-500/50 transition-colors group"
          >
            <Store className="w-4 h-4 text-primary-400 group-hover:text-primary-300" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-300">Revendedores</span>
            <span className="font-semibold text-white">{data?.totalRevendedores ?? 0}</span>
            <span className="text-gray-400 text-sm">({data?.clientesComRevendedor ?? 0} clientes)</span>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-primary-400" />
          </Link>
        )}
      </div>

      {/* Gráficos: linha receita + doughnut distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-6 shadow-lg shadow-black/20">
          <h3 className="text-base font-semibold text-white">Receita por mês (kz)</h3>
          <p className="text-sm text-gray-400 mt-0.5 mb-4">Últimos 6 meses. Valores estimados com base nas datas de vencimento dos clientes.</p>
          <div className="h-[240px]">
            {receitaMeses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={receitaMeses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="receitaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={{ stroke: '#374151' }}
                    label={{ value: 'Mês', position: 'insideBottom', offset: -4, fill: '#9ca3af', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={{ stroke: '#374151' }}
                    tickFormatter={(v) => `${v}`}
                    label={{ value: 'Receita (kz)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#f3f4f6',
                    }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={((value: number | undefined) => [`${Number(value ?? 0).toFixed(2)} kz`, 'Receita no mês']) as any}
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    fill="url(#receitaGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                Sem dados de receita nos últimos 6 meses.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-6 shadow-lg shadow-black/20">
          <h3 className="text-base font-semibold text-white mb-4">Distribuição de clientes</h3>
          <div className="h-[240px] flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={{ stroke: '#9ca3af' }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#f3f4f6',
                    }}
                    formatter={((value: number | undefined) => [value ?? 0, 'Clientes']) as any}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value) => <span className="text-gray-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-500 text-sm">Sem clientes para exibir.</div>
            )}
          </div>
        </div>
      </div>

      {/* Segunda linha: barras clientes por servidor + indicações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {barData.length > 0 && (
          <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-6 shadow-lg shadow-black/20">
            <h3 className="text-base font-semibold text-white mb-4">Clientes por servidor</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={80}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#f3f4f6',
                    }}
                    formatter={((value: number | undefined) => [value ?? 0, 'Clientes']) as any}
                  />
                  <Bar dataKey="clientes" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Tabela: Clientes por servidor */}
      {data?.clientsByServidor && data.clientsByServidor.length > 0 && (
        <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 shadow-lg shadow-black/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-netflix-border/80 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Clientes por servidor</h3>
            <Link
              to="/servidores"
              className="text-sm text-primary-400 hover:text-primary-300 font-medium inline-flex items-center gap-1"
            >
              Ver servidores
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-netflix-panel/80 text-gray-300 text-sm">
                <tr>
                  <th className="px-5 py-3.5 font-medium w-12 text-center">Nº</th>
                  <th className="px-5 py-3.5 font-medium">Servidor</th>
                  <th className="px-5 py-3.5 font-medium">Clientes</th>
                  <th className="px-5 py-3.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-netflix-border/80 text-gray-200">
                {(() => {
                  const servidorList = data.clientsByServidor ?? []
                  const totalPages = Math.max(1, Math.ceil(servidorList.length / ROWS_PER_PAGE))
                  const page = Math.min(servidorTablePage, totalPages)
                  const paged = servidorList.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)
                  return paged.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-netflix-hover/80 transition-colors">
                    <td className="px-5 py-3 text-center text-gray-400 text-sm">{(page - 1) * ROWS_PER_PAGE + idx + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary-500/20 text-primary-400">
                          <Server className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-white">{s.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-white">
                      {s.totalClientes}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          s.status === 'online'
                            ? 'bg-green-900/50 text-green-300'
                            : s.status === 'instável'
                              ? 'bg-amber-900/50 text-amber-300'
                              : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          {data.clientsByServidor.length > ROWS_PER_PAGE && (
            <TablePagination
              totalItems={data.clientsByServidor.length}
              currentPage={Math.min(servidorTablePage, Math.max(1, Math.ceil(data.clientsByServidor.length / ROWS_PER_PAGE)))}
              onPageChange={setServidorTablePage}
            />
          )}
        </div>
      )}
    </motion.div>
  )
}
