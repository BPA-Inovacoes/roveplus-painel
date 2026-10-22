import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, LayoutGrid, Search, UserPlus, Users, Wallet, X } from 'lucide-react'
import { RoveModalOverlay } from './RoveModalOverlay'
import { RoveWhatsappLink } from './RoveWhatsappLink'
import { mesesPagamentoLabel } from './roveFormUi'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'
import { MAX_CLIENTES_POR_SALA } from '../lib/planos'

interface SalaCliente {
  id: number
  roveId: string | null
  nome: string
  whatsapp: string
  plano: string
  perfil: string | null
  pin: string | null
  dataFim: string
  valor: number
  status: string
}

interface ClienteCandidato {
  id: number
  roveId: string | null
  nome: string
  whatsapp: string
  perfil: string | null
  status: string
  salaId: number | null
  sala: { nome: string } | null
}

interface SalaPagamento {
  id: number
  dataPagamento: string
  meses: number
  valor: number
  periodoInicio: string
  periodoFim: string
}

interface SalaDetalhes {
  id: number
  nome: string
  email: string | null
  senha: string | null
  observacoes: string | null
  dataFim: string | null
  status: string
  clients: SalaCliente[]
  pagamentos: SalaPagamento[]
}

const statusClienteUi: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-900/50 text-green-300' },
  vencido: { label: 'Vencido', className: 'bg-red-900/50 text-red-300' },
  inativo: { label: 'Inativo', className: 'bg-amber-900/50 text-amber-300' },
  cancelado: { label: 'Cancelado', className: 'bg-gray-700 text-gray-300' },
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('pt-PT')
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function prazoTexto(days: number) {
  if (days > 0) return `vence em ${days}d`
  if (days === 0) return 'vence hoje'
  return `vencido há ${-days}d`
}

function prazoCor(days: number) {
  if (days < 0) return 'text-red-400'
  if (days <= 3) return 'text-amber-300'
  if (days <= 7) return 'text-amber-400'
  return 'text-gray-300'
}

function InfoLinha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-netflix-border/50 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-white text-right break-all">{children}</span>
    </div>
  )
}

export function SalaDetalhesModal({
  salaId,
  onClose,
  onChanged,
}: {
  salaId: number
  onClose: () => void
  /** Chamado depois de adicionar um cliente (para atualizar a contagem de lugares na lista de salas). */
  onChanged?: () => void
}) {
  const { showError, showInfo } = useAlert()
  const [data, setData] = useState<SalaDetalhes | null>(null)
  const [showSenha, setShowSenha] = useState(false)
  const [showPins, setShowPins] = useState(false)
  const [adicionar, setAdicionar] = useState(false)
  const [candidatos, setCandidatos] = useState<ClienteCandidato[] | null>(null)
  const [pesquisa, setPesquisa] = useState('')
  const [aAdicionar, setAAdicionar] = useState<number | null>(null)

  function load() {
    api
      .get<SalaDetalhes>(`/api/salas/${salaId}`)
      .then(setData)
      .catch((e) => {
        showError(e instanceof Error ? e.message : 'Erro ao carregar detalhes da sala')
        onClose()
      })
  }

  useEffect(load, [salaId])

  function abrirAdicionar() {
    setAdicionar(true)
    setPesquisa('')
    setCandidatos(null)
    api
      .get<ClienteCandidato[]>('/api/clients')
      .then(setCandidatos)
      .catch((e) => showError(e instanceof Error ? e.message : 'Erro ao carregar clientes'))
  }

  async function adicionarCliente(c: ClienteCandidato) {
    setAAdicionar(c.id)
    try {
      await api.patch(`/api/clients/${c.id}`, { salaId })
      showInfo(`${c.nome} ${c.salaId ? 'transferido para' : 'adicionado a'} ${data?.nome ?? 'esta sala'}.`)
      setCandidatos((list) => list?.map((x) => (x.id === c.id ? { ...x, salaId, sala: null } : x)) ?? null)
      load()
      onChanged?.()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao adicionar cliente à sala')
    } finally {
      setAAdicionar(null)
    }
  }

  // Clientes que podem entrar nesta sala: não cancelados e noutra sala ou sem sala (sem sala primeiro).
  const termo = pesquisa.trim().toLowerCase()
  const disponiveis = (candidatos ?? [])
    .filter((c) => c.salaId !== salaId && c.status !== 'cancelado')
    .filter(
      (c) =>
        !termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.whatsapp.includes(termo) ||
        (c.roveId ?? '').toLowerCase().includes(termo) ||
        (c.perfil ?? '').toLowerCase().includes(termo)
    )
    .sort((a, b) => Number(a.salaId != null) - Number(b.salaId != null) || a.nome.localeCompare(b.nome))

  const ativa = (data?.status || 'ativo') === 'ativo'
  const diasSala = data?.dataFim ? daysUntil(data.dataFim) : null
  const clientesAtivos = data?.clients.filter((c) => c.status === 'ativo').length ?? 0
  const lugaresOcupados = data?.clients.filter((c) => c.status !== 'cancelado').length ?? 0
  const receitaMensal = data?.clients.filter((c) => c.status === 'ativo').reduce((s, c) => s + c.valor, 0) ?? 0

  return (
    <RoveModalOverlay>
      <div className="bg-netflix-card rounded-2xl shadow-2xl border border-sky-500/30 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-netflix-border/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-semibold text-white truncate">{data?.nome ?? 'A carregar...'}</h3>
            {data && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    ativa ? 'bg-green-900/50 text-green-300' : 'bg-amber-900/50 text-amber-300'
                  }`}
                >
                  {ativa ? 'Ativa' : 'Suspensa'}
                </span>
                <span className="text-xs text-gray-400">
                  {lugaresOcupados}/{MAX_CLIENTES_POR_SALA} lugares ocupados · {clientesAtivos} ativo(s) ·{' '}
                  {receitaMensal.toLocaleString('pt-PT')} kz/mês
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-netflix-hover"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!data ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-y-auto p-5 space-y-5">
            {/* Conta Netflix */}
            <section className="rounded-xl border border-netflix-border/80 bg-netflix-panel/40 px-4 py-2">
              <InfoLinha label="Email da conta">{data.email || '—'}</InfoLinha>
              <InfoLinha label="Senha">
                {data.senha ? (
                  <span className="inline-flex items-center gap-2 font-mono">
                    {showSenha ? data.senha : '••••••••'}
                    <button
                      type="button"
                      onClick={() => setShowSenha((v) => !v)}
                      className="text-gray-400 hover:text-white"
                      title={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </span>
                ) : (
                  '—'
                )}
              </InfoLinha>
              <InfoLinha label="Pagamento da conta (data fim)">
                {data.dataFim ? (
                  <>
                    {formatDate(data.dataFim)}
                    {diasSala !== null && (
                      <span className={`ml-1.5 text-xs ${prazoCor(diasSala)}`}>({prazoTexto(diasSala)})</span>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </InfoLinha>
              <InfoLinha label="Observações">{data.observacoes || '—'}</InfoLinha>
            </section>

            {/* Clientes */}
            <section>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Clientes na sala ({data.clients.length})
                </p>
                <div className="flex items-center gap-3">
                  {data.clients.some((c) => c.pin) && (
                    <button
                      type="button"
                      onClick={() => setShowPins((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                    >
                      {showPins ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showPins ? 'Ocultar PIN' : 'Mostrar PIN'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (adicionar ? setAdicionar(false) : abrirAdicionar())}
                    disabled={!adicionar && lugaresOcupados >= MAX_CLIENTES_POR_SALA}
                    title={
                      lugaresOcupados >= MAX_CLIENTES_POR_SALA
                        ? `Sala cheia (máximo ${MAX_CLIENTES_POR_SALA} clientes)`
                        : 'Adicionar um cliente a esta sala'
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {adicionar ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {adicionar ? 'Fechar' : 'Adicionar cliente'}
                  </button>
                </div>
              </div>
              {adicionar && (
                <div className="mb-3 rounded-xl border border-sky-500/30 bg-sky-950/10 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-400">
                      {MAX_CLIENTES_POR_SALA - lugaresOcupados > 0
                        ? `${MAX_CLIENTES_POR_SALA - lugaresOcupados} lugar(es) livre(s). Clientes de outra sala são transferidos.`
                        : 'Sala cheia.'}
                    </p>
                    <Link to="/clientes" className="text-xs text-sky-300 hover:underline shrink-0">
                      Criar novo cliente
                    </Link>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={pesquisa}
                      onChange={(e) => setPesquisa(e.target.value)}
                      placeholder="Pesquisar por nome, contacto, perfil ou ID"
                      className="w-full pl-8 pr-2.5 py-1.5 bg-netflix-panel border border-netflix-border rounded-lg text-xs text-white placeholder-gray-500 focus:ring-2 focus:ring-sky-500/40 outline-none"
                    />
                  </div>
                  {!candidatos ? (
                    <p className="text-xs text-gray-500 py-2">A carregar clientes...</p>
                  ) : disponiveis.length === 0 ? (
                    <p className="text-xs text-gray-500 py-2">Nenhum cliente encontrado.</p>
                  ) : (
                    <ul className="max-h-60 overflow-y-auto divide-y divide-netflix-border/60 rounded-lg border border-netflix-border/60">
                      {disponiveis.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">
                              {c.nome}
                              {c.roveId && <span className="ml-1.5 text-[11px] text-primary-300">{c.roveId}</span>}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {c.whatsapp} · {c.sala ? `Na ${c.sala.nome}` : 'Sem sala'}
                              {c.perfil ? ` · perfil ${c.perfil}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => adicionarCliente(c)}
                            disabled={aAdicionar != null || lugaresOcupados >= MAX_CLIENTES_POR_SALA}
                            className="shrink-0 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                          >
                            {aAdicionar === c.id ? 'A adicionar...' : c.salaId ? 'Transferir' : 'Adicionar'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {data.clients.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum cliente nesta sala.</p>
              ) : (
                <div className="rounded-xl border border-netflix-border/80 overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-netflix-panel/80 text-gray-400 text-xs">
                      <tr>
                        <th className="px-3 py-2 font-medium">Cliente</th>
                        <th className="px-3 py-2 font-medium">Contacto</th>
                        <th className="px-3 py-2 font-medium">Perfil</th>
                        <th className="px-3 py-2 font-medium">PIN</th>
                        <th className="px-3 py-2 font-medium">Pago até</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-netflix-border/60 text-gray-200">
                      {data.clients.map((c) => {
                        const days = daysUntil(c.dataFim)
                        const st = statusClienteUi[c.status] ?? { label: c.status, className: 'bg-gray-700 text-gray-300' }
                        return (
                          <tr key={c.id}>
                            <td className="px-3 py-2">
                              <div className="text-white">{c.nome}</div>
                              {c.roveId && <div className="text-[11px] text-primary-300">{c.roveId}</div>}
                            </td>
                            <td className="px-3 py-2">
                              <RoveWhatsappLink value={c.whatsapp} compact />
                            </td>
                            <td className="px-3 py-2 text-gray-300">{c.perfil || '—'}</td>
                            <td className="px-3 py-2 font-mono text-gray-300">
                              {!c.pin ? '—' : showPins ? c.pin : '••••'}
                            </td>
                            <td className="px-3 py-2">
                              <span className={prazoCor(days)}>{formatDate(c.dataFim)}</span>
                              {c.status === 'ativo' && (
                                <span className="block text-[11px] text-gray-500">{prazoTexto(days)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.className}`}>
                                {st.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Pagamentos da conta */}
            <section>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 flex items-center gap-1.5 mb-2">
                <Wallet className="w-3.5 h-3.5" />
                Pagamentos da conta
              </p>
              {data.pagamentos.length === 0 ? (
                <p className="text-sm text-gray-500">Ainda não há pagamentos registados.</p>
              ) : (
                <div className="space-y-2">
                  {data.pagamentos.map((h) => (
                    <div key={h.id} className="rounded-xl border border-netflix-border/80 bg-netflix-panel/40 px-3 py-2">
                      <p className="text-sm text-white">
                        Pago a {formatDate(h.dataPagamento)} · {mesesPagamentoLabel(h.meses)} ·{' '}
                        {Number(h.valor).toLocaleString('pt-PT')} kz
                      </p>
                      <p className="text-xs text-gray-500">
                        Cobre {formatDate(h.periodoInicio)} → {formatDate(h.periodoFim)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </RoveModalOverlay>
  )
}
