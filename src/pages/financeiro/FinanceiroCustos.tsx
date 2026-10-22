import { useState } from 'react'
import { LayoutGrid, RefreshCw } from 'lucide-react'
import { FinanceiroActionBtn } from './FinanceiroActionBtn'
import { FinanceiroConfirmModal } from './FinanceiroConfirmModal'
import { api } from '../../api/client'
import { useAlert } from '../../contexts/AlertContext'
import { TablePagination, ROWS_PER_PAGE } from '../../components/TablePagination'
import type { SalaFinanceira } from './types'
import { SALA_CUSTO_MENSAL } from '../../lib/planos'

function daysUntilSala(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export function FinanceiroCustos({
  salas,
  onReloadSalas,
  onReloadDashboard,
}: {
  salas: SalaFinanceira[]
  onReloadSalas: () => Promise<void>
  onReloadDashboard?: () => Promise<void>
}) {
  const { showError, showInfo } = useAlert()
  const [salaTablePage, setSalaTablePage] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [salaToPagar, setSalaToPagar] = useState<SalaFinanceira | null>(null)
  const salasAtivas = salas.filter((s) => s.status === 'ativo').length

  async function confirmarPagarSala() {
    if (!salaToPagar) return
    setSubmitting(true)
    try {
      await api.post(`/api/salas/${salaToPagar.id}/pagar-mes`, {})
      showInfo(`Sala "${salaToPagar.nome}" renovada por +1 mês.`)
      setSalaToPagar(null)
      await onReloadSalas()
      await onReloadDashboard?.()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao renovar sala')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 overflow-hidden">
        <div className="p-6 pb-0">
          <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary-400" />
            Salas Netflix (renovação de contas)
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Renove as contas Netflix por sala (+1 mês). Orçamento mensal: {salasAtivas} sala(s) ativa(s) ×{' '}
            {SALA_CUSTO_MENSAL.toLocaleString('pt-PT')} kz ={' '}
            <span className="font-semibold text-white">{(salasAtivas * SALA_CUSTO_MENSAL).toLocaleString('pt-PT')} kz</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-netflix-border">
                <th className="text-left py-2 px-3">Sala</th>
                <th className="text-right py-2 px-3">Clientes</th>
                <th className="text-left py-2 px-3">Data renovação</th>
                <th className="text-left py-2 px-3">Estado</th>
                <th className="text-right py-2 px-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const totalPages = Math.max(1, Math.ceil(salas.length / ROWS_PER_PAGE))
                const page = Math.min(salaTablePage, totalPages)
                return salas.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE).map((s) => {
                  const days = daysUntilSala(s.dataFim)
                  const urgent = days !== null && days <= 3 && days >= 0
                  const exp = days !== null && days < 0
                  return (
                    <tr key={s.id} className="border-b border-netflix-border/60">
                      <td className="py-2 px-3 text-white">{s.nome}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{s.totalClientes}</td>
                      <td className="py-2 px-3">
                        <span className={exp ? 'text-red-400' : urgent ? 'text-amber-300' : 'text-gray-300'}>
                          {s.dataFim ? new Date(s.dataFim).toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs ${
                            s.status === 'ativo' ? 'bg-green-900/50 text-green-300' : 'bg-amber-900/50 text-amber-300'
                          }`}
                        >
                          {s.status === 'ativo' ? 'Ativo' : 'Suspenso'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <FinanceiroActionBtn
                          icon={RefreshCw}
                          label="+1 mês"
                          variant="emerald"
                          onClick={() => setSalaToPagar(s)}
                        />
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalItems={salas.length}
          currentPage={Math.min(salaTablePage, Math.max(1, Math.ceil(salas.length / ROWS_PER_PAGE)))}
          onPageChange={setSalaTablePage}
        />
      </div>

      <FinanceiroConfirmModal
        open={!!salaToPagar}
        onClose={() => !submitting && setSalaToPagar(null)}
        onConfirm={confirmarPagarSala}
        icon={LayoutGrid}
        variant="primary"
        title="Renovar sala Netflix"
        subtitle={
          salaToPagar ? (
            <>
              Sala <span className="text-white font-medium">{salaToPagar.nome}</span>
            </>
          ) : undefined
        }
        description={`Adiciona 1 mês à data de renovação da conta Netflix desta sala e regista o pagamento de ${SALA_CUSTO_MENSAL.toLocaleString('pt-PT')} kz.`}
        detail="A data fim de cada cliente não muda: depende dos meses que cada um pagou."
        confirmLabel="Renovar +1 mês"
        loading={submitting}
      />
    </div>
  )
}
