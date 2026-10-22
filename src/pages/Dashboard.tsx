import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Users,
  DollarSign,
  AlertTriangle,
  Gift,
  ChevronRight,
  UserPlus,
  CalendarClock,
  LayoutDashboard,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  MinusCircle,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'
import { ArrecadacaoMesCard, type ArrecadacaoMes } from '../components/ArrecadacaoMesCard'
import { VIZ, VIZ_TOOLTIP_STYLE } from '../lib/vizColors'

interface DashboardData {
  totalNetflix: number
  totalClientes: number
  clientesVencidos?: number
  clientesCancelados?: number
  clientsBySala?: { id: number; nome: string; totalClientes: number }[]
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
  receitaUltimosMeses?: { mes: string; valor: number }[]
  salasVencendo?: number
  salasVencidas?: number
  arrecadacaoMes?: ArrecadacaoMes
}

const CARD = 'rounded-xl border border-white/10 bg-netflix-card p-5'

function kz(n: number) {
  return `${Number(n).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} kz`
}

/** Indicador simples: rótulo, valor e ícone neutro. A cor só aparece quando há um estado (atenção). */
function KpiTile({
  label,
  value,
  icon: Icon,
  hint,
  attention,
  to,
}: {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  hint?: React.ReactNode
  attention?: boolean
  to?: string
}) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-viz-ink-2">{label}</p>
        <p className="text-2xl font-semibold text-viz-ink mt-1">{value}</p>
        {hint && <div className="text-xs mt-1">{hint}</div>}
      </div>
      <div
        className={`p-2 rounded-lg shrink-0 ${
          attention ? 'bg-viz-warning/10 text-viz-warning' : 'bg-white/5 text-viz-muted'
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
    </div>
  )
  return to ? (
    <Link to={to} className={`${CARD} block hover:border-white/20 transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={CARD}>{body}</div>
  )
}

/** Linha de um painel de resumo: rótulo à esquerda, número à direita; ícone de estado quando relevante. */
function ResumoLinha({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: number
  icon?: LucideIcon
  tone?: 'neutral' | 'warning' | 'critical'
}) {
  const active = value > 0 && tone !== 'neutral'
  const iconColor = !active ? 'text-viz-muted' : tone === 'critical' ? 'text-viz-critical' : 'text-viz-warning'
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="flex items-center gap-2 text-sm text-viz-ink-2">
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
        {label}
      </span>
      <span className="text-sm font-semibold text-viz-ink tabular-nums">{value}</span>
    </div>
  )
}

function ResumoPainel({ titulo, to, children }: { titulo: string; to?: string; children: React.ReactNode }) {
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-medium uppercase tracking-wider text-viz-muted">{titulo}</h3>
        {to && (
          <Link to={to} className="text-xs text-viz-ink-2 hover:text-viz-ink inline-flex items-center gap-0.5">
            Ver <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const { showError } = useAlert()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
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
        <div className="flex flex-col items-center gap-3 text-viz-ink-2">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
          <span className="text-sm">A carregar overview...</span>
        </div>
      </div>
    )
  }

  const pendentes = data?.indicacoesPendentes ?? 0
  const variacao = data?.variacaoReceita ?? 0
  const receitaMeses = data?.receitaUltimosMeses ?? []
  const salaBarData = (data?.clientsBySala ?? []).map((s) => ({ nome: s.nome, clientes: s.totalClientes }))

  // Estado dos clientes: proporção numa barra + linhas com ícone e rótulo (a cor nunca é a única pista).
  const estados = [
    { key: 'ativos', label: 'Ativos', value: data?.totalClientes ?? 0, color: VIZ.good, Icon: CheckCircle2 },
    { key: 'vencidos', label: 'Vencidos', value: data?.clientesVencidos ?? 0, color: VIZ.critical, Icon: XCircle },
    { key: 'cancelados', label: 'Cancelados', value: data?.clientesCancelados ?? 0, color: VIZ.muted, Icon: MinusCircle },
  ]
  const totalEstados = estados.reduce((s, e) => s + e.value, 0)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Breadcrumb + título */}
      <div>
        <nav className="flex items-center gap-1.5 text-sm text-viz-muted mb-1">
          <span>Dashboard</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-viz-ink-2">Overview</span>
        </nav>
        <h1 className="text-2xl font-bold text-viz-ink tracking-tight flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-primary-600" />
          Overview
        </h1>
      </div>

      {/* Valor previsto a arrecadar no mês */}
      {data?.arrecadacaoMes && <ArrecadacaoMesCard data={data.arrecadacaoMes} />}

      {/* Indicadores principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile label="Clientes ativos" value={data?.totalClientes ?? 0} icon={Users} to="/clientes" />
        <KpiTile
          label="Receita do mês (est.)"
          value={kz(Number(data?.receitaMes ?? 0))}
          icon={DollarSign}
          hint={
            data?.receitaMesAnterior != null && data.receitaMesAnterior > 0 ? (
              <span className={`inline-flex items-center gap-1 ${variacao >= 0 ? 'text-viz-good' : 'text-viz-critical'}`}>
                {variacao >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {variacao >= 0 ? '+' : ''}
                {variacao}% <span className="text-viz-muted">vs mês anterior</span>
              </span>
            ) : undefined
          }
        />
        <KpiTile
          label="Vencem hoje"
          value={data?.vencendoHoje ?? 0}
          icon={AlertTriangle}
          attention={(data?.vencendoHoje ?? 0) > 0}
          to="/clientes"
        />
        <KpiTile
          label="Indicações pendentes"
          value={pendentes}
          icon={Gift}
          attention={pendentes > 0}
          to="/indicacoes"
        />
      </div>

      {/* Resumos: vencimentos, salas, este mês */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResumoPainel titulo="Vencimentos de clientes" to="/clientes">
          <ResumoLinha label="Vencem hoje" value={data?.vencendoHoje ?? 0} icon={CalendarClock} tone="warning" />
          <ResumoLinha label="Vencem em 7 dias" value={data?.vencendoEm7Dias ?? 0} icon={CalendarClock} tone="warning" />
          <ResumoLinha label="Vencidos" value={data?.clientesVencidos ?? 0} icon={XCircle} tone="critical" />
        </ResumoPainel>
        <ResumoPainel titulo="Salas Netflix" to="/salas">
          <ResumoLinha label="A vencer (7 dias)" value={data?.salasVencendo ?? 0} icon={LayoutGrid} tone="warning" />
          <ResumoLinha label="Contas vencidas" value={data?.salasVencidas ?? 0} icon={XCircle} tone="critical" />
          <ResumoLinha label="Total de salas" value={data?.clientsBySala?.length ?? 0} icon={LayoutGrid} />
        </ResumoPainel>
        <ResumoPainel titulo="Este mês" to="/indicacoes">
          <ResumoLinha label="Novos clientes" value={data?.clientesNovosEsteMes ?? 0} icon={UserPlus} />
          <ResumoLinha label="Indicações criadas" value={data?.indicacoesEsteMes ?? 0} icon={Gift} />
          <ResumoLinha label="Indicações confirmadas (total)" value={data?.indicacoesConfirmadas ?? 0} icon={CheckCircle2} />
        </ResumoPainel>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${CARD} lg:col-span-2`}>
          <h3 className="text-base font-semibold text-viz-ink">Receita por mês</h3>
          <p className="text-xs text-viz-muted mt-0.5 mb-4">
            Últimos 6 meses, em kz — estimativa pelas datas de renovação dos clientes.
          </p>
          <div className="h-[240px]">
            {receitaMeses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={receitaMeses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="receitaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={VIZ.series} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={VIZ.series} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={VIZ.grid} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: VIZ.muted, fontSize: 11 }}
                    axisLine={{ stroke: VIZ.axis }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: VIZ.muted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(v: number) => v.toLocaleString('pt-PT')}
                  />
                  <Tooltip
                    {...VIZ_TOOLTIP_STYLE}
                    cursor={{ stroke: VIZ.ink2, strokeWidth: 1, strokeDasharray: '3 3' }}
                    formatter={((value: number | undefined) => [kz(Number(value ?? 0)), 'Receita']) as never}
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke={VIZ.series}
                    strokeWidth={2}
                    fill="url(#receitaGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: VIZ.series, stroke: VIZ.surface, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-viz-muted text-sm">
                Sem dados de receita nos últimos 6 meses.
              </div>
            )}
          </div>
        </div>

        <div className={CARD}>
          <h3 className="text-base font-semibold text-viz-ink">Clientes por estado</h3>
          <p className="text-xs text-viz-muted mt-0.5 mb-4">{totalEstados} cliente(s) no total</p>
          {totalEstados > 0 ? (
            <>
              <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Proporção de clientes por estado">
                {estados
                  .filter((e) => e.value > 0)
                  .map((e) => (
                    <div
                      key={e.key}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${(e.value / totalEstados) * 100}%`, backgroundColor: e.color }}
                      title={`${e.label}: ${e.value}`}
                    />
                  ))}
              </div>
              <ul className="mt-4 space-y-1">
                {estados.map((e) => (
                  <li key={e.key} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="flex items-center gap-2 text-sm text-viz-ink-2">
                      <e.Icon className="w-4 h-4" style={{ color: e.color }} />
                      {e.label}
                    </span>
                    <span className="text-sm text-viz-ink tabular-nums">
                      <span className="font-semibold">{e.value}</span>
                      <span className="text-viz-muted ml-2">
                        {totalEstados > 0 ? Math.round((e.value / totalEstados) * 100) : 0}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="py-10 text-center text-viz-muted text-sm">Sem clientes para exibir.</div>
          )}
        </div>
      </div>

      {/* Clientes por sala */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-viz-ink">Clientes por sala</h3>
            <p className="text-xs text-viz-muted mt-0.5">Número de clientes em cada conta Netflix</p>
          </div>
          <Link to="/salas" className="text-xs text-viz-ink-2 hover:text-viz-ink inline-flex items-center gap-0.5">
            Ver salas <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div style={{ height: Math.max(120, salaBarData.length * 44 + 16) }}>
          {salaBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salaBarData} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barCategoryGap={10}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={170}
                  tick={{ fill: VIZ.ink2, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  {...VIZ_TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={((value: number | undefined) => [value ?? 0, 'Clientes']) as never}
                />
                <Bar dataKey="clientes" fill={VIZ.series} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  <LabelList dataKey="clientes" position="right" fill={VIZ.ink} fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-viz-muted text-sm">Sem dados de salas.</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
