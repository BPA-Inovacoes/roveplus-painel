import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell,
  Users,
  CalendarClock,
  AlertTriangle,
  Gift,
  Server,
  Store,
  DollarSign,
  ChevronRight,
  Tv,
  LayoutGrid,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

interface NotifData {
  totalNetflix?: number
  totalIptv?: number
  totalClientes?: number
  clientesVencidos?: number
  clientesCancelados?: number
  vencendoHoje?: number
  vencendoEm7Dias?: number
  clientesNovosEsteMes?: number
  indicacoesTotal?: number
  indicacoesPendentes?: number
  indicacoesConfirmadas?: number
  indicacoesEsteMes?: number
  totalRevendedores?: number
  clientesComRevendedor?: number
  receitaMes?: number
  valorVencidoTotal?: number
  clientsByServidor?: { id: number; nome: string; totalClientes: number; status: string }[]
  salasVencendo?: number
  salasVencidas?: number
}

function IndicatorCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  variant = 'default',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  href?: string
  variant?: 'default' | 'warning' | 'danger' | 'success'
}) {
  const variantStyles = {
    default: 'border-netflix-border/80 bg-netflix-card/80',
    warning: 'border-amber-500/50 bg-amber-900/20',
    danger: 'border-red-500/50 bg-red-900/20',
    success: 'border-green-500/50 bg-green-900/20',
  }
  const content = (
    <div className={`rounded-xl border p-4 ${variantStyles[variant]} transition-colors hover:bg-netflix-hover/50`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-white/10 shrink-0">
          <Icon className="w-5 h-5 text-gray-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-xl font-bold text-white mt-0.5">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        {href && <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />}
      </div>
    </div>
  )
  if (href) {
    return <Link to={href}>{content}</Link>
  }
  return content
}

export default function Notificacoes() {
  const { user } = useAuth()
  const [data, setData] = useState<NotifData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<NotifData>('/api/dashboard')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const role = user?.role
  const showNetflix = role !== 'iptv'
  const showIptv = role !== 'netflix'
  const showServidores = ['admin', 'geral', 'iptv', 'suporte'].includes(role ?? '')
  const showRevendedores = showServidores

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
          <span className="text-sm">A carregar indicadores...</span>
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
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Notificações
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Todos os indicadores do painel num só lugar. Use os cards para aceder às respetivas áreas.
        </p>
      </div>

      {/* Clientes */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-400" />
          Clientes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <IndicatorCard
            icon={CalendarClock}
            label="Vencem hoje"
            value={data?.vencendoHoje ?? 0}
            sub="Renovações com data fim hoje"
            href="/clientes"
            variant={Number(data?.vencendoHoje ?? 0) > 0 ? 'warning' : 'default'}
          />
          <IndicatorCard
            icon={CalendarClock}
            label="Vencem em 7 dias"
            value={data?.vencendoEm7Dias ?? 0}
            sub="Próxima semana"
            href="/clientes"
            variant={Number(data?.vencendoEm7Dias ?? 0) > 0 ? 'warning' : 'default'}
          />
          <IndicatorCard
            icon={AlertTriangle}
            label="Vencidos"
            value={data?.clientesVencidos ?? 0}
            sub="Renovação em atraso"
            href="/clientes?status=vencido"
            variant={Number(data?.clientesVencidos ?? 0) > 0 ? 'danger' : 'default'}
          />
          <IndicatorCard
            icon={Users}
            label="Cancelados"
            value={data?.clientesCancelados ?? 0}
            sub="Clientes cancelados"
            href="/clientes?status=cancelado"
          />
          <IndicatorCard
            icon={UserPlus}
            label="Novos este mês"
            value={data?.clientesNovosEsteMes ?? 0}
            sub="Clientes criados no mês atual"
            href="/clientes"
            variant={Number(data?.clientesNovosEsteMes ?? 0) > 0 ? 'success' : 'default'}
          />
          <IndicatorCard
            icon={Users}
            label="Total clientes"
            value={data?.totalClientes ?? 0}
            sub="Clientes ativos"
            href="/clientes"
          />
          {showNetflix && (
            <IndicatorCard
              icon={Tv}
              label="Netflix"
              value={data?.totalNetflix ?? 0}
              sub="Clientes ativos Netflix"
              href="/clientes"
            />
          )}
          {showIptv && (
            <IndicatorCard
              icon={Server}
              label="IPTV"
              value={data?.totalIptv ?? 0}
              sub="Clientes ativos IPTV"
              href="/clientes"
            />
          )}
        </div>
      </section>

      {/* Indicações */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary-400" />
          Indicações
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <IndicatorCard
            icon={Gift}
            label="Total indicações"
            value={data?.indicacoesTotal ?? 0}
            href="/indicacoes"
          />
          <IndicatorCard
            icon={AlertTriangle}
            label="Pendentes"
            value={data?.indicacoesPendentes ?? 0}
            sub="Por confirmar"
            href="/indicacoes"
            variant={Number(data?.indicacoesPendentes ?? 0) > 0 ? 'warning' : 'default'}
          />
          <IndicatorCard
            icon={Users}
            label="Confirmadas"
            value={data?.indicacoesConfirmadas ?? 0}
            href="/indicacoes"
          />
          <IndicatorCard
            icon={CalendarClock}
            label="Este mês"
            value={data?.indicacoesEsteMes ?? 0}
            sub="Indicações criadas no mês"
            href="/indicacoes"
          />
        </div>
      </section>

      {/* Servidores (IPTV) */}
      {showServidores && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            Servidores
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.clientsByServidor ?? []).map((s) => (
              <IndicatorCard
                key={s.id}
                icon={Server}
                label={s.nome}
                value={s.totalClientes}
                sub={`${s.totalClientes} clientes • ${s.status}`}
                href="/servidores"
                variant={s.status !== 'online' ? 'warning' : 'default'}
              />
            ))}
            {(!data?.clientsByServidor || data.clientsByServidor.length === 0) && (
              <p className="text-sm text-gray-500 col-span-full">Nenhum servidor.</p>
            )}
          </div>
        </section>
      )}

      {/* Revendedores */}
      {showRevendedores && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Store className="w-5 h-5 text-gray-400" />
            Revendedores
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IndicatorCard
              icon={Store}
              label="Total revendedores"
              value={data?.totalRevendedores ?? 0}
              href="/revendedores"
            />
            <IndicatorCard
              icon={Users}
              label="Clientes com revendedor"
              value={data?.clientesComRevendedor ?? 0}
              sub="Atribuídos a um revendedor"
              href="/clientes"
            />
          </div>
        </section>
      )}

      {/* Salas Netflix */}
      {showNetflix && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary-400" />
            Salas Netflix
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <IndicatorCard
              icon={LayoutGrid}
              label="Salas a vencer (7 dias)"
              value={data?.salasVencendo ?? 0}
              sub="Pagamento nos próximos 7 dias"
              href="/salas"
              variant={Number(data?.salasVencendo ?? 0) > 0 ? 'warning' : 'default'}
            />
            <IndicatorCard
              icon={AlertTriangle}
              label="Salas vencidas"
              value={data?.salasVencidas ?? 0}
              sub="Data fim já passou"
              href="/salas"
              variant={Number(data?.salasVencidas ?? 0) > 0 ? 'danger' : 'default'}
            />
            <Link to="/salas" className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-4 flex items-center gap-3 hover:bg-netflix-hover/50 transition-colors">
              <LayoutGrid className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-300">Ver todas as salas</span>
              <ChevronRight className="w-5 h-5 text-gray-500 ml-auto" />
            </Link>
          </div>
        </section>
      )}

      {/* Financeiro (resumo) */}
      {role === 'admin' && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Financeiro
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IndicatorCard
              icon={Wallet}
              label="Receita deste mês (est.)"
              value={`${Number(data?.receitaMes ?? 0).toFixed(2)} kz`}
              href="/financeiro"
            />
            <IndicatorCard
              icon={AlertTriangle}
              label="Total em dívida"
              value={`${Number(data?.valorVencidoTotal ?? 0).toFixed(2)} kz`}
              sub="Clientes vencidos"
              href="/financeiro"
              variant={Number(data?.valorVencidoTotal ?? 0) > 0 ? 'danger' : 'default'}
            />
          </div>
        </section>
      )}
    </motion.div>
  )
}
