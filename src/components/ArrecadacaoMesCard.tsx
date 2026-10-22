import { AlertTriangle, CheckCircle2, Target, TrendingDown, TrendingUp } from 'lucide-react'

export interface ArrecadacaoMes {
  mes: string
  /** Soma das mensalidades dos clientes ativos + vencidos. */
  previsto: number
  previstoClientes: number
  /** Pagamentos registados no painel com data deste mês. */
  arrecadado: number
  pagamentos: number
  /** Mensalidades dos clientes que ainda não pagaram o mês atual. */
  porArrecadar: number
  clientesPorPagar: number
  lucroPrevisto: number
}

function kz(n: number) {
  return `${Number(n).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} kz`
}

export function ArrecadacaoMesCard({
  data,
  custoSalas,
  onVerPorPagar,
}: {
  data: ArrecadacaoMes
  /** Quando indicado, mostra também o orçamento das salas e o lucro previsto. */
  custoSalas?: number
  onVerPorPagar?: () => void
}) {
  const pct = data.previsto > 0 ? Math.min(100, Math.round((data.arrecadado / data.previsto) * 100)) : 0
  const lucroPositivo = data.lucroPrevisto >= 0

  return (
    <div className="rounded-xl border border-white/10 bg-netflix-card p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-viz-muted flex items-center gap-1.5">
            <Target className="w-4 h-4" />
            Previsto a arrecadar · <span className="normal-case">{data.mes}</span>
          </p>
          <p className="text-4xl font-semibold text-viz-ink mt-2">{kz(data.previsto)}</p>
          <p className="text-xs text-viz-muted mt-1">
            Mensalidades de {data.previstoClientes} cliente(s) — ativos e vencidos
          </p>
        </div>
        {custoSalas != null && (
          <div className="sm:text-right rounded-lg bg-white/[0.03] border border-white/5 px-4 py-3">
            <p className="text-xs text-viz-muted">Orçamento das salas: {kz(custoSalas)}</p>
            <p className="text-xs text-viz-muted mt-1">Lucro previsto</p>
            <p
              className={`text-xl font-semibold inline-flex items-center gap-1.5 ${
                lucroPositivo ? 'text-viz-good' : 'text-viz-critical'
              }`}
            >
              {lucroPositivo ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {kz(data.lucroPrevisto)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-viz-muted mb-1.5">
          <span>Progresso do mês</span>
          <span className="text-viz-ink-2 font-medium">{pct}%</span>
        </div>
        <div
          className="h-2 rounded-full bg-white/5 overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Percentagem já arrecadada"
        >
          <div className="h-full rounded-full bg-viz-series transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-viz-muted flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-viz-good" />
              Já arrecadado
            </p>
            <p className="text-lg font-semibold text-viz-ink mt-0.5">{kz(data.arrecadado)}</p>
            <p className="text-[11px] text-viz-muted">{data.pagamentos} pagamento(s) registado(s) este mês</p>
          </div>
          <button
            type="button"
            onClick={onVerPorPagar}
            disabled={!onVerPorPagar}
            className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-left enabled:hover:border-white/20 transition-colors"
          >
            <p className="text-xs text-viz-muted flex items-center gap-1.5">
              <AlertTriangle className={`w-3.5 h-3.5 ${data.clientesPorPagar > 0 ? 'text-viz-warning' : 'text-viz-muted'}`} />
              Falta arrecadar
            </p>
            <p className="text-lg font-semibold text-viz-ink mt-0.5">{kz(data.porArrecadar)}</p>
            <p className="text-[11px] text-viz-muted">
              {data.clientesPorPagar} cliente(s) ainda não pagaram este mês (renovação até dia 10)
              {onVerPorPagar ? ' →' : ''}
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
