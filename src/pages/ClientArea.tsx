import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LogOut,
  Calendar,
  Tv,
  Film,
  Server,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  MapPin,
  Clock,
  Gift,
  UserPlus,
  Phone,
  User,
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react'
import { clientPortalApi } from '../api/clientPortal'
import { useClientPortal } from '../contexts/ClientPortalContext'
import { useAlert } from '../contexts/AlertContext'

const WA_BUSINESS = '244933623143'

export interface ClientPortalMe {
  id: number
  nome: string
  whatsapp: string
  servico: string
  plano: string
  status: string
  dataInicio: string
  dataFim: string
  valor: number
  perfil: string | null
  pin: string | null
  localizacao: string | null
  sala: { id: number; nome: string; dataFim: string | null } | null
  servidor: { id: number; nome: string; status: string } | null
  revendedor: { nome: string } | null
  iptvUser: string | null
  iptvPassSet: boolean
  iptvMac: string | null
  iptvM3u: string | null
  inscricaoPaga: boolean | null
  /** Total de indicações registadas (contador no perfil) */
  indicacoes: number
}

export interface PortalIndicacaoRow {
  id: number
  indicadoNome: string
  indicadoWhatsapp: string
  status: string
  createdAt: string
}

export interface PortalNotificacaoItem {
  id: string
  tipo: 'info' | 'warning' | 'success' | 'danger'
  titulo: string
  mensagem: string
  em?: string
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('pt-BR')
}

function daysUntil(dateStr: string) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function statusLabel(s: string) {
  if (s === 'ativo')
    return { text: 'Ativo', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/35 shadow-sm shadow-emerald-900/20' }
  if (s === 'vencido')
    return { text: 'Vencido', className: 'bg-amber-500/15 text-amber-200 border-amber-500/35 shadow-sm shadow-amber-900/20' }
  if (s === 'cancelado')
    return { text: 'Cancelado', className: 'bg-gray-600/25 text-gray-300 border-gray-500/35' }
  return { text: s, className: 'bg-white/10 text-gray-200 border-white/20' }
}

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? '?'
  const b = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (a + b).toUpperCase()
}

/** Ordem fixa — alinhada com o mini menu (Netflix/IPTV partilham `cliente-servico`). */
const SECTION_IDS = [
  'cliente-inicio',
  'cliente-notificacoes',
  'cliente-renovacao',
  'cliente-servico',
  'cliente-indicacoes',
  'cliente-contacto',
] as const

/** Linha de referência (px desde o topo da viewport): secção ativa = última cujo topo já passou abaixo do cabeçalho fixo. */
const SCROLL_SPY_OFFSET_PX = 128

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function NotificacaoTipoIcon({ tipo }: { tipo: PortalNotificacaoItem['tipo'] }) {
  switch (tipo) {
    case 'danger':
      return <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" aria-hidden />
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" aria-hidden />
    case 'success':
      return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden />
    default:
      return <Info className="w-5 h-5 text-sky-400 shrink-0" aria-hidden />
  }
}

function InfoRow({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 py-3 border-b border-white/[0.06] last:border-0 last:pb-0 first:pt-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0 sm:w-36">{label}</span>
      <div className={`text-sm text-white ${mono ? 'font-mono text-[13px] break-all' : ''}`}>{children}</div>
    </div>
  )
}

export default function ClientArea() {
  const { client, logout } = useClientPortal()
  const { showInfo, showError } = useAlert()
  const [me, setMe] = useState<ClientPortalMe | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [minhasIndicacoes, setMinhasIndicacoes] = useState<PortalIndicacaoRow[]>([])
  const [indicacoesLoading, setIndicacoesLoading] = useState(false)
  const [indForm, setIndForm] = useState({ nome: '', whatsapp: '' })
  const [indSubmitting, setIndSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('cliente-inicio')
  const [portalNotifs, setPortalNotifs] = useState<PortalNotificacaoItem[]>([])
  const [notifsLoading, setNotifsLoading] = useState(false)

  useEffect(() => {
    if (!client) return
    clientPortalApi
      .get<ClientPortalMe>('/api/client-portal/me')
      .then(setMe)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar dados'))
  }, [client])

  useEffect(() => {
    if (!me) return
    setIndicacoesLoading(true)
    clientPortalApi
      .get<PortalIndicacaoRow[]>('/api/client-portal/indicacoes')
      .then(setMinhasIndicacoes)
      .catch(() => setMinhasIndicacoes([]))
      .finally(() => setIndicacoesLoading(false))
  }, [me?.id])

  useEffect(() => {
    if (!me) return
    setNotifsLoading(true)
    clientPortalApi
      .get<{ items: PortalNotificacaoItem[] }>('/api/client-portal/notificacoes')
      .then((r) => setPortalNotifs(r.items))
      .catch(() => setPortalNotifs([]))
      .finally(() => setNotifsLoading(false))
  }, [me?.id, me?.dataFim, me?.status])

  useEffect(() => {
    if (!me) return
    function updateActiveFromScroll() {
      let current: string = SECTION_IDS[0]
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= SCROLL_SPY_OFFSET_PX) {
          current = id
        }
      }
      setActiveSection((prev) => (prev === current ? prev : current))
    }
    updateActiveFromScroll()
    window.addEventListener('scroll', updateActiveFromScroll, { passive: true })
    window.addEventListener('resize', updateActiveFromScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateActiveFromScroll)
      window.removeEventListener('resize', updateActiveFromScroll)
    }
  }, [me])

  async function handleLogout() {
    await logout()
    window.location.href = '/cliente/login'
  }

  async function copyM3u(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function handleSubmitIndicacao(e: React.FormEvent) {
    e.preventDefault()
    const nome = indForm.nome.trim()
    const wa = indForm.whatsapp.trim()
    if (nome.length < 2) {
      showError('Indique o nome completo da pessoa (mín. 2 caracteres).')
      return
    }
    if (!wa) {
      showError('Indique o WhatsApp de quem vai ser contactado.')
      return
    }
    setIndSubmitting(true)
    try {
      await clientPortalApi.post('/api/client-portal/indicacoes', {
        indicadoNome: nome,
        indicadoWhatsapp: wa,
      })
      setIndForm({ nome: '', whatsapp: '' })
      const [freshMe, list] = await Promise.all([
        clientPortalApi.get<ClientPortalMe>('/api/client-portal/me'),
        clientPortalApi.get<PortalIndicacaoRow[]>('/api/client-portal/indicacoes'),
      ])
      setMe(freshMe)
      setMinhasIndicacoes(list)
      clientPortalApi
        .get<{ items: PortalNotificacaoItem[] }>('/api/client-portal/notificacoes')
        .then((r) => setPortalNotifs(r.items))
        .catch(() => {})
      showInfo('Indicação registada. A equipa irá validar em breve.')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Não foi possível registar a indicação.')
    } finally {
      setIndSubmitting(false)
    }
  }

  const daysLeft = useMemo(() => (me ? daysUntil(me.dataFim) : 0), [me])

  const renewalAccent = useMemo(() => {
    if (!me || me.status !== 'ativo') return 'from-amber-500/20 to-transparent'
    if (daysLeft <= 7) return 'from-red-500/25 to-transparent'
    if (daysLeft <= 30) return 'from-amber-500/20 to-transparent'
    return 'from-emerald-500/15 to-transparent'
  }, [me, daysLeft])

  if (error) {
    return (
      <div className="min-h-screen bg-netflix-bg flex items-center justify-center p-6 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(229,9,20,0.12),transparent)]" />
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative max-w-md w-full rounded-2xl border border-red-500/30 bg-netflix-card/95 backdrop-blur-xl p-8 text-center shadow-2xl shadow-black/40"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
            <span className="text-2xl">!</span>
          </div>
          <p className="text-red-200 text-sm leading-relaxed">{error}</p>
          <Link
            to="/cliente/login"
            className="inline-block mt-6 text-primary-400 hover:text-primary-300 text-sm font-medium"
          >
            Voltar ao login
          </Link>
        </motion.div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-netflix-bg flex flex-col items-center justify-center gap-6 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_20%,rgba(229,9,20,0.08),transparent)]" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-full border-2 border-primary-600/30" />
            <div className="absolute inset-0 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-gray-400 text-sm">A carregar a sua conta…</p>
        </div>
      </div>
    )
  }

  const st = statusLabel(me.status)
  const waDigits = me.whatsapp.replace(/\D/g, '')
  const firstName = me.nome.split(/\s+/)[0]

  const alertNotifCount = portalNotifs.filter((n) => n.tipo === 'warning' || n.tipo === 'danger').length

  const miniMenuItems = [
    { id: 'cliente-inicio', label: 'Início', Icon: User },
    { id: 'cliente-notificacoes', label: 'Avisos', Icon: Bell },
    { id: 'cliente-renovacao', label: 'Renovação', Icon: Calendar },
    {
      id: 'cliente-servico',
      label: me.servico === 'netflix' ? 'Netflix' : 'IPTV',
      Icon: me.servico === 'netflix' ? Film : Tv,
    },
    { id: 'cliente-indicacoes', label: 'Indicações', Icon: Gift },
    { id: 'cliente-contacto', label: 'Contacto', Icon: MessageCircle },
  ] as const

  return (
    <div className="min-h-screen bg-netflix-bg text-gray-200 relative overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(229,9,20,0.14),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(139,92,246,0.08),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025] bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:40px_40px]"
        aria-hidden
      />

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-netflix-bg/85 backdrop-blur-xl shadow-sm shadow-black/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5">
          <div className="flex flex-col gap-2 sm:gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <Link to="/cliente" className="flex items-center gap-3 min-w-0 flex-1 group">
                <img
                  src="/logo/logo-w.png"
                  alt="Rove+"
                  className="h-8 sm:h-9 w-auto shrink-0 object-contain opacity-95 group-hover:opacity-100 transition-opacity"
                />
                <div className="hidden sm:block min-w-0 text-left">
                  <span className="text-white font-semibold text-sm tracking-tight block truncate">Área cliente</span>
                  <span className="text-[11px] text-gray-500 block">Rove+</span>
                </div>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex shrink-0 items-center gap-2 text-sm text-gray-300 hover:text-white px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
            <nav className="min-w-0 w-full border-t border-white/[0.06] pt-2 sm:pt-2.5" aria-label="Secções da área cliente">
              <div className="flex flex-nowrap sm:flex-wrap gap-1.5 justify-center items-center overflow-x-auto overflow-y-visible -mx-0.5 px-0.5 [scrollbar-width:thin] sm:overflow-x-visible">
                {miniMenuItems.map(({ id, label, Icon }) => {
                  const isActive = activeSection === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setActiveSection(id)
                        scrollToSection(id)
                      }}
                      aria-current={isActive ? 'true' : undefined}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? 'border border-primary-500/70 bg-primary-600/30 text-white shadow-[0_0_16px_rgba(229,9,20,0.22)] ring-1 ring-primary-500/40'
                          : 'border border-white/[0.08] bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white hover:border-white/15'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary-200' : 'opacity-80'}`} aria-hidden />
                      {label}
                      {id === 'cliente-notificacoes' && alertNotifCount > 0 && (
                        <span className="min-w-[1.125rem] h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-black leading-4 tabular-nums">
                          {alertNotifCount > 9 ? '9+' : alertNotifCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10 space-y-8">
        <motion.section
          id="cliente-inicio"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative scroll-mt-36 rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-netflix-card via-netflix-card to-netflix-panel/80 shadow-xl shadow-black/30"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${renewalAccent} pointer-events-none`} />
          <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg ring-2 ring-white/10 bg-gradient-to-br from-primary-600 to-primary-800"
              aria-hidden
            >
              {initials(me.nome)}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-gray-400 text-sm">Bem-vindo de volta</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Olá, <span className="text-white">{firstName}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${st.className}`}>
                  {st.text}
                </span>
                {me.localizacao && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="w-3.5 h-3.5" />
                    {me.localizacao}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          id="cliente-notificacoes"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="scroll-mt-36 rounded-2xl border border-sky-500/20 bg-gradient-to-b from-sky-950/20 to-netflix-card/70 backdrop-blur-sm p-6 sm:p-7 shadow-lg shadow-black/20 ring-1 ring-sky-500/10"
          aria-labelledby="titulo-notificacoes"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-500/30">
                <Bell className="w-5 h-5 text-sky-400" aria-hidden />
              </div>
              <div>
                <h2 id="titulo-notificacoes" className="text-lg font-semibold text-white">
                  Notificações e avisos
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Alertas sobre a sua conta e renovação</p>
              </div>
            </div>
            {alertNotifCount > 0 && (
              <span className="inline-flex items-center gap-1.5 self-start sm:self-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-200 border border-amber-500/35">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                {alertNotifCount} {alertNotifCount === 1 ? 'alerta' : 'alertas'}
              </span>
            )}
          </div>

          {notifsLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-9 w-9 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
            </div>
          ) : portalNotifs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8 rounded-xl border border-dashed border-netflix-border/60 bg-netflix-panel/30">
              Sem avisos de momento.
            </p>
          ) : (
            <ul className="space-y-3">
              {portalNotifs.map((n) => {
                const card =
                  n.tipo === 'danger'
                    ? 'border-red-500/35 bg-red-950/20'
                    : n.tipo === 'warning'
                      ? 'border-amber-500/35 bg-amber-950/15'
                      : n.tipo === 'success'
                        ? 'border-emerald-500/35 bg-emerald-950/15'
                        : 'border-sky-500/25 bg-sky-950/10'
                return (
                  <li
                    key={n.id}
                    className={`flex gap-3 p-4 rounded-xl border ${card}`}
                  >
                    <NotificacaoTipoIcon tipo={n.tipo} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white text-sm">{n.titulo}</p>
                      <p className="text-sm text-gray-400 mt-1 leading-relaxed">{n.mensagem}</p>
                      {n.em && (
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(n.em).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </motion.section>

        <motion.section
          id="cliente-renovacao"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="scroll-mt-36 rounded-2xl border border-netflix-border/90 bg-netflix-card/70 backdrop-blur-sm p-6 sm:p-7 shadow-lg shadow-black/20 ring-1 ring-white/[0.03]"
        >
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600/20 border border-primary-500/25">
                <Calendar className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Renovação e plano</h2>
                <p className="text-xs text-gray-500 mt-0.5">Valores e datas do seu contrato</p>
              </div>
            </div>
            {me.status === 'ativo' && (
              <div
                className={`hidden sm:flex flex-col items-end text-right ${daysLeft <= 7 ? 'text-amber-300' : daysLeft <= 30 ? 'text-amber-200/90' : 'text-emerald-300/90'}`}
              >
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Faltam</span>
                <span className="text-xl font-bold tabular-nums leading-none">{Math.max(0, daysLeft)}</span>
                <span className="text-[10px] text-gray-500">dias</span>
              </div>
            )}
          </div>

          {me.status === 'ativo' && (
            <div className="mb-6 rounded-xl bg-netflix-panel/50 border border-white/[0.05] p-4 flex items-center gap-3 sm:hidden">
              <Clock className={`w-5 h-5 shrink-0 ${daysLeft <= 7 ? 'text-amber-400' : 'text-emerald-400/90'}`} />
              <div>
                <p className="text-xs text-gray-500">Próxima renovação em</p>
                <p className="text-lg font-semibold text-white tabular-nums">{Math.max(0, daysLeft)} dias</p>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-0 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
            <div className="sm:pr-8 space-y-0 pb-4 sm:pb-0">
              <InfoRow label="Próxima data">{formatDate(me.dataFim)}</InfoRow>
              <InfoRow label="Valor mensal">{Number(me.valor).toLocaleString('pt-BR')} kz</InfoRow>
            </div>
            <div className="sm:pl-8 space-y-0 pt-4 sm:pt-0">
              <InfoRow label="Plano">{me.plano}</InfoRow>
              <InfoRow label="Serviço">
                <span className="inline-flex items-center gap-2">
                  {me.servico === 'netflix' ? (
                    <Film className="w-4 h-4 text-red-400 shrink-0" />
                  ) : (
                    <Tv className="w-4 h-4 text-violet-400 shrink-0" />
                  )}
                  {me.servico === 'netflix' ? 'Netflix' : 'IPTV'}
                </span>
              </InfoRow>
              <InfoRow label="Indicações (total)">
                <span className="inline-flex items-center gap-2">
                  <Gift className="w-4 h-4 text-amber-400/90 shrink-0" />
                  {me.indicacoes ?? 0}
                </span>
              </InfoRow>
            </div>
          </div>
        </motion.section>

        {me.servico === 'netflix' && (
          <motion.section
            id="cliente-servico"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="scroll-mt-36 rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-950/20 to-netflix-card/60 backdrop-blur-sm p-6 sm:p-7 shadow-lg shadow-black/20 ring-1 ring-red-500/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 border border-red-500/25">
                <Film className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Netflix</h2>
                <p className="text-xs text-gray-500">Dados do seu perfil</p>
              </div>
            </div>
            <div className="divide-y divide-white/[0.06]">
              <InfoRow label="Perfil">{me.perfil || '—'}</InfoRow>
              {me.pin && (
                <InfoRow label="PIN do perfil" mono>
                  {me.pin}
                </InfoRow>
              )}
              {me.sala && <InfoRow label="Sala / conta">{me.sala.nome}</InfoRow>}
              {me.inscricaoPaga != null && (
                <InfoRow label="Inscrição paga">{me.inscricaoPaga ? 'Sim' : 'Não'}</InfoRow>
              )}
            </div>
          </motion.section>
        )}

        {me.servico === 'iptv' && (
          <motion.section
            id="cliente-servico"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="scroll-mt-36 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/25 to-netflix-card/60 backdrop-blur-sm p-6 sm:p-7 shadow-lg shadow-black/20 ring-1 ring-violet-500/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/25">
                <Tv className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">IPTV</h2>
                <p className="text-xs text-gray-500">Linha e servidor</p>
              </div>
            </div>
            <div className="divide-y divide-white/[0.06]">
              <InfoRow label="Utilizador / linha" mono>
                {me.perfil || me.iptvUser || '—'}
              </InfoRow>
              <InfoRow label="Palavra-passe">
                {me.iptvPassSet ? 'Definida — peça à Rove+ se precisar' : '—'}
              </InfoRow>
              {me.iptvMac && (
                <InfoRow label="MAC" mono>
                  {me.iptvMac}
                </InfoRow>
              )}
              {me.iptvM3u && (
                <div className="py-3 border-b border-white/[0.06] last:border-0">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lista M3U</span>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                      <p className="text-xs text-primary-300/95 font-mono break-all flex-1 leading-relaxed">{me.iptvM3u}</p>
                      <button
                        type="button"
                        onClick={() => copyM3u(me.iptvM3u!)}
                        className="inline-flex items-center justify-center gap-1.5 shrink-0 px-3 py-2 rounded-lg border border-primary-500/30 bg-primary-600/15 text-primary-300 text-xs font-medium hover:bg-primary-600/25 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {me.servidor && (
                <InfoRow label="Servidor">
                  <span className="inline-flex items-center gap-2 flex-wrap">
                    <Server className="w-4 h-4 text-gray-500 shrink-0" />
                    {me.servidor.nome}
                    <span className="text-xs text-gray-500">({me.servidor.status})</span>
                  </span>
                </InfoRow>
              )}
              {me.revendedor && <InfoRow label="Revendedor">{me.revendedor.nome}</InfoRow>}
            </div>
          </motion.section>
        )}

        <motion.section
          id="cliente-indicacoes"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="scroll-mt-36 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-950/15 to-netflix-card/60 backdrop-blur-sm p-6 sm:p-7 shadow-lg shadow-black/20 ring-1 ring-amber-500/10"
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/25">
              <Gift className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white">Indique amigos</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Registe o nome e WhatsApp de quem quer indicar à Rove+. Ficam em análise até a equipa confirmar.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitIndicacao} className="space-y-4 mb-8">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ind-nome" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Nome completo do indicado
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/60 pointer-events-none" />
                  <input
                    id="ind-nome"
                    type="text"
                    value={indForm.nome}
                    onChange={(e) => setIndForm((f) => ({ ...f, nome: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2.5 bg-netflix-panel/80 border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/40 outline-none"
                    placeholder="Nome de quem vai ser contactado"
                    autoComplete="name"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="ind-wa" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  WhatsApp do indicado
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/60 pointer-events-none" />
                  <input
                    id="ind-wa"
                    type="text"
                    inputMode="tel"
                    value={indForm.whatsapp}
                    onChange={(e) => setIndForm((f) => ({ ...f, whatsapp: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2.5 bg-netflix-panel/80 border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/40 outline-none"
                    placeholder="+244 9XX XXX XXX"
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={indSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-b from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-sm font-semibold shadow-lg shadow-amber-950/30 border border-amber-500/20 disabled:opacity-50 transition-colors"
            >
              <Gift className="w-4 h-4" />
              {indSubmitting ? 'A registar…' : 'Registar indicação'}
            </button>
          </form>

          <div className="border-t border-white/[0.06] pt-6">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              As suas indicações
              <span className="text-xs font-normal text-gray-500">
                ({indicacoesLoading ? '…' : minhasIndicacoes.length})
              </span>
            </h3>
            {indicacoesLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
              </div>
            ) : minhasIndicacoes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6 rounded-xl bg-netflix-panel/30 border border-dashed border-netflix-border/60">
                Ainda não tem indicações registadas. Use o formulário acima.
              </p>
            ) : (
              <ul className="space-y-2">
                {minhasIndicacoes.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 rounded-xl bg-netflix-panel/50 border border-white/[0.06]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{row.indicadoNome}</p>
                      <p className="text-xs text-gray-500 font-mono">{row.indicadoWhatsapp}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          row.status === 'confirmada'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
                        }`}
                      >
                        {row.status === 'confirmada' ? 'Confirmada' : 'Pendente'}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>

        <motion.section
          id="cliente-contacto"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="scroll-mt-36 rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/20 via-netflix-panel/30 to-netflix-card/50 p-6 sm:p-7 shadow-lg shadow-black/20"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Contacto</h2>
              <p className="text-xs text-gray-500">Dúvidas ou renovação</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-5 leading-relaxed">
            Fale connosco no WhatsApp da Rove+ — estamos aqui para ajudar.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://wa.me/${WA_BUSINESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-b from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white text-sm font-semibold shadow-lg shadow-green-950/40 border border-green-500/20 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp Rove+
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
            {waDigits && (
              <a
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-netflix-border bg-netflix-panel/60 text-gray-200 hover:bg-netflix-hover text-sm font-medium transition-colors"
              >
                Abrir o meu número
              </a>
            )}
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600 max-w-md mx-auto leading-relaxed px-2">
          Os dados refletem o registo na Rove+. Em caso de divergência, contacte o suporte.
        </p>
      </main>
    </div>
  )
}
