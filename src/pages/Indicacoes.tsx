import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Gift, User, Check, Edit2, Trash2, RotateCcw } from 'lucide-react'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'
import { TablePagination, ROWS_PER_PAGE } from '../components/TablePagination'

interface Indicacao {
  id: number
  indicadorId: number
  indicadoNome: string
  indicadoWhatsapp: string
  status: string
  createdAt: string
  indicador: { id: number; nome: string; whatsapp: string }
}

interface Client {
  id: number
  nome: string
}

export default function Indicacoes() {
  const { showError, showWarning } = useAlert()
  const [list, setList] = useState<Indicacao[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [indicacaoToDelete, setIndicacaoToDelete] = useState<Indicacao | null>(null)
  const [form, setForm] = useState({ id: 0, indicadorId: '', indicadoNome: '', indicadoWhatsapp: '', status: 'pendente' })
  const [tablePage, setTablePage] = useState(1)

  function load() {
    setLoading(true)
    api
      .get<Indicacao[]>('/api/indicacoes')
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    api.get<Client[]>('/api/clients').then((c) => setClients(c)).catch(() => setClients([]))
  }, [])

  const filtered =
    filter === ''
      ? list
      : list.filter((i) => i.status === filter)

  const totalTablePages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const tablePageClamped = Math.min(tablePage, totalTablePages)
  const pagedIndicacoes = filtered.slice((tablePageClamped - 1) * ROWS_PER_PAGE, tablePageClamped * ROWS_PER_PAGE)

  const stats = {
    total: filtered.length,
    pendentes: filtered.filter((i) => i.status === 'pendente').length,
    confirmadas: filtered.filter((i) => i.status === 'confirmada').length,
  }

  async function save() {
    const nome = (form.indicadoNome ?? '').trim()
    const whatsapp = (form.indicadoWhatsapp ?? '').trim()
    const isEdit = !!form.id
    if (!isEdit && !form.indicadorId) {
      showWarning('Selecione o cliente que indicou.')
      return
    }
    if (!nome) {
      showWarning('Nome do indicado é obrigatório.')
      return
    }
    try {
      if (isEdit) {
        await api.patch(`/api/indicacoes/${form.id}`, {
          indicadoNome: nome,
          indicadoWhatsapp: whatsapp,
          status: form.status || 'pendente',
        })
      } else {
        await api.post('/api/indicacoes', {
          indicadorId: form.indicadorId,
          indicadoNome: nome,
          indicadoWhatsapp: whatsapp || undefined,
        })
      }
      setModal(null)
      setForm({ id: 0, indicadorId: '', indicadoNome: '', indicadoWhatsapp: '', status: 'pendente' })
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao guardar')
    }
  }

  async function updateStatus(id: number, status: string) {
    try {
      await api.patch(`/api/indicacoes/${id}`, { status })
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function confirmarExcluir() {
    if (!indicacaoToDelete) return
    try {
      await api.delete(`/api/indicacoes/${indicacaoToDelete.id}`)
      setIndicacaoToDelete(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao excluir')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Header com título, descrição, estatísticas e botão */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Gift className="w-6 h-6" />
            Indicações
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Gestão de indicações de clientes. Acompanhe quem indicou, quem foi indicado e o estado.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-netflix-panel/80 border border-netflix-border/60 text-gray-300 text-sm">
              <span className="font-semibold text-white">{stats.total}</span> total
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-300 text-sm">
              <span className="font-semibold">{stats.pendentes}</span> pendentes
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300 text-sm">
              <span className="font-semibold">{stats.confirmadas}</span> confirmadas
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm({ id: 0, indicadorId: '', indicadoNome: '', indicadoWhatsapp: '', status: 'pendente' })
              setModal('new')
            }}
            className="flex items-center gap-2 py-2.5 px-5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-medium shadow-lg shadow-primary-900/30 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nova indicação
          </button>
        </div>
      </div>

      {/* Filtro de estado */}
      <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl bg-netflix-card/60 border border-netflix-border/80">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-netflix-border bg-netflix-panel text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
        >
          <option value="">Todos os estados</option>
          <option value="pendente">Pendentes</option>
          <option value="confirmada">Confirmadas</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 shadow-lg shadow-black/40 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
            <span className="text-sm">A carregar indicações...</span>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-netflix-panel/80 text-gray-300 text-sm">
                <tr>
                  <th className="px-4 py-3.5 font-medium w-12 text-center">Nº</th>
                  <th className="px-4 py-3.5 font-medium">Indicado</th>
                  <th className="px-4 py-3.5 font-medium">WhatsApp indicado</th>
                  <th className="px-4 py-3.5 font-medium">Quem indicou</th>
                  <th className="px-4 py-3.5 font-medium">Data</th>
                  <th className="px-4 py-3.5 font-medium">Estado</th>
                  <th className="px-4 py-3.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-netflix-border/80 text-gray-200">
                {pagedIndicacoes.map((i, idx) => (
                  <tr key={i.id} className="hover:bg-netflix-hover/80 transition-colors">
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{(tablePageClamped - 1) * ROWS_PER_PAGE + idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{i.indicadoNome}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{i.indicadoWhatsapp}</td>
                    <td className="px-4 py-3">
                      <span className="text-gray-200 text-sm">{i.indicador.nome}</span>
                      <span className="text-gray-500 text-xs block">{i.indicador.whatsapp}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(i.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          i.status === 'confirmada'
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-amber-900/50 text-amber-300'
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {i.status === 'pendente' && (
                          <button
                            type="button"
                            onClick={() => updateStatus(i.id, 'confirmada')}
                            title="Confirmar indicação"
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-primary-500/60 bg-primary-500/10 text-primary-300 hover:bg-primary-500/30 hover:text-white shadow-sm shadow-primary-900/40 transition-colors text-xs font-medium"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {i.status === 'confirmada' && (
                          <button
                            type="button"
                            onClick={() => updateStatus(i.id, 'pendente')}
                            title="Reverter para pendente"
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/30 hover:text-white shadow-sm shadow-amber-900/40 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              id: i.id,
                              indicadorId: String(i.indicadorId),
                              indicadoNome: i.indicadoNome,
                              indicadoWhatsapp: i.indicadoWhatsapp,
                              status: i.status,
                            })
                            setModal('edit')
                          }}
                          title="Editar"
                          className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-primary-500/50 bg-primary-500/10 text-primary-300 hover:bg-primary-500/30 hover:text-white shadow-sm shadow-primary-900/40 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIndicacaoToDelete(i)}
                          title="Excluir"
                          className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-red-500/60 bg-red-500/15 text-red-300 hover:bg-red-500/30 hover:text-white shadow-sm shadow-red-900/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination totalItems={filtered.length} currentPage={tablePageClamped} onPageChange={setTablePage} />
          </>
        )}
        {!loading && filtered.length === 0 && (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
            <Gift className="w-10 h-10 text-gray-500" />
            Nenhuma indicação encontrada.
          </div>
        )}
      </div>

      {/* Modal confirmar excluir indicação */}
      {indicacaoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-red-500/40 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Excluir indicação</h3>
                  <div className="h-1 w-12 bg-red-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm text-gray-300">
                Tem a certeza que deseja excluir a indicação de <span className="font-medium text-white">{indicacaoToDelete.indicadoNome}</span>?
              </p>
              <p className="text-xs text-gray-500">O contador de indicações do cliente que indicou será atualizado.</p>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setIndicacaoToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExcluir}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-900/30"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova / editar indicação */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-netflix-border max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-netflix-border/80 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-400" />
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {modal === 'edit' ? 'Editar indicação' : 'Nova indicação'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modal === 'edit' ? 'Altere os dados do indicado ou o estado.' : 'Registe um novo cliente indicado.'}
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {modal === 'edit' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-0.5">Quem indicou (cliente)</label>
                  <p className="px-3 py-2 bg-netflix-panel/50 border border-netflix-border rounded-lg text-sm text-gray-300">
                    {clients.find((c) => String(c.id) === form.indicadorId)?.nome ?? '—'}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-0.5">Quem indicou (cliente)</label>
                  <select
                    value={form.indicadorId}
                    onChange={(e) => setForm((f) => ({ ...f, indicadorId: e.target.value }))}
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  >
                    <option value="">Selecione o cliente</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Nome do indicado</label>
                <input
                  type="text"
                  value={form.indicadoNome}
                  onChange={(e) => setForm((f) => ({ ...f, indicadoNome: e.target.value }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  placeholder="Nome da pessoa indicada"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">WhatsApp do indicado</label>
                <input
                  type="text"
                  value={form.indicadoWhatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, indicadoWhatsapp: e.target.value }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  placeholder="244 9XX XXX XXX"
                />
              </div>
              {modal === 'edit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-0.5">Estado</label>
                  <select
                    value={form.status || 'pendente'}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="confirmada">Confirmada</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => { setModal(null); setForm({ id: 0, indicadorId: '', indicadoNome: '', indicadoWhatsapp: '', status: 'pendente' }) }}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-900/30"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
