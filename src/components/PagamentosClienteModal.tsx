import { useEffect, useMemo, useState } from 'react'
import { Wallet, Trash2, X, CheckCircle, Clock, CalendarClock, Pencil, AlertTriangle } from 'lucide-react'
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
  /** Mês de calendário coberto (dia 1). */
  mes: string
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
  /** Limite de renovação do pagamento anterior (null no primeiro pagamento). */
  prazo: string | null
  diasAtraso: number
  atrasoAuto: boolean
  /** null = automático; true/false = marcado pelo gestor. */
  atrasoManual: boolean | null
  atraso: boolean
}

interface PagamentosResponse {
  pagamentos: Pagamento[]
  resumo: {
    totalPago: number
    pagamentosEmAtraso: number
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

/** Valor do select de atraso: automático (pagamento anterior) ou marcado pelo gestor. */
type AtrasoEscolha = 'auto' | 'sim' | 'nao'

const estadoUi: Record<EstadoPeriodo, { label: string; className: string; Icon: typeof CheckCircle }> = {
  expirado: { label: 'Terminado', className: 'border-gray-600 bg-gray-800/60 text-gray-400', Icon: CheckCircle },
  em_curso: { label: 'Em curso', className: 'border-green-500/50 bg-green-500/15 text-green-300', Icon: Clock },
  futuro: { label: 'Pago (futuro)', className: 'border-sky-500/50 bg-sky-500/10 text-sky-300', Icon: CalendarClock },
}

type EstadoMes = 'pago' | 'pago_atraso' | 'nao_pago' | 'por_pagar'

const estadoMesUi: Record<EstadoMes, { label: string; className: string }> = {
  pago: { label: 'Pago', className: 'border-green-500/50 bg-green-500/15 text-green-300' },
  pago_atraso: { label: 'Pago com atraso', className: 'border-amber-500/50 bg-amber-500/15 text-amber-300' },
  nao_pago: { label: 'Não pago', className: 'border-red-500/50 bg-red-500/15 text-red-300 hover:bg-red-500/25' },
  por_pagar: { label: 'Por pagar', className: 'border-netflix-border bg-netflix-panel/60 text-gray-400 hover:bg-netflix-hover' },
}

const inputClass =
  'w-full px-2.5 py-1.5 bg-netflix-panel border border-netflix-border rounded-lg text-xs text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/40 outline-none'

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('pt-PT')
}

function formatKz(n: number) {
  return `${Number(n).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kz`
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayIso() {
  return toIso(new Date())
}

function nomeMes(d: Date) {
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

function nomeMesCurto(d: Date) {
  return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
}

/** Chave AAAA-MM de um mês (data local). */
function chaveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesDaChave(k: string) {
  const [y, m] = k.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

function somarMeses(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** Dia 10 do mês seguinte ao último mês pago (mesma regra do servidor). */
function limiteRenovacao(ultimoMes: Date) {
  return new Date(ultimoMes.getFullYear(), ultimoMes.getMonth() + 1, 10)
}

function atrasoEscolha(p: Pagamento): AtrasoEscolha {
  return p.atrasoManual == null ? 'auto' : p.atrasoManual ? 'sim' : 'nao'
}

function atrasoBody(e: AtrasoEscolha) {
  return e === 'auto' ? null : e === 'sim'
}

// ----------------------------------------------------------------------------------------------

type FormValues = {
  mesInicial: string // chave AAAA-MM
  meses: number | ''
  valorTotal: string
  valorEditado: boolean
  dataPagamento: string
  metodo: string
  observacoes: string
  atraso: AtrasoEscolha
}

/**
 * Campos do pagamento (registar e editar). Mostra a pré-visualização dos meses cobertos e se,
 * pela regra automática, o pagamento fica em atraso face ao pagamento anterior.
 */
function PagamentoCampos({
  values,
  onChange,
  mensalidade,
  mesesOcupados,
  opcoesMes,
  fimPorMes,
}: {
  values: FormValues
  onChange: (patch: Partial<FormValues>) => void
  mensalidade: number
  /** Meses já pagos por outros pagamentos (chave AAAA-MM). */
  mesesOcupados: Set<string>
  opcoesMes: { chave: string; label: string }[]
  /** Último mês coberto por cada pagamento (outros), para achar o pagamento anterior. */
  fimPorMes: Date[]
}) {
  const { mesInicial, meses, valorTotal, valorEditado, dataPagamento, metodo, observacoes, atraso } = values

  useEffect(() => {
    if (!valorEditado) onChange({ valorTotal: meses === '' ? '' : String(mensalidade * meses) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meses, mensalidade, valorEditado])

  const primeiro = mesInicial ? mesDaChave(mesInicial) : null
  const ultimo = primeiro && meses !== '' ? somarMeses(primeiro, meses - 1) : null
  const conflito =
    primeiro && meses !== ''
      ? Array.from({ length: meses }, (_, i) => somarMeses(primeiro, i)).find((m) => mesesOcupados.has(chaveMes(m)))
      : undefined

  // Atraso automático: prazo = dia 10 a seguir ao último mês do pagamento anterior.
  const anterior = primeiro
    ? fimPorMes.filter((m) => m < primeiro).sort((a, b) => b.getTime() - a.getTime())[0]
    : undefined
  const prazo = anterior ? limiteRenovacao(anterior) : null
  const diaPago = dataPagamento ? new Date(`${dataPagamento}T00:00:00`) : null
  const diasAtraso = prazo && diaPago && diaPago > prazo ? Math.round((diaPago.getTime() - prazo.getTime()) / 86_400_000) : 0

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <RoveFormLabel required>Primeiro mês pago</RoveFormLabel>
          <RoveSelect compact required value={mesInicial} onChange={(e) => onChange({ mesInicial: e.target.value })}>
            {opcoesMes.map((o) => (
              <option key={o.chave} value={o.chave}>
                {o.label}
              </option>
            ))}
          </RoveSelect>
        </div>
        <div>
          <RoveFormLabel required>Meses pagos</RoveFormLabel>
          <RoveSelect
            compact
            required
            value={meses === '' ? '' : String(meses)}
            onChange={(e) => onChange({ meses: e.target.value === '' ? '' : Number(e.target.value) })}
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
          <RoveFormLabel>Data em que pagou</RoveFormLabel>
          <RoveDatePicker compact allowPastDates value={dataPagamento} onChange={(v) => onChange({ dataPagamento: v })} />
        </div>
        <div>
          <RoveFormLabel>Valor pago (kz)</RoveFormLabel>
          <input
            type="number"
            min={0}
            step="0.01"
            value={valorTotal}
            onChange={(e) => onChange({ valorEditado: true, valorTotal: e.target.value })}
            placeholder="Mensalidade × meses"
            className={inputClass}
          />
        </div>
        <div>
          <RoveFormLabel>Método</RoveFormLabel>
          <RoveSelect compact value={metodo} onChange={(e) => onChange({ metodo: e.target.value })} placeholder="(opcional)">
            <option value="">(opcional)</option>
            {METODOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </RoveSelect>
        </div>
        <div>
          <RoveFormLabel>Atraso</RoveFormLabel>
          <RoveSelect compact value={atraso} onChange={(e) => onChange({ atraso: e.target.value as AtrasoEscolha })}>
            <option value="auto">Automático{diasAtraso > 0 ? ` (com atraso)` : ' (sem atraso)'}</option>
            <option value="sim">Com atraso</option>
            <option value="nao">Sem atraso</option>
          </RoveSelect>
        </div>
      </div>
      <input
        type="text"
        value={observacoes}
        onChange={(e) => onChange({ observacoes: e.target.value })}
        placeholder="Observações (opcional)"
        className={inputClass}
      />
      {primeiro && ultimo && (
        <p className="text-xs text-gray-400">
          Cobre <span className="text-white">{nomeMes(primeiro)}</span>
          {meses !== 1 && (
            <>
              {' '}até <span className="text-white">{nomeMes(ultimo)}</span>
            </>
          )}
          . Próxima renovação até{' '}
          <span className="text-green-300 font-medium">{limiteRenovacao(ultimo).toLocaleDateString('pt-PT')}</span>.{' '}
          {prazo ? (
            diasAtraso > 0 ? (
              <span className="text-amber-300">
                Prazo era {prazo.toLocaleDateString('pt-PT')}: {diasAtraso} dia{diasAtraso === 1 ? '' : 's'} de atraso.
              </span>
            ) : (
              <span>Dentro do prazo ({prazo.toLocaleDateString('pt-PT')}).</span>
            )
          ) : (
            <span>Primeiro pagamento: sem prazo anterior.</span>
          )}
        </p>
      )}
      {conflito && (
        <p className="text-xs text-red-300 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> {nomeMes(conflito)} já está pago noutro pagamento.
        </p>
      )}
    </>
  )
}

function formInvalido(v: FormValues, mesesOcupados: Set<string>) {
  if (v.meses === '' || !v.mesInicial) return true
  const primeiro = mesDaChave(v.mesInicial)
  return Array.from({ length: v.meses }, (_, i) => somarMeses(primeiro, i)).some((m) => mesesOcupados.has(chaveMes(m)))
}

function formBody(v: FormValues) {
  return {
    // Dia 15 evita que o fuso horário mude o mês ao converter para UTC.
    mesInicial: `${v.mesInicial}-15`,
    meses: v.meses,
    valorTotal: v.valorTotal === '' ? undefined : Number(v.valorTotal),
    dataPagamento: v.dataPagamento,
    metodo: v.metodo || null,
    observacoes: v.observacoes.trim() || null,
    atrasoManual: atrasoBody(v.atraso),
  }
}

// ----------------------------------------------------------------------------------------------

export function PagamentosClienteModal({
  client,
  canManage,
  onClose,
  onChanged,
}: {
  client: PagamentosClienteAlvo
  /** Admin / financeiro podem editar ou anular um pagamento já registado. */
  canManage: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { showError, showInfo } = useAlert()
  const [data, setData] = useState<PagamentosResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { busy, run } = useBusy()
  const [confirmDelete, setConfirmDelete] = useState<Pagamento | null>(null)
  const [editing, setEditing] = useState<{ pagamento: Pagamento; values: FormValues } | null>(null)
  const [form, setForm] = useState<FormValues>({
    mesInicial: '',
    meses: '',
    valorTotal: '',
    valorEditado: false,
    dataPagamento: todayIso(),
    metodo: '',
    observacoes: '',
    atraso: 'auto',
  })

  function load() {
    setLoading(true)
    api
      .get<PagamentosResponse>(`/api/clients/${client.id}/pagamentos`)
      .then((r) => {
        setData(r)
        setForm((f) => (f.mesInicial ? f : { ...f, mesInicial: chaveMes(new Date(r.resumo.proximoMes)) }))
      })
      .catch((e) => showError(e instanceof Error ? e.message : 'Erro ao carregar pagamentos'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [client.id])

  // Mês → pagamento que o cobre.
  const pagamentoPorMes = useMemo(() => {
    const m = new Map<string, Pagamento>()
    data?.pagamentos.forEach((p) => p.periodos.forEach((x) => m.set(chaveMes(new Date(x.mes)), p)))
    return m
  }, [data])

  // Grelha: do primeiro mês pago até ao mês atual ou ao último mês pago (o que for mais tarde).
  const grelha = useMemo(() => {
    const atual = new Date()
    const mesAtual = new Date(atual.getFullYear(), atual.getMonth(), 1)
    const chaves = [...pagamentoPorMes.keys()].sort()
    const inicio = chaves.length ? mesDaChave(chaves[0]) : mesAtual
    const ultimoPago = chaves.length ? mesDaChave(chaves[chaves.length - 1]) : mesAtual
    const fim = ultimoPago > mesAtual ? ultimoPago : mesAtual
    const out: { chave: string; mes: Date; estado: EstadoMes; pagamento?: Pagamento }[] = []
    for (let m = inicio; m <= fim; m = somarMeses(m, 1)) {
      const chave = chaveMes(m)
      const p = pagamentoPorMes.get(chave)
      const estado: EstadoMes = p ? (p.atraso ? 'pago_atraso' : 'pago') : m < mesAtual ? 'nao_pago' : 'por_pagar'
      out.push({ chave, mes: m, estado, pagamento: p })
    }
    return out
  }, [pagamentoPorMes])

  /** Opções de "primeiro mês": meses em falta da grelha + próximos 12 meses, sem os já pagos (exceto `incluir`). */
  function opcoesMes(ocupados: Set<string>, incluir?: string) {
    const atual = new Date()
    const base = grelha.length ? grelha[0].mes : new Date(atual.getFullYear(), atual.getMonth(), 1)
    const ate = somarMeses(new Date(atual.getFullYear(), atual.getMonth(), 1), 12)
    const out: { chave: string; label: string }[] = []
    for (let m = somarMeses(base, -12); m <= ate; m = somarMeses(m, 1)) {
      const chave = chaveMes(m)
      if (ocupados.has(chave) && chave !== incluir) continue
      const naoPago = grelha.find((g) => g.chave === chave)?.estado === 'nao_pago'
      out.push({ chave, label: `${nomeMes(m)}${naoPago ? ' (não pago)' : ''}` })
    }
    return out
  }

  const ocupadosTodos = useMemo(() => new Set(pagamentoPorMes.keys()), [pagamentoPorMes])

  function ocupadosSem(pagamentoId: number) {
    return new Set([...pagamentoPorMes].filter(([, p]) => p.id !== pagamentoId).map(([k]) => k))
  }

  function fimPorMesSem(pagamentoId?: number) {
    return (data?.pagamentos ?? [])
      .filter((p) => p.id !== pagamentoId && p.periodos.length)
      .map((p) => new Date(p.periodos[p.periodos.length - 1].mes))
  }

  async function registar() {
    if (formInvalido(form, ocupadosTodos)) return
    setSaving(true)
    try {
      await api.post(`/api/clients/${client.id}/pagamentos`, formBody(form))
      showInfo(`Pagamento de ${mesesPagamentoLabel(form.meses as number)} registado para ${client.nome}.`)
      setForm({
        mesInicial: '',
        meses: '',
        valorTotal: '',
        valorEditado: false,
        dataPagamento: todayIso(),
        metodo: '',
        observacoes: '',
        atraso: 'auto',
      })
      load()
      onChanged()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao registar pagamento')
    } finally {
      setSaving(false)
    }
  }

  function abrirEdicao(p: Pagamento) {
    setEditing({
      pagamento: p,
      values: {
        mesInicial: p.periodos.length ? chaveMes(new Date(p.periodos[0].mes)) : chaveMes(new Date(p.dataPagamento)),
        meses: p.meses,
        valorTotal: String(p.valorTotal),
        valorEditado: true,
        dataPagamento: toIso(new Date(p.dataPagamento)),
        metodo: p.metodo ?? '',
        observacoes: p.observacoes ?? '',
        atraso: atrasoEscolha(p),
      },
    })
  }

  async function guardarEdicao() {
    if (!editing) return
    try {
      const r = await api.patch<PagamentosResponse>(
        `/api/clients/${client.id}/pagamentos/${editing.pagamento.id}`,
        formBody(editing.values)
      )
      setData(r)
      setEditing(null)
      showInfo('Pagamento atualizado.')
      onChanged()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao editar pagamento')
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

  function selecionarMes(chave: string) {
    setForm((f) => ({ ...f, mesInicial: chave, meses: f.meses === '' ? 1 : f.meses }))
  }

  const resumo = data?.resumo
  const mesesNaoPagos = grelha.filter((g) => g.estado === 'nao_pago').length

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
                { label: 'Meses não pagos', value: String(mesesNaoPagos) },
                { label: 'Pagos com atraso', value: String(resumo.pagamentosEmAtraso) },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-netflix-border/80 bg-netflix-panel/60 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">{s.label}</p>
                  <p className="text-sm font-semibold text-white tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Meses: pago / pago com atraso / não pago */}
          {data && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Meses</p>
                <p className="text-[11px] text-gray-500">Total pago {formatKz(data.resumo.totalPago)}</p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {grelha.map((g) => {
                  const ui = estadoMesUi[g.estado]
                  const clicavel = !g.pagamento
                  const selecionado = form.mesInicial === g.chave
                  return (
                    <button
                      key={g.chave}
                      type="button"
                      disabled={!clicavel}
                      onClick={() => selecionarMes(g.chave)}
                      title={
                        g.pagamento
                          ? `${ui.label} a ${formatDate(g.pagamento.dataPagamento)}${
                              g.pagamento.diasAtraso > 0 ? ` (${g.pagamento.diasAtraso} dias depois do prazo)` : ''
                            }`
                          : `${ui.label} — clique para registar`
                      }
                      className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${ui.className} ${
                        selecionado ? 'ring-2 ring-green-400' : ''
                      } ${clicavel ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <p className="text-[11px] font-medium capitalize">{nomeMesCurto(g.mes)}</p>
                      <p className="text-[10px] opacity-80">{ui.label}</p>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-gray-500">Clique num mês não pago para o registar.</p>
            </div>
          )}

          {/* Registar novo pagamento */}
          <div className="rounded-xl border border-green-500/25 bg-green-950/10 p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-green-300/80">Registar pagamento</p>
            <PagamentoCampos
              values={form}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              mensalidade={Number(client.valor)}
              mesesOcupados={ocupadosTodos}
              opcoesMes={opcoesMes(ocupadosTodos)}
              fimPorMes={fimPorMesSem()}
            />
            <p className="text-[11px] text-gray-500">
              Regra: cada pagamento cobre meses de calendário. A renovação faz-se do dia 1 ao dia 10 do mês seguinte; depois
              disso o pagamento conta como atrasado (pode marcar manualmente).
            </p>
            <div className="flex justify-end">
              <LoadingButton
                onClick={registar}
                loading={saving}
                disabled={formInvalido(form, ocupadosTodos)}
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
                    <p className="mt-1">
                      {p.atraso ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-300">
                          <AlertTriangle className="w-3 h-3" />
                          Com atraso
                          {p.diasAtraso > 0 ? ` · ${p.diasAtraso} dia${p.diasAtraso === 1 ? '' : 's'}` : ''}
                          {p.atrasoManual != null ? ' · marcado pelo gestor' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[11px] text-green-300">
                          <CheckCircle className="w-3 h-3" />
                          Dentro do prazo{p.atrasoManual != null ? ' · marcado pelo gestor' : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(p)}
                        title="Editar pagamento"
                        className="p-1.5 rounded-lg border border-netflix-border text-gray-300 hover:bg-netflix-hover"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(p)}
                        title="Anular pagamento"
                        className="p-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

      {editing && (
        <RoveModalOverlay zIndex={60} dimClassName="bg-black/70">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-green-500/30 max-w-xl w-full p-5 space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-white">Editar pagamento</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Alterar os meses refaz os meses cobertos e recalcula a data de renovação do cliente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-netflix-hover"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <PagamentoCampos
              values={editing.values}
              onChange={(patch) => setEditing((e) => (e ? { ...e, values: { ...e.values, ...patch } } : e))}
              mensalidade={Number(client.valor)}
              mesesOcupados={ocupadosSem(editing.pagamento.id)}
              opcoesMes={opcoesMes(ocupadosSem(editing.pagamento.id), editing.values.mesInicial)}
              fimPorMes={fimPorMesSem(editing.pagamento.id)}
            />
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover"
              >
                Cancelar
              </button>
              <LoadingButton
                onClick={() => run('editar', guardarEdicao)}
                loading={busy === 'editar'}
                disabled={formInvalido(editing.values, ocupadosSem(editing.pagamento.id))}
                className="flex-1 py-2.5 px-4 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Guardar
              </LoadingButton>
            </div>
          </div>
        </RoveModalOverlay>
      )}

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
