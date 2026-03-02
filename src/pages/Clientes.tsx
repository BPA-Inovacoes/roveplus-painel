import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Phone,
  AlertTriangle,
  LayoutGrid,
  Tv,
  Film,
  CheckCircle,
  Users,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useAlert } from '../contexts/AlertContext'

interface Client {
  id: number
  nome: string
  whatsapp: string
  localizacao: string | null
  servico: string
  plano: string
  servidorId: number | null
  revendedorId: number | null
  perfil: string | null
  dataInicio: string
  dataFim: string
  valor: number
  inscricaoPaga?: boolean | null
  salaId?: number | null
  sala?: { id: number; nome: string } | null
  status: string
  indicacoes: number
  servidor?: { id: number; nome: string } | null
  revendedor?: { id: number; nome: string } | null
}

interface Servidor {
  id: number
  nome: string
  tipo?: string
  totalClientes: number
  servidor?: { id: number; nome: string } | null
}

interface Revendedor {
  id: number
  nome: string
}

interface Sala {
  id: number
  nome: string
  dataFim?: string | null
  totalClientes?: number
}

const statusColors: Record<string, string> = {
  ativo: 'bg-green-900/50 text-green-300',
  vencido: 'bg-red-900/50 text-red-300',
  cancelado: 'bg-gray-700 text-gray-300',
}

/** Planos IPTV (só o nome no select; valor = mensalidade) */
const PLANOS_IPTV = [
  { id: 'Pacote Premium', label: 'Pacote Premium', valor: 9500 },
  { id: 'Pacote Ultimate', label: 'Pacote Ultimate', valor: 12500 },
] as const

/** Planos Netflix (só o nome no select; valor = mensalidade; inscricao = valor da inscrição) */
const PLANOS_NETFLIX = [
  { id: 'Plano Room', label: 'Plano Room', valor: 4500, inscricao: 2000 },
  { id: 'Plano Solo', label: 'Plano Solo', valor: 18500, inscricao: 4000 },
] as const

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('pt-BR')
}

function daysUntil(date: string) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export default function Clientes() {
  const { user } = useAuth()
  const { showError, showWarning } = useAlert()
  const role = user?.role
  const operadorNetflix = role === 'netflix'
  const operadorIptv = role === 'iptv'
  const servicoFixo = operadorNetflix ? 'netflix' : operadorIptv ? 'iptv' : null

  const [clients, setClients] = useState<Client[]>([])
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [revendedores, setRevendedores] = useState<Revendedor[]>([])
  const [salas, setSalas] = useState<Sala[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'iptv' | 'netflix'>(servicoFixo ?? 'iptv')
  const [filter, setFilter] = useState({
    servico: servicoFixo ?? 'iptv',
    servidorId: '',
    revendedorId: '',
    salaId: '' as string,
    status: '',
    vencendo: '',
  })
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'new' | 'edit' | 'sala' | null>(null)
  const [clientSala, setClientSala] = useState<Client | null>(null)
  const [salaIdSelect, setSalaIdSelect] = useState<number | ''>('')
  const [clientSuspender, setClientSuspender] = useState<Client | null>(null)
  const [clientAtivar, setClientAtivar] = useState<Client | null>(null)
  const [editStep, setEditStep] = useState(1)
  const [form, setForm] = useState<Partial<Client>>({
    nome: '',
    whatsapp: '',
    localizacao: '',
    servico: servicoFixo ?? 'iptv',
    plano: 'mensal',
    valor: 0,
    dataFim: '',
  })

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter.servico) params.set('servico', filter.servico)
    if (filter.servidorId) params.set('servidorId', filter.servidorId)
    if (filter.revendedorId) params.set('revendedorId', filter.revendedorId)
    if (filter.status) params.set('status', filter.status)
    if (filter.vencendo) params.set('vencendo', filter.vencendo)
    api
      .get<Client[]>(`/api/clients?${params}`)
      .then(setClients)
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [filter.servico, filter.servidorId, filter.revendedorId, filter.status, filter.vencendo])

  useEffect(() => {
    if (operadorNetflix) return
    api.get<Servidor[]>('/api/servidores').then(setServidores).catch(() => setServidores([]))
    api.get<Revendedor[]>('/api/revendedores').then(setRevendedores).catch(() => setRevendedores([]))
  }, [operadorNetflix])

  useEffect(() => {
    if (operadorIptv) return
    api.get<Sala[]>('/api/salas').then(setSalas).catch(() => setSalas([]))
  }, [operadorIptv])

  const filtered = clients.filter((c) => {
    if (search && !c.nome.toLowerCase().includes(search.toLowerCase()) && !c.whatsapp.includes(search)) return false
    if (tab === 'netflix' && filter.salaId && c.salaId !== Number(filter.salaId)) return false
    return true
  })

  const showIptvTab = !operadorNetflix
  const showNetflixTab = !operadorIptv

  function switchTab(newTab: 'iptv' | 'netflix') {
    setTab(newTab)
    setFilter((f) => ({ ...f, servico: newTab }))
  }

  const stats = {
    total: filtered.length,
    ativos: filtered.filter((c) => c.status === 'ativo').length,
    vencidos: filtered.filter((c) => c.status === 'vencido').length,
    vencendo: filtered.filter((c) => {
      const d = daysUntil(c.dataFim)
      return c.status === 'ativo' && d >= 0 && d <= 3
    }).length,
  }

  function validateNewClientStep(step: number): string | null {
    if (step === 1) {
      if (!(form.nome ?? '').trim()) return 'Nome é obrigatório.'
      if (!(form.whatsapp ?? '').trim()) return 'WhatsApp é obrigatório.'
    }
    if (step === 2) {
      if (!form.plano || !String(form.plano).trim()) return form.servico === 'iptv' ? 'Selecione o plano IPTV.' : 'Selecione o plano Netflix.'
    }
    return null
  }

  function validateNewClient(): string | null {
    const err1 = validateNewClientStep(1)
    if (err1) return err1
    const err2 = validateNewClientStep(2)
    if (err2) return err2
    if (form.servico === 'iptv') {
      if (!(form.perfil ?? '').trim()) return 'Nome de utilizador é obrigatório.'
      if (!form.dataFim || !String(form.dataFim).trim()) return 'Data fim é obrigatória.'
    }
    if (form.servico === 'netflix') {
      if (!(form.perfil ?? '').trim()) return 'Perfil é obrigatório.'
    }
    return null
  }

  async function saveClient() {
    if (modal === 'new') {
      const err = validateNewClient()
      if (err) {
        showWarning(err)
        return
      }
    } else {
      if (!form.nome?.trim() || !form.whatsapp?.trim()) {
        showWarning('Nome e WhatsApp são obrigatórios.')
        return
      }
    }
    try {
      if (modal === 'new') {
        await api.post<Client>('/api/clients', {
          ...form,
          dataFim: form.dataFim || undefined,
          servidorId: form.servidorId || null,
          revendedorId: form.revendedorId || null,
          localizacao: form.localizacao || null,
          salaId: form.salaId ?? null,
        })
      } else if (form.id) {
        await api.patch(`/api/clients/${form.id}`, { ...form, salaId: form.salaId ?? null })
      }
      setModal(null)
      setForm({ nome: '', whatsapp: '', localizacao: '', servico: servicoFixo ?? 'iptv', plano: 'mensal', valor: 0, dataFim: '', revendedorId: null })
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao guardar')
    }
  }

  async function renovar(id: number) {
    try {
      await api.post(`/api/clients/${id}/renovar`, { dias: 30 })
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function confirmarSuspender() {
    if (!clientSuspender) return
    try {
      await api.post(`/api/clients/${clientSuspender.id}/suspender`)
      setClientSuspender(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function confirmarAtivar() {
    if (!clientAtivar) return
    try {
      await api.post(`/api/clients/${clientAtivar.id}/ativar`)
      setClientAtivar(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function atribuirSala() {
    if (!clientSala) return
    try {
      await api.patch(`/api/clients/${clientSala.id}`, { salaId: salaIdSelect === '' ? null : salaIdSelect })
      setModal(null)
      setClientSala(null)
      setSalaIdSelect('')
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao guardar sala')
    }
  }

  async function remove(id: number) {
    if (!confirm('Excluir cliente? Esta ação não pode ser desfeita.')) return
    try {
      await api.delete(`/api/clients/${id}`)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Header: título, descrição, chips e botão */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6" />
              Clientes
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Alterna entre IPTV e Netflix. Filtre por servidor ou revendedor (IPTV), sala (Netflix) e estado.
            </p>
          </div>
        </div>
      </div>

      {/* Abas IPTV | NETFLIX + stats + Novo cliente */}
      <div className="flex flex-wrap items-center gap-3">
        {(showIptvTab || showNetflixTab) && (
          <div className="flex gap-1 p-1 rounded-xl bg-netflix-panel/60 border border-netflix-border/80">
            {showIptvTab && (
              <button
                type="button"
                onClick={() => switchTab('iptv')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'iptv'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/30'
                    : 'text-gray-400 hover:text-white hover:bg-netflix-hover/80'
                }`}
              >
                <Tv className="w-4 h-4" />
                IPTV
              </button>
            )}
            {showNetflixTab && (
              <button
                type="button"
                onClick={() => switchTab('netflix')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'netflix'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/30'
                    : 'text-gray-400 hover:text-white hover:bg-netflix-hover/80'
                }`}
              >
                <Film className="w-4 h-4" />
                NETFLIX
              </button>
            )}
          </div>
        )}
        <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-netflix-panel/80 border border-netflix-border/60 text-gray-300 text-sm">
            <span className="font-semibold text-white">{stats.total}</span> total
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300 text-sm">
            <span className="font-semibold">{stats.ativos}</span> ativos
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-300 text-sm">
            <span className="font-semibold">{stats.vencendo}</span> a vencer (3 dias)
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
            <span className="font-semibold">{stats.vencidos}</span> vencidos
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({
              nome: '',
              whatsapp: '',
              localizacao: '',
              servico: tab,
              plano: tab === 'iptv' ? 'mensal' : 'Plano Room',
              valor: 0,
              dataFim: '',
              revendedorId: null,
            })
            setEditStep(1)
            setModal('new')
          }}
          className="flex items-center gap-2 py-2.5 px-5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-medium shadow-lg shadow-primary-900/30 transition-colors shrink-0 ml-auto"
        >
          <Plus className="w-4 h-4" />
          Novo cliente
        </button>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl bg-netflix-card/60 border border-netflix-border/80">
        {tab === 'iptv' && (
          <>
            <select
              value={filter.servidorId}
              onChange={(e) => setFilter((f) => ({ ...f, servidorId: e.target.value }))}
              className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
            >
              <option value="">Todos os servidores</option>
              {servidores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tipo === 'secundario' && s.servidor
                    ? `${s.nome} (Secundário → ${s.servidor.nome})`
                    : s.nome}
                </option>
              ))}
            </select>
            <select
              value={filter.revendedorId}
              onChange={(e) => setFilter((f) => ({ ...f, revendedorId: e.target.value }))}
              className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
            >
              <option value="">Todos os revendedores</option>
              {revendedores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </>
        )}
        {tab === 'netflix' && (
          <select
            value={filter.salaId ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, salaId: e.target.value === '' ? '' : e.target.value }))}
            className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
          >
            <option value="">Todas as salas</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        )}
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
        >
          <option value="">Todos os estados</option>
          <option value="ativo">Ativo</option>
          <option value="vencido">Vencido</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select
          value={filter.vencendo}
          onChange={(e) => setFilter((f) => ({ ...f, vencendo: e.target.value }))}
          className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
        >
          <option value="">Qualquer vencimento</option>
          <option value="hoje">Vence hoje</option>
          <option value="3dias">Vence em 3 dias</option>
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Nome ou WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-netflix-border bg-netflix-panel text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="p-2.5 rounded-lg border border-netflix-border bg-netflix-panel hover:bg-netflix-hover text-gray-300 hover:text-white transition-colors"
          title="Atualizar lista"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 shadow-lg shadow-black/40 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
            <span className="text-sm">A carregar clientes...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-netflix-panel/80 text-gray-300 text-sm">
                <tr>
                  <th className="px-4 py-3.5 font-medium w-12 text-center">Nº</th>
                  <th className="px-4 py-3.5 font-medium">Cliente</th>
                  <th className="px-4 py-3.5 font-medium">Contacto</th>
                  <th className="px-4 py-3.5 font-medium">Localização</th>
                  {tab === 'iptv' && (
                    <>
                      <th className="px-4 py-3.5 font-medium">Servidor</th>
                      <th className="px-4 py-3.5 font-medium">Revendedor</th>
                    </>
                  )}
                  {tab === 'netflix' && <th className="px-4 py-3.5 font-medium">Sala</th>}
                  <th className="px-4 py-3.5 font-medium">Plano</th>
                  <th className="px-4 py-3.5 font-medium">Vencimento</th>
                  <th className="px-4 py-3.5 font-medium">Valor</th>
                  <th className="px-4 py-3.5 font-medium">Estado</th>
                  <th className="px-4 py-3.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-netflix-border/80 text-gray-200">
                {filtered.map((c, idx) => {
                  const days = daysUntil(c.dataFim)
                  const alert = c.status === 'ativo' && days <= 3 && days >= 0
                  const expired = c.status === 'ativo' && days < 0
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-netflix-hover/80 transition-colors ${
                        alert ? 'bg-amber-900/15' : expired ? 'bg-red-900/15' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-gray-400 text-sm">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{c.nome}</div>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-primary-400 hover:text-primary-300 hover:underline text-sm"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          {c.whatsapp}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{c.localizacao || '—'}</td>
                      {tab === 'iptv' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-400">{c.servidor?.nome ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">{c.revendedor?.nome ?? '—'}</td>
                        </>
                      )}
                      {tab === 'netflix' && (
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {c.plano === 'Plano Room' ? (c.sala?.nome ?? '—') : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm">{c.plano}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${alert ? 'text-amber-400 font-medium' : expired ? 'text-red-400 font-medium' : 'text-gray-300'}`}>
                          {formatDate(c.dataFim)}
                          {c.status === 'ativo' && (
                            <span className="text-gray-500 text-xs ml-1">
                              ({days > 0 ? `${days}d` : days === 0 ? 'hoje' : 'vencido'})
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white">{Number(c.valor).toFixed(2)} kz</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[c.status] || 'bg-gray-700 text-gray-300'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 relative">
                        <div className="flex justify-end gap-1">
                          {c.status === 'ativo' && c.servico === 'netflix' && c.plano === 'Plano Room' && (
                            <button
                              type="button"
                              onClick={() => {
                                setClientSala(c)
                                setSalaIdSelect(c.salaId ?? '')
                                setModal('sala')
                              }}
                              title="Atribuir sala"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-sky-500/50 bg-sky-500/10 text-sky-300 hover:bg-sky-500/30 hover:text-white transition-colors"
                            >
                              <LayoutGrid className="w-4 h-4" />
                            </button>
                          )}
                          {c.status === 'ativo' && (
                            <button
                              type="button"
                              onClick={() => {
                                setForm({ ...c })
                                setEditStep(1)
                                setModal('edit')
                              }}
                              title="Editar"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-primary-500/50 bg-primary-500/10 text-primary-300 hover:bg-primary-500/30 hover:text-white hover:border-primary-400 shadow-sm shadow-primary-900/40 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {c.status === 'ativo' && (
                            <button
                              type="button"
                              onClick={() => renovar(c.id)}
                              title="Renovar 30 dias"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-green-500/50 bg-green-500/10 text-green-300 hover:bg-green-500/30 hover:text-white transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {c.status === 'ativo' && (
                            <button
                              type="button"
                              onClick={() => setClientSuspender(c)}
                              title="Suspender"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/30 hover:text-white transition-colors"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          )}
                          {c.status === 'vencido' && (
                            <button
                              type="button"
                              onClick={() => setClientAtivar(c)}
                              title="Ativar"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-green-500/50 bg-green-500/10 text-green-300 hover:bg-green-500/30 hover:text-white transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => remove(c.id)}
                            title="Excluir"
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-red-500/60 bg-red-500/15 text-red-300 hover:bg-red-500/30 hover:text-white shadow-sm shadow-red-900/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            {tab === 'iptv' ? 'Nenhum cliente IPTV encontrado.' : 'Nenhum cliente Netflix encontrado.'} Ajuste os filtros ou adicione um novo cliente.
          </div>
        )}
      </div>

      {/* Modal confirmar suspender */}
      {clientSuspender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-amber-500/30 max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Suspender cliente</h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    O cliente <span className="text-white font-medium">{clientSuspender.nome}</span> passará a estado <span className="text-amber-400 font-medium">vencido</span>.
                  </p>
                </div>
              </div>
              <div className="h-1 w-12 bg-amber-500 rounded-full mt-4" />
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-300">Tem a certeza que deseja suspender este cliente?</p>
            </div>
            <div className="flex gap-3 p-6 pt-0 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setClientSuspender(null)}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarSuspender}
                className="flex-1 py-2.5 px-4 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors shadow-lg shadow-amber-900/30"
              >
                Suspender
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar ativar cliente */}
      {clientAtivar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-green-500/30 max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-500/20 text-green-400">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Ativar cliente</h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    O cliente <span className="text-white font-medium">{clientAtivar.nome}</span> passará a estado <span className="text-green-400 font-medium">ativo</span>.
                  </p>
                </div>
              </div>
              <div className="h-1 w-12 bg-green-500 rounded-full mt-4" />
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-300">Tem a certeza que deseja ativar este cliente?</p>
            </div>
            <div className="flex gap-3 p-6 pt-0 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setClientAtivar(null)}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarAtivar}
                className="flex-1 py-2.5 px-4 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors shadow-lg shadow-green-900/30"
              >
                Ativar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Atribuir sala (Netflix Plano Room) */}
      {modal === 'sala' && clientSala && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-netflix-card rounded-2xl shadow-2xl shadow-black/50 border border-primary-500/40 max-w-md w-full overflow-hidden ring-1 ring-white/5">
            <div className="p-6 pb-5 border-b border-netflix-border/80 bg-gradient-to-b from-primary-950/20 to-transparent">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary-500/25 text-primary-400 shadow-lg shadow-primary-900/20">
                  <LayoutGrid className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white tracking-tight">Atribuir sala</h3>
                  <p className="text-sm text-gray-400 mt-1.5">
                    Cliente: <span className="text-white font-semibold">{clientSala.nome}</span>
                  </p>
                  <div className="h-1 w-14 bg-primary-500 rounded-full mt-4 opacity-90" />
                </div>
              </div>
            </div>
            <div className="p-6 bg-netflix-panel/30">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Sala (conta)</label>
              <p className="text-xs text-gray-500 mb-3">Selecione a conta em que este cliente está no Plano Room.</p>
              <select
                value={salaIdSelect === '' ? '' : salaIdSelect}
                onChange={(e) => setSalaIdSelect(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-3 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all hover:border-primary-500/50"
              >
                <option value="">— Nenhuma —</option>
                {salas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 p-6 border-t border-netflix-border/80 bg-netflix-card">
              <button
                type="button"
                onClick={() => { setModal(null); setClientSala(null); setSalaIdSelect('') }}
                className="flex-1 py-3 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover hover:text-white hover:border-gray-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={atribuirSala}
                className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-500 active:bg-primary-700 transition-colors shadow-lg shadow-primary-900/40 hover:shadow-primary-800/50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo/editar */}
      {modal && modal !== 'sala' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`bg-netflix-card rounded-2xl shadow-2xl border border-netflix-border max-w-md w-full flex flex-col ${
              (modal === 'edit' && form.servico === 'netflix') || modal === 'new' ? 'max-h-[90vh]' : 'max-h-[90vh] overflow-y-auto'
            }`}
          >
            <div className="p-6 border-b border-netflix-border/80 shrink-0">
              <h3 className="text-xl font-semibold text-white">
                {modal === 'new' ? 'Novo cliente' : 'Editar cliente'}
              </h3>
              <div className="h-1 w-12 bg-primary-500 rounded-full mt-2" />
              {((modal === 'edit' && form.servico === 'netflix') || modal === 'new') && (
                <div className="flex items-center mt-4">
                  {(modal === 'new'
                    ? [
                        { step: 1, label: 'Dados' },
                        { step: 2, label: form.servico === 'iptv' ? 'Plano & Servidor' : 'Plano & Sala' },
                        { step: 3, label: form.servico === 'iptv' ? 'Acesso' : 'Perfil & Pagamento' },
                      ]
                    : [
                        { step: 1, label: 'Dados' },
                        { step: 2, label: 'Plano' },
                        { step: 3, label: 'Perfil' },
                        { step: 4, label: 'Conclusão' },
                      ]
                  ).map(({ step, label }, i) => (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <button
                        type="button"
                        onClick={() => setEditStep(step)}
                        className={`flex flex-col items-center gap-1 group ${
                          i < (modal === 'new' ? 2 : 3) ? 'flex-1' : ''
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                            editStep === step
                              ? 'bg-primary-500 text-white ring-2 ring-primary-400/50'
                              : editStep > step
                                ? 'bg-primary-500/30 text-primary-300'
                                : 'bg-netflix-panel text-gray-500 group-hover:bg-netflix-hover group-hover:text-gray-400'
                          }`}
                        >
                          {step}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            editStep === step ? 'text-primary-400' : 'text-gray-500'
                          }`}
                        >
                          {label}
                        </span>
                      </button>
                      {i < (modal === 'new' ? 2 : 3) && (
                        <div
                          className={`flex-1 h-0.5 mx-1 rounded ${
                            editStep > step ? 'bg-primary-500/50' : 'bg-netflix-border'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {modal === 'edit' && form.servico === 'netflix' ? (
              <div className="p-6 space-y-4 overflow-hidden flex-1 min-h-0">
                {editStep === 1 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Nome</label>
                      <input
                        type="text"
                        value={form.nome || ''}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">WhatsApp</label>
                      <input
                        type="text"
                        value={form.whatsapp || ''}
                        onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                        placeholder="244 9XX XXX XXX"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Localização</label>
                      <input
                        type="text"
                        value={form.localizacao ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, localizacao: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                        placeholder="Ex: Luanda, Benguela..."
                      />
                    </div>
                  </>
                )}
                {editStep === 2 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Plano</label>
                      <select
                        value={
                          PLANOS_NETFLIX.some((p) => p.id === form.plano)
                            ? form.plano
                            : form.plano
                              ? 'outro'
                              : ''
                        }
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'outro') {
                            setForm((f) => ({ ...f, plano: 'Outro', valor: f.valor || 0 }))
                          } else {
                            const p = PLANOS_NETFLIX.find((x) => x.id === v)
                            if (p) setForm((f) => ({ ...f, plano: p.id, valor: p.valor }))
                          }
                        }}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      >
                        <option value="">— Selecione o plano —</option>
                        {PLANOS_NETFLIX.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                        <option value="outro">Outro (a especificar)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Sala (conta)</label>
                      {form.plano === 'Plano Room' ? (
                        <select
                          value={form.salaId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value
                            const id = v === '' ? null : Number(v)
                            const sala = id ? salas.find((s) => s.id === id) : null
                            setForm((f) => ({
                              ...f,
                              salaId: id,
                              dataFim: sala?.dataFim ? String(sala.dataFim).slice(0, 10) : f.dataFim,
                            }))
                          }}
                          className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                        >
                          <option value="">— Nenhuma —</option>
                          {salas.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-3 py-2 border border-netflix-border rounded-lg text-sm bg-netflix-panel/50 text-gray-500">—</div>
                      )}
                    </div>
                  </>
                )}
                {editStep === 3 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Perfil</label>
                      <input
                        type="text"
                        value={form.perfil || ''}
                        onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                        placeholder="Ex: nome do perfil Netflix"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Valor mensal (kz)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.valor ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) || 0 }))}
                        readOnly={PLANOS_NETFLIX.some((p) => p.id === form.plano)}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none min-h-[42px] [&:read-only]:cursor-default [&:read-only]:opacity-90"
                      />
                    </div>
                    {(() => {
                      const planoNetflix = PLANOS_NETFLIX.find((p) => p.id === form.plano)
                      const valorInscricao = planoNetflix?.inscricao
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-0.5">Inscrição</label>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-netflix-panel/60 border border-netflix-border/60 min-h-[42px]">
                            <input
                              type="checkbox"
                              id="inscricao-paga-step"
                              checked={form.inscricaoPaga === true}
                              onChange={(e) => setForm((f) => ({ ...f, inscricaoPaga: e.target.checked }))}
                              className="w-4 h-4 rounded border-netflix-border bg-netflix-panel text-primary-600 focus:ring-primary-500/50"
                            />
                            <label htmlFor="inscricao-paga-step" className="text-sm text-gray-300 cursor-pointer">
                              Inscrição já paga?{valorInscricao != null ? ` (${valorInscricao.toLocaleString('pt-PT')} Kz)` : ''}
                            </label>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
                {editStep === 4 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">
                        {form.salaId ? 'Data fim (da sala)' : 'Data fim'}
                      </label>
                      <input
                        type="date"
                        value={form.dataFim ? String(form.dataFim).slice(0, 10) : ''}
                        onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Estado</label>
                      <select
                        value={form.status || 'ativo'}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      >
                        <option value="ativo">Ativo</option>
                        <option value="vencido">Vencido</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            ) : modal === 'new' ? (
              <div className="p-6 space-y-4 overflow-hidden flex-1 min-h-0">
                {editStep === 1 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Nome</label>
                      <input
                        type="text"
                        value={form.nome || ''}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">WhatsApp</label>
                      <input
                        type="text"
                        value={form.whatsapp || ''}
                        onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                        placeholder="244 9XX XXX XXX"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Localização</label>
                      <input
                        type="text"
                        value={form.localizacao ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, localizacao: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                        placeholder="Ex: Luanda, Benguela..."
                      />
                    </div>
                  </>
                )}
                {editStep === 2 && form.servico === 'iptv' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Plano</label>
                      <select
                        value={
                          PLANOS_IPTV.some((p) => p.id === form.plano)
                            ? form.plano
                            : form.plano
                              ? 'outro'
                              : ''
                        }
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'outro') {
                            setForm((f) => ({ ...f, plano: 'Outro', valor: f.valor || 0 }))
                          } else {
                            const p = PLANOS_IPTV.find((x) => x.id === v)
                            if (p) setForm((f) => ({ ...f, plano: p.id, valor: p.valor }))
                          }
                        }}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      >
                        <option value="">— Selecione o plano —</option>
                        {PLANOS_IPTV.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                        <option value="outro">Outro (a especificar)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Servidor</label>
                      <select
                        value={form.servidorId ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, servidorId: e.target.value ? Number(e.target.value) : null }))
                        }
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      >
                        <option value="">— Nenhum —</option>
                        {servidores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.tipo === 'secundario' && s.servidor
                              ? `${s.nome} (Secundário → ${s.servidor.nome})`
                              : s.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Revendedor</label>
                      <select
                        value={form.revendedorId ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, revendedorId: e.target.value ? Number(e.target.value) : null }))
                        }
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      >
                        <option value="">— Nenhum —</option>
                        {revendedores.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {editStep === 2 && form.servico === 'netflix' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Plano</label>
                      <select
                        value={
                          PLANOS_NETFLIX.some((p) => p.id === form.plano)
                            ? form.plano
                            : form.plano
                              ? 'outro'
                              : ''
                        }
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'outro') {
                            setForm((f) => ({ ...f, plano: 'Outro', valor: f.valor || 0 }))
                          } else {
                            const p = PLANOS_NETFLIX.find((x) => x.id === v)
                            if (p) setForm((f) => ({ ...f, plano: p.id, valor: p.valor }))
                          }
                        }}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      >
                        <option value="">— Selecione o plano —</option>
                        {PLANOS_NETFLIX.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                        <option value="outro">Outro (a especificar)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Sala (conta)</label>
                      {form.plano === 'Plano Room' ? (
                        <select
                          value={form.salaId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value
                            const id = v === '' ? null : Number(v)
                            const sala = id ? salas.find((s) => s.id === id) : null
                            setForm((f) => ({
                              ...f,
                              salaId: id,
                              dataFim: sala?.dataFim ? String(sala.dataFim).slice(0, 10) : f.dataFim,
                            }))
                          }}
                          className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                        >
                          <option value="">— Nenhuma —</option>
                          {salas.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-3 py-2 border border-netflix-border rounded-lg text-sm bg-netflix-panel/50 text-gray-500">—</div>
                      )}
                    </div>
                  </>
                )}
                {editStep === 3 && form.servico === 'iptv' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Nome de utilizador</label>
                      <input
                        type="text"
                        value={form.perfil || ''}
                        onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                        placeholder="Ex: nome de utilizador da linha"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Valor mensal (kz)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.valor ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) || 0 }))}
                        readOnly={PLANOS_IPTV.some((p) => p.id === form.plano)}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none min-h-[42px] [&:read-only]:cursor-default [&:read-only]:opacity-90"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Data fim</label>
                      <input
                        type="date"
                        value={form.dataFim ? String(form.dataFim).slice(0, 10) : ''}
                        onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      />
                    </div>
                  </>
                )}
                {editStep === 3 && form.servico === 'netflix' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Perfil</label>
                      <input
                        type="text"
                        value={form.perfil || ''}
                        onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                        placeholder="Ex: nome do perfil Netflix"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-0.5">Valor mensal (kz)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.valor ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) || 0 }))}
                          readOnly={PLANOS_NETFLIX.some((p) => p.id === form.plano)}
                          className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none min-h-[42px] [&:read-only]:cursor-default [&:read-only]:opacity-90"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-0.5">
                          {form.salaId ? 'Data fim (da sala)' : 'Data fim'}
                        </label>
                        <input
                          type="date"
                          value={form.dataFim ? String(form.dataFim).slice(0, 10) : ''}
                          readOnly
                          className="w-full px-3 py-2 bg-netflix-panel/60 border border-netflix-border rounded-lg text-sm text-gray-400 cursor-default"
                        />
                      </div>
                    </div>
                    {(() => {
                      const planoNetflix = PLANOS_NETFLIX.find((p) => p.id === form.plano)
                      const valorInscricao = planoNetflix?.inscricao
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-0.5">Inscrição</label>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-netflix-panel/60 border border-netflix-border/60 min-h-[42px]">
                            <input
                              type="checkbox"
                              id="inscricao-paga-new"
                              checked={form.inscricaoPaga === true}
                              onChange={(e) => setForm((f) => ({ ...f, inscricaoPaga: e.target.checked }))}
                              className="w-4 h-4 rounded border-netflix-border bg-netflix-panel text-primary-600 focus:ring-primary-500/50"
                            />
                            <label htmlFor="inscricao-paga-new" className="text-sm text-gray-300 cursor-pointer">
                              Inscrição já paga?{valorInscricao != null ? ` (${valorInscricao.toLocaleString('pt-PT')} Kz)` : ''}
                            </label>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            ) : (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Nome</label>
                <input
                  type="text"
                  value={form.nome || ''}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">WhatsApp</label>
                <input
                  type="text"
                  value={form.whatsapp || ''}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  placeholder="244 9XX XXX XXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Localização</label>
                <input
                  type="text"
                  value={form.localizacao ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, localizacao: e.target.value }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  placeholder="Ex: Luanda, Benguela..."
                />
              </div>
              <div className={form.servico === 'netflix' ? 'grid grid-cols-2 gap-2' : ''}>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-0.5">Plano</label>
                  {form.servico === 'iptv' ? (
                    <>
                      <select
                        value={
                          PLANOS_IPTV.some((p) => p.id === form.plano)
                            ? form.plano
                            : form.plano
                              ? 'outro'
                              : ''
                        }
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'outro') {
                            setForm((f) => ({ ...f, plano: 'Outro', valor: f.valor || 0 }))
                          } else {
                            const p = PLANOS_IPTV.find((x) => x.id === v)
                            if (p) setForm((f) => ({ ...f, plano: p.id, valor: p.valor }))
                          }
                        }}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      >
                        <option value="">— Selecione o plano —</option>
                        {PLANOS_IPTV.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                        <option value="outro">Outro (a especificar)</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <select
                        value={
                          PLANOS_NETFLIX.some((p) => p.id === form.plano)
                            ? form.plano
                            : form.plano
                              ? 'outro'
                              : ''
                        }
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'outro') {
                            setForm((f) => ({ ...f, plano: 'Outro', valor: f.valor || 0 }))
                          } else {
                            const p = PLANOS_NETFLIX.find((x) => x.id === v)
                            if (p) setForm((f) => ({ ...f, plano: p.id, valor: p.valor }))
                          }
                        }}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      >
                        <option value="">— Selecione o plano —</option>
                        {PLANOS_NETFLIX.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                        <option value="outro">Outro (a especificar)</option>
                      </select>
                    </>
                  )}
                </div>
                {form.servico === 'netflix' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-0.5">Sala (conta)</label>
                    {form.plano === 'Plano Room' ? (
                      <select
                        value={form.salaId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          const id = v === '' ? null : Number(v)
                          const sala = id ? salas.find((s) => s.id === id) : null
                          setForm((f) => ({
                            ...f,
                            salaId: id,
                            dataFim: sala?.dataFim ? String(sala.dataFim).slice(0, 10) : f.dataFim,
                          }))
                        }}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      >
                        <option value="">— Nenhuma —</option>
                        {salas.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="px-3 py-2 border border-netflix-border rounded-lg text-sm bg-netflix-panel/50 text-gray-500">—</div>
                    )}
                  </div>
                )}
              </div>
              {form.servico === 'iptv' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-0.5">Servidor</label>
                    <select
                      value={form.servidorId ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, servidorId: e.target.value ? Number(e.target.value) : null }))
                      }
                      className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                    >
                      <option value="">— Nenhum —</option>
                      {servidores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.tipo === 'secundario' && s.servidor
                            ? `${s.nome} (Secundário → ${s.servidor.nome})`
                            : s.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-0.5">Revendedor</label>
                    <select
                      value={form.revendedorId ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, revendedorId: e.target.value ? Number(e.target.value) : null }))
                      }
                      className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                    >
                      <option value="">— Nenhum —</option>
                      {revendedores.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">
                  {form.servico === 'netflix'
                    ? 'Perfil'
                    : form.servico === 'iptv'
                      ? 'Nome de utilizador'
                      : 'Perfil / Nome de utilizador'}
                </label>
                <input
                  type="text"
                  value={form.perfil || ''}
                  onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  placeholder={
                    form.servico === 'netflix'
                      ? 'Ex: nome do perfil Netflix'
                      : form.servico === 'iptv'
                        ? 'Ex: nome de utilizador da linha'
                        : 'Perfil ou nome de utilizador conforme o serviço'
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-0.5">Valor mensal (kz)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) || 0 }))}
                    readOnly={
                      (form.servico === 'iptv' && PLANOS_IPTV.some((p) => p.id === form.plano)) ||
                      (form.servico === 'netflix' && PLANOS_NETFLIX.some((p) => p.id === form.plano))
                    }
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none min-h-[42px] [&:read-only]:cursor-default [&:read-only]:opacity-90"
                  />
                </div>
                {form.servico === 'netflix' && (() => {
                  const planoNetflix = PLANOS_NETFLIX.find((p) => p.id === form.plano)
                  const valorInscricao = planoNetflix?.inscricao
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">Inscrição</label>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-netflix-panel/60 border border-netflix-border/60 min-h-[42px]">
                        <input
                          type="checkbox"
                          id="inscricao-paga"
                          checked={form.inscricaoPaga === true}
                          onChange={(e) => setForm((f) => ({ ...f, inscricaoPaga: e.target.checked }))}
                          className="w-4 h-4 rounded border-netflix-border bg-netflix-panel text-primary-600 focus:ring-primary-500/50"
                        />
                        <label htmlFor="inscricao-paga" className="text-sm text-gray-300 cursor-pointer">
                          Inscrição já paga?{valorInscricao != null ? ` (${valorInscricao.toLocaleString('pt-PT')} Kz)` : ''}
                        </label>
                      </div>
                    </div>
                  )
                })()}
                {(modal === 'edit' || (modal === 'new' && form.servico === 'iptv')) && form.servico === 'iptv' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-0.5">Data fim</label>
                    <input
                      type="date"
                      value={form.dataFim ? String(form.dataFim).slice(0, 10) : ''}
                      onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                      className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                    />
                  </div>
                )}
              </div>
              {modal === 'edit' && (
                <div className={form.servico === 'netflix' ? 'grid grid-cols-2 gap-2' : ''}>
                  {form.servico === 'netflix' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-0.5">
                        {form.salaId ? 'Data fim (da sala)' : 'Data fim'}
                      </label>
                      <input
                        type="date"
                        value={form.dataFim ? String(form.dataFim).slice(0, 10) : ''}
                        onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                        className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-0.5">Estado</label>
                    <select
                      value={form.status || 'ativo'}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="vencido">Vencido</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            )}
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80 shrink-0">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
              >
                Cancelar
              </button>
              {(modal === 'edit' && form.servico === 'netflix') || modal === 'new' ? (
                <>
                  {editStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setEditStep((s) => s - 1)}
                      className="py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
                    >
                      Anterior
                    </button>
                  )}
                  {editStep < (modal === 'new' ? 3 : 4) ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (modal === 'new') {
                          const err = validateNewClientStep(editStep)
                          if (err) {
                            showWarning(err)
                            return
                          }
                        }
                        setEditStep((s) => s + 1)
                      }}
                      className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-900/30"
                    >
                      Próximo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={saveClient}
                      className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-900/30"
                    >
                      Guardar
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={saveClient}
                  className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-900/30"
                >
                  Guardar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
