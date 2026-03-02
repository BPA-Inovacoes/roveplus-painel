import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Filter } from 'lucide-react'
import { api } from '../api/client'
import { tratamentoNome } from '../utils/tratamento'

interface LogEntry {
  id: number
  action: string
  entity: string
  entityId: number | null
  details: string | null
  createdAt: string
  user: { id: number; nome: string; email: string }
}

interface UserOption {
  id: number
  nome: string
  email: string
}

const ENTIDADES = [
  { value: '', label: 'Todas as entidades' },
  { value: 'client', label: 'Cliente' },
  { value: 'servidor', label: 'Servidor' },
  { value: 'revendedor', label: 'Revendedor' },
  { value: 'sala', label: 'Sala' },
  { value: 'indicacao', label: 'Indicação' },
]

const ACOES = [
  { value: '', label: 'Todas as ações' },
  { value: 'create_client', label: 'Criar cliente' },
  { value: 'update_client', label: 'Atualizar cliente' },
  { value: 'renew_client', label: 'Renovar cliente' },
  { value: 'suspend_client', label: 'Suspender cliente' },
  { value: 'activate_client', label: 'Ativar cliente' },
  { value: 'delete_client', label: 'Eliminar cliente' },
  { value: 'create_servidor', label: 'Criar servidor' },
  { value: 'update_servidor', label: 'Atualizar servidor' },
  { value: 'delete_servidor', label: 'Eliminar servidor' },
  { value: 'create_revendedor', label: 'Criar revendedor' },
  { value: 'update_revendedor', label: 'Atualizar revendedor' },
  { value: 'suspend_revendedor', label: 'Suspender revendedor' },
  { value: 'activate_revendedor', label: 'Ativar revendedor' },
  { value: 'delete_revendedor', label: 'Eliminar revendedor' },
  { value: 'create_sala', label: 'Criar sala' },
  { value: 'update_sala', label: 'Atualizar sala' },
  { value: 'suspend_sala', label: 'Suspender sala' },
  { value: 'activate_sala', label: 'Ativar sala' },
  { value: 'delete_sala', label: 'Eliminar sala' },
  { value: 'create_indicacao', label: 'Criar indicação' },
  { value: 'update_indicacao', label: 'Atualizar indicação' },
  { value: 'delete_indicacao', label: 'Eliminar indicação' },
]

export default function Audit() {
  const [list, setList] = useState<LogEntry[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    entity: '',
    action: '',
    userId: '',
    from: '',
    to: '',
  })

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '200')
    if (filters.entity) params.set('entity', filters.entity)
    if (filters.action) params.set('action', filters.action)
    if (filters.userId) params.set('userId', filters.userId)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    api
      .get<LogEntry[]>(`/api/audit?${params.toString()}`)
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [filters])

  useEffect(() => {
    api.get<UserOption[]>('/api/users').then(setUsers).catch(() => setUsers([]))
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Log de alterações
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Registo de ações no painel. Filtre por entidade, ação, utilizador ou período.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-netflix-card/60 border border-netflix-border/80">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        <select
          value={filters.entity}
          onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value }))}
          className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
        >
          {ENTIDADES.map((o) => (
            <option key={o.value || 'all'} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none min-w-[11rem]"
        >
          {ACOES.map((o) => (
            <option key={o.value || 'all'} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={filters.userId}
          onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
          className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none min-w-[10rem]"
        >
          <option value="">Todos os utilizadores</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
          title="Data de"
        />
        <span className="text-gray-500 text-sm">até</span>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
          title="Data até"
        />
        <button
          type="button"
          onClick={() => setFilters({ entity: '', action: '', userId: '', from: '', to: '' })}
          className="py-2 px-3 rounded-lg border border-netflix-border text-gray-300 text-sm hover:bg-netflix-hover transition-colors"
        >
          Limpar filtros
        </button>
      </div>

      <div className="bg-netflix-card rounded-xl shadow border border-netflix-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">A carregar...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-netflix-panel text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium w-12 text-center">Nº</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Utilizador</th>
                  <th className="px-4 py-3 font-medium">Ação</th>
                  <th className="px-4 py-3 font-medium">Entidade</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {list.map((entry, idx) => (
                  <tr key={entry.id} className="border-t border-netflix-border hover:bg-netflix-hover">
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{idx + 1}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{tratamentoNome(entry.user.nome)}</span>
                      <span className="text-gray-500 text-xs block">{entry.user.email}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{entry.action}</td>
                    <td className="px-4 py-3 text-gray-400">{entry.entity}</td>
                    <td className="px-4 py-3 text-gray-500">{entry.entityId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && list.length === 0 && (
          <div className="p-8 text-center text-gray-400">Nenhum registo no log.</div>
        )}
      </div>
    </motion.div>
  )
}
