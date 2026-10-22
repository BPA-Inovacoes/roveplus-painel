import { useEffect, useState } from 'react'
import { Wallet, Trash2, X, CheckCircle, Clock, CalendarClock } from 'lucide-react'
import { RoveModalOverlay } from './RoveModalOverlay'
import { RoveSelect } from './RoveSelect'
import { RoveDatePicker } from './RoveDatePicker'
import { mesesPagamentoLabel, RoveFormLabel } from './roveFormUi'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'
import { LoadingButton } from './LoadingButton'
import { useBusy } from '../lib/useBusy'

type EstadoPeriodo = 'expirado' | 'em_curso' | 'futuro'

interface PeriodoPago {
  id: number
  numero: number
  inicio: string
  fim: string
  valor: number
  notificadoAt: string | null
  estado: EstadoPeriodo
}

interface Pagamento {
  id: number
  dataPagamento: string
  meses: number
  valorTotal: number
  metodo: string | null
  observacoes: string | null
  origem: string
  periodos: PeriodoPago[]
}

interface PagamentosResponse {
  pagamentos: Pagamento[]
  resumo: {
    totalPago: number
    mesesPagos: number
    mesesExpirados: number
    mesesRestantes: number
    pagoAte: string | null
    /** Limite para renovar (dia 10); depois fica vencido. */
    renovarAte: string | null
    /** Primeiro mês que o próximo pagamento cobre. */
    proximoMes: string
  }
}

export interface PagamentosClienteAlvo {
  id: number
  nome: string
  valor: number
  dataFim: string
  status: string
}

const METODOS = [
  { id: 'multicaixa', label: 'Multicaixa Express' },
  { id: 'transferencia', label: 'Transferência' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'outro', label: 'Outro' },
] as const

const estadoUi: Record<EstadoPeriodo, { label: string; className: string; Icon: typeof CheckCircle }> = {
  expirado: { label: 'Terminado', className: 'border-gray-600 bg-gray-800/60 text-gray-400', Icon: CheckCircle },
  em_curso: { label: 'Em curso', className: 'border-green-500/50 bg-green-500/15 text-green-300', Icon: Clock },
  futuro: { label: 'Pago (futuro)', className: 'border-sky-500/50 bg-sky-500/10 text-sky-300', Icon: CalendarClock },
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('pt-PT')
}

function formatKz(n: number) {
  return `${Number(n).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kz`
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nomeMes(d: Date) {
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

export function PagamentosClienteModal({
  client,
  canDelete,
  onClose,
  onChanged,
}: {
  client: PagamentosClienteAlvo
  /** Admin / financeiro podem anular um pagamento registado por engano. */
  canDelete: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { showError, showInfo } = useAlert()
  const [data, setData] = useState<PagamentosResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { busy, run } = useBusy()
  const [confirmDelete, setConfirmDelete] = useState<Pagamento | null>(null)
  const [meses, setMeses] = useState<number | ''>('')
  const [valorTotal, setValorTotal] = useState<string>('')
  const [valorEditado, setValorEditado] = useState(false)
  const [dataPagamento, setDataPagamento] = useState(todayIso())
  const [metodo, setMetodo] = useState('')
  const [observacoes, setObservacoes] = useState('')

  function load() {
    setLoading(true)
    api
      .get<PagamentosResponse>(`/api/clients/${client.id}/pagamentos`)
      .then(setData)
      .catch((e) => showError(e instanceof Error ? e.message : 'Erro ao carregar pagamentos'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [client.id])

  useEffect(() => {
    if (!valorEditado) setValorTotal(meses === '' ? '' : String(Number(client.valor) * meses))
  }, [meses, client.valor, valorEditado])

  // Pré-visualização (mesma regra do servidor): meses de calendário a partir do próximo mês por pagar;
  // renovação até ao dia 10 do mês seguinte ao último mês pago.
  const proximoMes = data ? new Date(data.resumo.proximoMes) : null
  const ultimoMes = proximoMes && meses !== '' ? new Date(proximoMes.getFullYear(), proximoMes.getMonth() + meses - 1, 1) : null
  const renovarAtePrevisto = ultimoMes ? new Date(ultimoMes.getFullYear(), ultimoMes.getMonth() + 1, 10) : null

  async function registar() {
    if (meses === '') return
    setSaving(true)
    try {
      await api.post(`/api/clients/${client.id}/pagamentos`, {
        meses,
        valorTotal: valorTotal === '' ? undefined : Number(valorTotal),
        dataPagamento,
        metodo: metodo || undefined,
        observacoes: observacoes.trim() || undefined,
      })
      showInfo(`Pagamento de ${mesesPagamentoLabel(meses)} registado para ${client.nome}.`)
      setMeses('')
      setValorEditado(false)
      setMetodo('')
      setObservacoes('')
      setDataPagamento(todayIso())
      load()
      onChanged()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao registar pagamento')
    } finally {
      setSaving(false)
    }
  }

  async function anular() {
    if (!confirmDelete) return
    try {
      await api.delete(`/api/clients/${client.id}/pagamentos/${confirmDelete.id}`)
      setConfirmDelete(null)
      load()
      onChanged()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao anular pagamento')
    }
  }

  const resumo = data?.resumo

  return (
    <RoveModalOverlay>
      <div className="bg-netflix-card rounded-2xl shadow-2xl border border-green-500/30 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-netflix-border/80 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-green-500/20 text-green-400 ring-1 ring-green-500/30">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-semibold text-white">Pagamentos</h3>
            <p className="text-sm text-gray-400 mt-0.5 truncate">
              <span className="text-white font-medium">{client.nome}</span> · mensalidade {formatKz(client.valor)}
            </p>
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

        <div className="overflow-y-auto p-5 space-y-5">
          {resumo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Renovar até', value: formatDate(resumo.renovarAte ?? client.dataFim) },
                { label: 'Meses restantes', value: String(resumo.mesesRestantes) },
                { label: 'Meses terminados', value: String(resumo.mesesExpirados) },
                { label: 'Total pago', value: formatKz(resumo.totalPago) },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-netflix-border/80 bg-netflix-panel/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">{s.label}</p>
                  <p className="text-sm font-semibold text-white tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Registar novo pagamento */}
          <div className="rounded-xl border border-green-500/25 bg-green-950/10 p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-green-300/80">Registar pagamento</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <RoveFormLabel required>Meses pagos</RoveFormLabel>
                <RoveSelect
                  compact
                  required
                  value={meses === '' ? '' : String(meses)}
                  onChange={(e) => setMeses(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Selecione os meses"
                >
                  <option value="">Selecione os meses</option>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {mesesPagamentoLabel(n)}
                    </option>
                  ))}
                </RoveSelect>
              </div>
              <div>
                <RoveFormLabel>Valor pago (kz)</RoveFormLabel>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={valorTotal}
                  onChange={(e) => {
                    setValorEditado(true)
                    setValorTotal(e.target.value)
                  }}
                  placeholder="Mensalidade × meses"
                  className="w-full px-2.5 py-1.5 bg-netflix-panel border border-netflix-border rounded-lg text-xs text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/40 outline-none"
                />
              </div>
              <div>
                <RoveFormLabel>Data do pagamento</RoveFormLabel>
                <RoveDatePicker compact allowPastDates value={dataPagamento} onChange={setDataPagamento} />
              </div>
              <div>
                <RoveFormLabel>Método</RoveFormLabel>
                <RoveSelect compact value={metodo} onChange={(e) => setMetodo(e.target.value)} placeholder="(opcional)">
                  <option value="">(opcional)</option>
                  {METODOS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </RoveSelect>
              </div>
            </div>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações (opcional)"
              className="w-full px-2.5 py-1.5 bg-netflix-panel border border-netflix-border rounded-lg text-xs text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/40 outline-none"
            />
            {proximoMes && ultimoMes && renovarAtePrevisto && (
              <p className="text-xs text-gray-400">
                Cobre <span className="text-white">{nomeMes(proximoMes)}</span>
                {meses !== 1 && (
                  <>
                    {' '}até <span className="text-white">{nomeMes(ultimoMes)}</span>
                  </>
                )}
                . Próxima renovação entre 1 e{' '}
                <span className="text-green-300 font-medium">{renovarAtePrevisto.toLocaleDateString('pt-PT')}</span>; depois fica
                vencido.
              </p>
            )}
            <p className="text-[11px] text-gray-500">
              Regra: cada pagamento cobre meses de calendário. A renovação faz-se do dia 1 ao dia 10 do mês seguinte.
            </p>
            <div className="flex justify-end">
              <LoadingButton
                onClick={registar}
                loading={saving}
                disabled={meses === ''}
                className="py-2 px-4 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'A registar...' : 'Registar pagamento'}
              </LoadingButton>
            </div>
          </div>

          {/* Histórico */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Histórico</p>
            {loading && <p className="text-sm text-gray-400">A carregar...</p>}
            {!loading && data && data.pagamentos.length === 0 && (
              <p className="text-sm text-gray-500">Ainda não há pagamentos registados.</p>
            )}
            {data?.pagamentos.map((p) => (
              <div key={p.id} className="rounded-xl border border-netflix-border/80 bg-netflix-panel/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-white font-medium">
                      Pago a {formatDate(p.dataPagamento)} · {mesesPagamentoLabel(p.meses)} · {formatKz(p.valorTotal)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.origem === 'inicial' ? 'Registo inicial' : METODOS.find((m) => m.id === p.metodo)?.label ?? 'Painel'}
                      {p.observacoes ? ` · ${p.observacoes}` : ''}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(p)}
                      title="Anular pagamento"
                      className="p-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.periodos.map((m) => {
                    const ui = estadoUi[m.estado]
                    return (
                      <span
                        key={m.id}
                        title={`${ui.label}${m.notificadoAt ? ' · cliente avisado' : ''}`}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${ui.className}`}
                      >
                        <ui.Icon className="w-3 h-3" />
                        {new Date(m.inicio).getDate() === 1 && new Date(m.fim).getDate() === 1
                          ? nomeMes(new Date(m.inicio))
                          : `${m.numero}.º ${formatDate(m.inicio)} → ${formatDate(m.fim)}`}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <RoveModalOverlay zIndex={60} dimClassName="bg-black/70">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-red-500/40 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Anular pagamento</h3>
            <p className="text-sm text-gray-300">
              Anular o pagamento de {formatDate(confirmDelete.dataPagamento)} ({mesesPagamentoLabel(confirmDelete.meses)},{' '}
              {formatKz(confirmDelete.valorTotal)})? A data fim do cliente volta ao último mês pago que restar.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover"
              >
                Cancelar
              </button>
              <LoadingButton
                onClick={() => run('anular', anular)}
                loading={busy === 'anular'}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
              >
                Anular
              </LoadingButton>
            </div>
          </div>
        </RoveModalOverlay>
      )}
    </RoveModalOverlay>
  )
}
