import { LayoutGrid, Tv } from 'lucide-react'
import { PLANOS_NETFLIX, SALA_CUSTO_MENSAL } from '../../lib/planos'

export function FinanceiroPlanos() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 p-5">
        <h3 className="text-base font-semibold text-white mb-1">Tabela de preços</h3>
        <p className="text-sm text-gray-400">
          Valores de referência usados ao criar clientes no painel (kz). Alterações em clientes individuais fazem-se em Clientes.
        </p>
      </div>

      <div className="rounded-xl border border-primary-600/40 bg-primary-900/20 overflow-hidden">
        <div className="p-5 border-b border-primary-600/30 flex items-center gap-2">
          <Tv className="w-5 h-5 text-primary-400" />
          <h4 className="font-semibold text-white">Netflix</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-netflix-border/60">
              <th className="text-left py-2 px-4">Plano</th>
              <th className="text-right py-2 px-4">Inscrição</th>
              <th className="text-right py-2 px-4">Mensalidade</th>
            </tr>
          </thead>
          <tbody>
            {PLANOS_NETFLIX.map((p) => (
              <tr key={p.id} className="border-b border-netflix-border/40">
                <td className="py-3 px-4 text-white">{p.label}</td>
                <td className="py-3 px-4 text-right text-amber-300">
                  {p.inscricao.toLocaleString('pt-PT')} kz
                </td>
                <td className="py-3 px-4 text-right font-medium text-white">{p.valor.toLocaleString('pt-PT')} kz</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-emerald-600/40 bg-emerald-900/20 overflow-hidden">
        <div className="p-5 border-b border-emerald-600/30 flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-emerald-400" />
          <h4 className="font-semibold text-white">Custo das salas (contas Netflix)</h4>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-netflix-border/40">
              <td className="py-3 px-4 text-white">Custo por sala / mês</td>
              <td className="py-3 px-4 text-right font-medium text-white">{SALA_CUSTO_MENSAL.toLocaleString('pt-PT')} kz</td>
            </tr>
            <tr>
              <td className="py-3 px-4 text-white">Orçamento mensal</td>
              <td className="py-3 px-4 text-right text-emerald-300">
                Nº de salas ativas × {SALA_CUSTO_MENSAL.toLocaleString('pt-PT')} kz
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
