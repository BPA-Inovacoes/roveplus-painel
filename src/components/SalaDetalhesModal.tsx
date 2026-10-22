import { useEffect, useState } from 'react'
import { Eye, EyeOff, LayoutGrid, Users, Wallet, X } from 'lucide-react'
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

export function SalaDetalhesModal({ salaId, onClose }: { salaId: number; onClose: () => void }) {
  const { showError } = useAlert()
  const [data, setData] = useState<SalaDetalhes | null>(null)
  const [showSenha, setShowSenha] = useState(false)
  const [showPins, setShowPins] = useState(false)

  useEffect(() => {
    api
      .get<SalaDetalhes>(`/api/salas/${salaId}`)
      .then(setData)
      .catch((e) => {
        showError(e instanceof Error ? e.message : 'Erro ao carregar detalhes da sala')
        onClose()
      })
  }, [salaId])

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
              </div>
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
