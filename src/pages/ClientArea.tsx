import { useEffect, useState, useMemo, useCallback } from 'react'
import { RoveModalOverlay } from '../components/RoveModalOverlay'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  Bot,
  Globe,
  KeyRound,
  CreditCard,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { clientPortalApi } from '../api/clientPortal'
import { useClientPortal } from '../contexts/ClientPortalContext'
import { useAlert } from '../contexts/AlertContext'
import { ROVE_PUBLIC_SITE_URL } from '../lib/roveSite'
import { NETFLIX_LOGIN_URL } from '../lib/netflix'
import { ClientAssistantBot, type ClientTab } from '../components/cliente/ClientAssistantBot'

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
  iptvPass: string | null
  iptvMac: string | null
  iptvM3u: string | null
  inscricaoPaga: boolean | null
  indicacoes: number
  portalFirstLogin: boolean
  roveId: string | null
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
    return { text: 'Ativo', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/35' }
  if (s === 'vencido')
    return { text: 'Vencido', className: 'bg-amber-500/15 text-amber-200 border-amber-500/35' }
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

function buildRenewWaText(me: ClientPortalMe) {
  const lines = [
    'Olá Rove+, quero renovar o meu plano.',
    `Cliente: ${me.nome}`,
    `Plano: ${me.plano} (${me.servico === 'netflix' ? 'Netflix' : 'IPTV'})`,
    `Vencimento: ${formatDate(me.dataFim)}`,
    `Valor mensal: ${Number(me.valor).toLocaleString('pt-BR')} kz`,
  ]
  if (me.roveId) lines.push(`ID ROVE: ${me.roveId}`)
  return encodeURIComponent(lines.join('\n'))
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

function CopyField({
  label,
  value,
  fieldId,
  copiedField,
  onCopy,
  mono = true,
}: {
  label: string
  value: string
  fieldId: string
  copiedField: string | null
  onCopy: (text: string, id: string) => void
  mono?: boolean
}) {
  const copied = copiedField === fieldId
  return (
    <div className="py-3 border-b border-white/[0.06] last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">{label}</span>
      <div className="flex items-start gap-2">
        <p className={`text-sm text-white flex-1 min-w-0 break-all ${mono ? 'font-mono text-[13px]' : ''}`}>
          {value}
        </p>
        <button
          type="button"
          onClick={() => onCopy(value, fieldId)}
          className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-gray-300 text-xs hover:bg-white/[0.08] transition-colors"
          aria-label={`Copiar ${label}`}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 py-3 border-b border-white/[0.06] last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0 sm:w-36">{label}</span>
      <div className={`text-sm text-white ${mono ? 'font-mono text-[13px] break-all' : ''}`}>{children}</div>
    </div>
  )
}

function NotificacoesList({
  items,
  loading,
  compact,
}: {
  items: PortalNotificacaoItem[]
  loading: boolean
  compact?: boolean
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6 rounded-xl border border-dashed border-netflix-border/60 bg-netflix-panel/30">
        Sem avisos de momento.
      </p>
    )
  }
  const list = compact ? items.slice(0, 3) : items
  return (
    <ul className="space-y-2.5">
      {list.map((n) => {
        const card =
          n.tipo === 'danger'
            ? 'border-red-500/35 bg-red-950/20'
            : n.tipo === 'warning'
              ? 'border-amber-500/35 bg-amber-950/15'
              : n.tipo === 'success'
                ? 'border-emerald-500/35 bg-emerald-950/15'
                : 'border-sky-500/25 bg-sky-950/10'
        return (
          <li key={n.id} className={`flex gap-3 p-3.5 rounded-xl border ${card}`}>
            <NotificacaoTipoIcon tipo={n.tipo} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white text-sm">{n.titulo}</p>
              <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{n.mensagem}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function ClientArea() {
  const { client, logout } = useClientPortal()
  const { showInfo, showError } = useAlert()
  const [tab, setTab] = useState<ClientTab>('inicio')
  const [me, setMe] = useState<ClientPortalMe | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [minhasIndicacoes, setMinhasIndicacoes] = useState<PortalIndicacaoRow[]>([])
  const [indicacoesLoading, setIndicacoesLoading] = useState(false)
  const [indForm, setIndForm] = useState({ nome: '', whatsapp: '' })
  const [indSubmitting, setIndSubmitting] = useState(false)
  const [portalNotifs, setPortalNotifs] = useState<PortalNotificacaoItem[]>([])
  const [notifsLoading, setNotifsLoading] = useState(false)
  const [showChangePinModal, setShowChangePinModal] = useState(false)
  const [changePinForm, setChangePinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' })
  const [changingPin, setChangingPin] = useState(false)

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
    if (!me?.portalFirstLogin) return
    setShowChangePinModal(true)
  }, [me?.id, me?.portalFirstLogin])

  const copyText = useCallback(async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldId)
      window.setTimeout(() => setCopiedField(null), 2000)
    } catch {
      showError('Não foi possível copiar. Tente selecionar manualmente.')
    }
  }, [showError])

  async function handleLogout() {
    await logout()
    window.location.href = '/'
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

  async function handleChangePortalPin(e: React.FormEvent) {
    e.preventDefault()
    const atual = changePinForm.currentPin.trim()
    const novo = changePinForm.newPin.trim()
    const conf = changePinForm.confirmPin.trim()
    if (!atual || !novo || !conf) {
      showError('Preencha PIN atual, novo PIN e confirmação.')
      return
    }
    if (novo.length < 6) {
      showError('O novo PIN deve ter pelo menos 6 caracteres.')
      return
    }
    if (novo !== conf) {
      showError('A confirmação do PIN não coincide.')
      return
    }
    setChangingPin(true)
    try {
      await clientPortalApi.post('/api/client-portal/change-pin', {
        currentPin: atual,
        newPin: novo,
      })
      const [freshMe, freshNotifs] = await Promise.all([
        clientPortalApi.get<ClientPortalMe>('/api/client-portal/me'),
        clientPortalApi.get<{ items: PortalNotificacaoItem[] }>('/api/client-portal/notificacoes'),
      ])
      setMe(freshMe)
      setPortalNotifs(freshNotifs.items)
      setShowChangePinModal(false)
      setChangePinForm({ currentPin: '', newPin: '', confirmPin: '' })
      showInfo('PIN alterado com sucesso.')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Não foi possível alterar o PIN.')
    } finally {
      setChangingPin(false)
    }
  }

  const daysLeft = useMemo(() => (me ? daysUntil(me.dataFim) : 0), [me])
  const alertNotifCount = portalNotifs.filter((n) => n.tipo === 'warning' || n.tipo === 'danger').length
  const renewalProgress = useMemo(() => {
    if (!me || me.status !== 'ativo') return 0
    return Math.min(100, Math.max(0, (Math.max(0, daysLeft) / 30) * 100))
  }, [me, daysLeft])

  const needsUrgentRenewal =
    me && (me.status === 'vencido' || me.status === 'cancelado' || (me.status === 'ativo' && daysLeft <= 7))

  if (error) {
    return (
      <div className="min-h-screen bg-netflix-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-netflix-card/95 p-8 text-center">
          <p className="text-red-200 text-sm">{error}</p>
          <Link to="/" className="inline-block mt-6 text-primary-400 hover:text-primary-300 text-sm font-medium">
            Voltar ao login
          </Link>
        </div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-netflix-bg flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
        <p className="text-gray-400 text-sm">A carregar a sua conta…</p>
      </div>
    )
  }

  const st = statusLabel(me.status)
  const mustChangePinNow = me.portalFirstLogin
  const clientMe = me
  const waBotText = encodeURIComponent(`Olá Rove+, quero falar com o bot de atendimento.\nCliente: ${clientMe.nome}`)
  const waRenewText = buildRenewWaText(clientMe)
  const firstName = clientMe.nome.split(/\s+/)[0]

  const tabItems: { id: ClientTab; label: string; Icon: typeof User; badge?: number }[] = [
    { id: 'inicio', label: 'Início', Icon: User },
    { id: 'servico', label: clientMe.servico === 'netflix' ? 'Netflix' : 'IPTV', Icon: clientMe.servico === 'netflix' ? Film : Tv },
    { id: 'renovar', label: 'Renovar', Icon: Calendar },
    { id: 'indicar', label: 'Indicar', Icon: Gift },
    { id: 'conta', label: 'Conta', Icon: Shield, badge: alertNotifCount > 0 ? alertNotifCount : undefined },
  ]

  function copyAllIptv() {
    const lines = [
      `Utilizador: ${clientMe.perfil || clientMe.iptvUser || '—'}`,
      clientMe.iptvPass ? `Senha: ${clientMe.iptvPass}` : null,
      clientMe.iptvMac ? `MAC: ${clientMe.iptvMac}` : null,
      clientMe.iptvM3u ? `M3U: ${clientMe.iptvM3u}` : null,
      clientMe.servidor ? `Servidor: ${clientMe.servidor.nome}` : null,
    ].filter(Boolean)
    copyText(lines.join('\n'), 'iptv-all')
  }

  return (
    <div className="min-h-screen bg-netflix-bg text-gray-200 relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(229,9,20,0.18),transparent_55%)]" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-netflix-bg/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <Link to="/cliente" className="flex items-center gap-2.5 min-w-0">
              <img src="/logo/logo-w.png" alt="Rove+" className="h-8 w-auto shrink-0" />
              <div className="hidden sm:block min-w-0">
                <span className="text-white font-semibold text-sm block truncate">Área cliente</span>
                <span className="text-[11px] text-gray-500">Olá, {firstName}</span>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]" aria-label="Navegação da área cliente">
            {tabItems.map(({ id, label, Icon, badge }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'border border-primary-500/70 bg-primary-600/25 text-white shadow-[0_0_12px_rgba(229,9,20,0.25)]'
                      : 'border border-white/[0.08] bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  {label}
                  {badge != null && badge > 0 && (
                    <span className="min-w-[1rem] h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-black leading-4">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-20 pt-6">
        <AnimatePresence mode="wait">
          {tab === 'inicio' && (
            <motion.div
              key="inicio"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              {needsUrgentRenewal && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-950/25 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-amber-100 text-sm">
                      {me.status === 'cancelado'
                        ? 'Conta cancelada'
                        : me.status === 'vencido'
                          ? 'Subscrição vencida'
                          : `Renovação em ${Math.max(0, daysLeft)} dia(s)`}
                    </p>
                    <p className="text-xs text-amber-200/80 mt-0.5">
                      Vencimento: {formatDate(me.dataFim)} · {Number(me.valor).toLocaleString('pt-BR')} kz/mês
                    </p>
                  </div>
                  <a
                    href={`https://wa.me/${WA_BUSINESS}?text=${waRenewText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Renovar agora
                  </a>
                </div>
              )}

              <section className="rounded-2xl border border-white/[0.08] bg-netflix-card/80 p-5 sm:p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white bg-gradient-to-br from-primary-600 to-primary-800">
                    {initials(me.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold text-white truncate">{me.nome}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${st.className}`}>
                        {st.text}
                      </span>
                      {me.roveId && (
                        <button
                          type="button"
                          onClick={() => copyText(me.roveId!, 'roveId')}
                          className="text-xs text-gray-500 hover:text-gray-300 font-mono"
                        >
                          {me.roveId} · {copiedField === 'roveId' ? 'copiado' : 'copiar ID'}
                        </button>
                      )}
                      {me.localizacao && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {me.localizacao}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-netflix-panel/60 border border-white/[0.06] p-3">
                    <Clock className="w-4 h-4 text-emerald-400 mb-1" />
                    <p className="text-[10px] uppercase text-gray-500 tracking-wide">Dias restantes</p>
                    <p className="text-xl font-bold text-white tabular-nums">{me.status === 'ativo' ? Math.max(0, daysLeft) : '—'}</p>
                  </div>
                  <div className="rounded-xl bg-netflix-panel/60 border border-white/[0.06] p-3">
                    <Calendar className="w-4 h-4 text-primary-400 mb-1" />
                    <p className="text-[10px] uppercase text-gray-500 tracking-wide">Vencimento</p>
                    <p className="text-sm font-semibold text-white">{formatDate(me.dataFim)}</p>
                  </div>
                  <div className="rounded-xl bg-netflix-panel/60 border border-white/[0.06] p-3">
                    <CreditCard className="w-4 h-4 text-amber-400 mb-1" />
                    <p className="text-[10px] uppercase text-gray-500 tracking-wide">Valor/mês</p>
                    <p className="text-sm font-semibold text-white">{Number(me.valor).toLocaleString('pt-BR')} kz</p>
                  </div>
                  <div className="rounded-xl bg-netflix-panel/60 border border-white/[0.06] p-3">
                    {me.servico === 'netflix' ? (
                      <Film className="w-4 h-4 text-red-400 mb-1" />
                    ) : (
                      <Tv className="w-4 h-4 text-violet-400 mb-1" />
                    )}
                    <p className="text-[10px] uppercase text-gray-500 tracking-wide">Plano</p>
                    <p className="text-sm font-semibold text-white truncate" title={me.plano}>
                      {me.plano}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Ações rápidas</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <a
                    href={`https://wa.me/${WA_BUSINESS}?text=${waRenewText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-green-500/30 bg-green-950/20 hover:bg-green-950/35 transition-colors text-left"
                  >
                    <MessageCircle className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-medium text-white">Pedir renovação</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setTab('servico')}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-violet-500/25 bg-violet-950/15 hover:bg-violet-950/30 transition-colors text-left"
                  >
                    {me.servico === 'netflix' ? (
                      <Film className="w-5 h-5 text-red-400" />
                    ) : (
                      <Tv className="w-5 h-5 text-violet-400" />
                    )}
                    <span className="text-sm font-medium text-white">Ver credenciais</span>
                  </button>
                  {me.servico === 'netflix' ? (
                    <a
                      href={NETFLIX_LOGIN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-start gap-2 p-4 rounded-xl border border-red-500/30 bg-red-950/20 hover:bg-red-950/35 transition-colors text-left"
                    >
                      <ExternalLink className="w-5 h-5 text-red-400" />
                      <span className="text-sm font-medium text-white">Abrir Netflix</span>
                    </a>
                  ) : (
                    <a
                      href={ROVE_PUBLIC_SITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-start gap-2 p-4 rounded-xl border border-primary-500/25 bg-primary-950/15 hover:bg-primary-950/30 transition-colors text-left"
                    >
                      <Globe className="w-5 h-5 text-primary-400" />
                      <span className="text-sm font-medium text-white">Site Rove+</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setTab('indicar')}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-amber-500/25 bg-amber-950/15 hover:bg-amber-950/30 transition-colors text-left"
                  >
                    <Gift className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-medium text-white">Indicar amigo</span>
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-sky-500/20 bg-sky-950/10 p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-sky-400" />
                    <h2 className="font-semibold text-white">Avisos recentes</h2>
                  </div>
                  {portalNotifs.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setTab('conta')}
                      className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-0.5"
                    >
                      Ver todos
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <NotificacoesList items={portalNotifs} loading={notifsLoading} compact />
              </section>
            </motion.div>
          )}

          {tab === 'servico' && (
            <motion.div
              key="servico"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {me.servico === 'netflix' ? (
                <section className="rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-950/20 to-netflix-card/60 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <Film className="w-6 h-6 text-red-400" />
                      <div>
                        <h2 className="text-lg font-semibold text-white">Netflix</h2>
                        <p className="text-xs text-gray-500">Credenciais do seu perfil</p>
                      </div>
                    </div>
                    <a
                      href={NETFLIX_LOGIN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold shadow-lg shadow-red-950/40 border border-red-500/30 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir Netflix
                    </a>
                  </div>
                  <InfoRow label="Perfil">{me.perfil || '—'}</InfoRow>
                  {me.pin && (
                    <CopyField
                      label="PIN do perfil"
                      value={me.pin}
                      fieldId="netflix-pin"
                      copiedField={copiedField}
                      onCopy={copyText}
                    />
                  )}
                  {me.sala && <InfoRow label="Sala / conta">{me.sala.nome}</InfoRow>}
                  {me.inscricaoPaga != null && (
                    <InfoRow label="Inscrição paga">{me.inscricaoPaga ? 'Sim' : 'Pendente'}</InfoRow>
                  )}
                  {me.pin && (
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          [`Perfil: ${me.perfil || '—'}`, `PIN: ${me.pin}`, me.sala ? `Sala: ${me.sala.nome}` : null]
                            .filter(Boolean)
                            .join('\n'),
                          'netflix-all'
                        )
                      }
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-600/15 text-red-200 text-sm hover:bg-red-600/25"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedField === 'netflix-all' ? 'Copiado!' : 'Copiar tudo'}
                    </button>
                  )}
                </section>
              ) : (
                <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/25 to-netflix-card/60 p-6">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                      <Tv className="w-6 h-6 text-violet-400" />
                      <div>
                        <h2 className="text-lg font-semibold text-white">IPTV</h2>
                        <p className="text-xs text-gray-500">Linha, servidor e lista M3U</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={copyAllIptv}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-500/30 bg-violet-600/15 text-violet-200 text-xs hover:bg-violet-600/25"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedField === 'iptv-all' ? 'Copiado!' : 'Copiar tudo'}
                    </button>
                  </div>
                  {(me.perfil || me.iptvUser) && (
                    <CopyField
                      label="Utilizador / linha"
                      value={me.perfil || me.iptvUser || ''}
                      fieldId="iptv-user"
                      copiedField={copiedField}
                      onCopy={copyText}
                    />
                  )}
                  {me.iptvPass && (
                    <CopyField
                      label="Palavra-passe"
                      value={me.iptvPass}
                      fieldId="iptv-pass"
                      copiedField={copiedField}
                      onCopy={copyText}
                    />
                  )}
                  {!me.iptvPass && me.iptvPassSet && (
                    <InfoRow label="Palavra-passe">Definida — contacte a Rove+ se precisar</InfoRow>
                  )}
                  {me.iptvMac && (
                    <CopyField
                      label="MAC"
                      value={me.iptvMac}
                      fieldId="iptv-mac"
                      copiedField={copiedField}
                      onCopy={copyText}
                    />
                  )}
                  {me.iptvM3u && (
                    <CopyField
                      label="Lista M3U"
                      value={me.iptvM3u}
                      fieldId="iptv-m3u"
                      copiedField={copiedField}
                      onCopy={copyText}
                    />
                  )}
                  {me.servidor && (
                    <InfoRow label="Servidor">
                      <span className="inline-flex items-center gap-2">
                        <Server className="w-4 h-4 text-gray-500" />
                        {me.servidor.nome}
                        <span className="text-xs text-gray-500">({me.servidor.status})</span>
                      </span>
                    </InfoRow>
                  )}
                  {me.revendedor && <InfoRow label="Revendedor">{me.revendedor.nome}</InfoRow>}
                </section>
              )}
            </motion.div>
          )}

          {tab === 'renovar' && (
            <motion.div
              key="renovar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <section className="rounded-2xl border border-primary-500/25 bg-netflix-card/80 p-6 text-center">
                {me.status === 'ativo' ? (
                  <>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Dias até renovação</p>
                    <p
                      className={`text-5xl font-bold tabular-nums mb-4 ${daysLeft <= 7 ? 'text-amber-300' : daysLeft <= 30 ? 'text-amber-200' : 'text-emerald-300'}`}
                    >
                      {Math.max(0, daysLeft)}
                    </p>
                    <div className="max-w-xs mx-auto mb-4">
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${daysLeft <= 7 ? 'bg-amber-500' : daysLeft <= 30 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                          style={{ width: `${renewalProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Referência visual (30 dias)</p>
                    </div>
                  </>
                ) : (
                  <div className="py-4">
                    <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                    <p className="text-lg font-semibold text-white">
                      {me.status === 'vencido' ? 'Subscrição vencida' : 'Conta inactiva'}
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-400">
                  Próxima data: <span className="text-white font-medium">{formatDate(me.dataFim)}</span>
                </p>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-netflix-card/70 p-6">
                <h2 className="font-semibold text-white mb-4">Detalhes do plano</h2>
                <InfoRow label="Plano">{me.plano}</InfoRow>
                <InfoRow label="Serviço">{me.servico === 'netflix' ? 'Netflix' : 'IPTV'}</InfoRow>
                <InfoRow label="Valor mensal">{Number(me.valor).toLocaleString('pt-BR')} kz</InfoRow>
                <InfoRow label="Início">{formatDate(me.dataInicio)}</InfoRow>
                <InfoRow label="Indicações">{me.indicacoes ?? 0}</InfoRow>
              </section>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={`https://wa.me/${WA_BUSINESS}?text=${waRenewText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-b from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold shadow-lg"
                >
                  <MessageCircle className="w-5 h-5" />
                  Pedir renovação no WhatsApp
                </a>
                <a
                  href={ROVE_PUBLIC_SITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-primary-500/40 bg-primary-500/10 text-primary-200 hover:bg-primary-500/20 font-semibold"
                >
                  <Globe className="w-5 h-5" />
                  Ver planos
                </a>
              </div>
            </motion.div>
          )}

          {tab === 'indicar' && (
            <motion.div
              key="indicar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <section className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Gift className="w-6 h-6 text-amber-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Indique amigos</h2>
                    <p className="text-xs text-gray-500">A equipa valida cada indicação antes de contactar</p>
                  </div>
                </div>
                <form onSubmit={handleSubmitIndicacao} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="ind-nome" className="block text-xs font-medium text-gray-500 uppercase mb-1.5">
                        Nome completo
                      </label>
                      <div className="relative">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/60" />
                        <input
                          id="ind-nome"
                          type="text"
                          value={indForm.nome}
                          onChange={(e) => setIndForm((f) => ({ ...f, nome: e.target.value }))}
                          className="w-full pl-10 pr-3 py-2.5 bg-netflix-panel/80 border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/30 outline-none"
                          placeholder="Nome do indicado"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="ind-wa" className="block text-xs font-medium text-gray-500 uppercase mb-1.5">
                        WhatsApp
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/60" />
                        <input
                          id="ind-wa"
                          type="text"
                          inputMode="tel"
                          value={indForm.whatsapp}
                          onChange={(e) => setIndForm((f) => ({ ...f, whatsapp: e.target.value }))}
                          className="w-full pl-10 pr-3 py-2.5 bg-netflix-panel/80 border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500/30 outline-none"
                          placeholder="+244 9XX XXX XXX"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={indSubmitting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    <Gift className="w-4 h-4" />
                    {indSubmitting ? 'A registar…' : 'Registar indicação'}
                  </button>
                </form>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-netflix-card/70 p-6">
                <h3 className="text-sm font-semibold text-white mb-3">
                  As suas indicações ({indicacoesLoading ? '…' : minhasIndicacoes.length})
                </h3>
                {indicacoesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
                  </div>
                ) : minhasIndicacoes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">Ainda não tem indicações registadas.</p>
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
                          <span className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </motion.div>
          )}

          {tab === 'conta' && (
            <motion.div
              key="conta"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <section className="rounded-2xl border border-white/[0.08] bg-netflix-card/70 p-6">
                <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-gray-400" />
                  Segurança
                </h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-white">PIN da área cliente</p>
                    <p className="text-xs text-gray-500 mt-0.5">Use um PIN com pelo menos 6 caracteres</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChangePinModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white"
                  >
                    <KeyRound className="w-4 h-4" />
                    Alterar PIN
                  </button>
                </div>
                {me.roveId && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06]">
                    <CopyField
                      label="ID ROVE (referência de suporte)"
                      value={me.roveId}
                      fieldId="roveId-conta"
                      copiedField={copiedField}
                      onCopy={copyText}
                    />
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-sky-500/20 bg-sky-950/10 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-5 h-5 text-sky-400" />
                  <h2 className="font-semibold text-white">Todos os avisos</h2>
                </div>
                <NotificacoesList items={portalNotifs} loading={notifsLoading} />
              </section>

              <section className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-semibold text-white">Contacto e suporte</h2>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Use o botão <strong className="text-gray-300">Assistente</strong> (canto inferior direito) ou fale connosco no WhatsApp.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <a
                    href={`https://wa.me/${WA_BUSINESS}?text=${waRenewText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp Rove+
                  </a>
                  <a
                    href={`https://wa.me/${WA_BUSINESS}?text=${waBotText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold"
                  >
                    <Bot className="w-4 h-4" />
                    Bot de atendimento
                  </a>
                  <a
                    href={ROVE_PUBLIC_SITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-500/40 bg-primary-500/10 text-primary-200 text-sm font-semibold"
                  >
                    <Globe className="w-4 h-4" />
                    Site da Rove+
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-gray-600 mt-8 leading-relaxed">
          Os dados refletem o registo na Rove+. Em caso de divergência, contacte o suporte.
        </p>
      </main>

      <ClientAssistantBot
        onOpenTab={setTab}
        onOpenPinModal={() => setShowChangePinModal(true)}
        onCopy={async (text) => {
          await copyText(text, 'assistant')
          showInfo('Copiado para a área de transferência.')
        }}
      />

      {(showChangePinModal || mustChangePinNow) && (
        <RoveModalOverlay>
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-amber-500/40 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Alterar PIN da área cliente</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {mustChangePinNow ? 'Primeiro acesso: altere o PIN agora' : 'Escolha um PIN seguro (mín. 6 caracteres)'}
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleChangePortalPin}>
              <div className="p-6 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">PIN atual</label>
                  <input
                    type="password"
                    value={changePinForm.currentPin}
                    onChange={(e) => setChangePinForm((f) => ({ ...f, currentPin: e.target.value }))}
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/50"
                    placeholder="PIN usado no login"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Novo PIN</label>
                  <input
                    type="password"
                    value={changePinForm.newPin}
                    onChange={(e) => setChangePinForm((f) => ({ ...f, newPin: e.target.value }))}
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/50"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Confirmar novo PIN</label>
                  <input
                    type="password"
                    value={changePinForm.confirmPin}
                    onChange={(e) => setChangePinForm((f) => ({ ...f, confirmPin: e.target.value }))}
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-primary-500/50"
                    placeholder="Repita o novo PIN"
                    minLength={6}
                  />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
                {!mustChangePinNow && (
                  <button
                    type="button"
                    onClick={() => setShowChangePinModal(false)}
                    className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm text-gray-300 hover:bg-netflix-hover"
                  >
                    Fechar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={changingPin}
                  className={`${mustChangePinNow ? 'w-full' : 'flex-1'} py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50`}
                >
                  {changingPin ? 'A guardar…' : 'Alterar PIN'}
                </button>
              </div>
            </form>
          </div>
        </RoveModalOverlay>
      )}
    </div>
  )
}
