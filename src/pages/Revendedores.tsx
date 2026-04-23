import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, Store, AlertTriangle, CheckCircle } from 'lucide-react'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'
import { TablePagination, ROWS_PER_PAGE } from '../components/TablePagination'

interface Servidor {
  id: number
  nome: string
  tipo?: string
}

interface Revendedor {
  id: number
  nome: string
  contacto: string
  servidorId: number | null
  servidor: Servidor | null
  observacoes: string | null
  status: string
  totalClientes: number
}

export default function Revendedores() {
  const { showError, showWarning } = useAlert()
  const [list, setList] = useState<Revendedor[]>([])
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [revendedorSuspender, setRevendedorSuspender] = useState<Revendedor | null>(null)
  const [revendedorAtivar, setRevendedorAtivar] = useState<Revendedor | null>(null)
  const [form, setForm] = useState<Partial<Revendedor>>({
    nome: '',
    contacto: '',
    servidorId: null,
    observacoes: '',
  })
  const [tablePage, setTablePage] = useState(1)
  const servidoresPrincipais = servidores.filter((s) => (s.tipo || 'principal') === 'principal')

  const totalTablePages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE))
  const tablePageClamped = Math.min(tablePage, totalTablePages)
  const pagedList = list.slice((tablePageClamped - 1) * ROWS_PER_PAGE, tablePageClamped * ROWS_PER_PAGE)

  function load() {
    setLoading(true)
    Promise.all([
      api.get<Revendedor[]>('/api/revendedores'),
      api.get<Servidor[]>('/api/servidores'),
    ])
      .then(([rev, serv]) => {
        setList(Array.isArray(rev) ? rev : [])
        setServidores(Array.isArray(serv) ? serv : [])
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    if (!form.nome || !form.contacto) {
      showWarning('Nome e contacto são obrigatórios.')
      return
    }
    if (!form.servidorId) {
      showWarning('Servidor principal é obrigatório.')
      return
    }
    try {
      if (modal === 'new') {
        await api.post('/api/revendedores', {
          nome: form.nome,
          contacto: form.contacto,
          servidorId: form.servidorId || null,
          observacoes: form.observacoes || null,
        })
      } else if (form.id) {
        await api.patch(`/api/revendedores/${form.id}`, {
          nome: form.nome,
          contacto: form.contacto,
          servidorId: form.servidorId ?? null,
          observacoes: form.observacoes ?? null,
          status: form.status ?? 'ativo',
        })
      }
      setModal(null)
      setForm({ nome: '', contacto: '', servidorId: null, observacoes: '' })
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao guardar')
    }
  }

  async function confirmarSuspender() {
    if (!revendedorSuspender) return
    try {
      await api.post(`/api/revendedores/${revendedorSuspender.id}/suspender`, {})
      setRevendedorSuspender(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function confirmarAtivar() {
    if (!revendedorAtivar) return
    try {
      await api.post(`/api/revendedores/${revendedorAtivar.id}/ativar`, {})
      setRevendedorAtivar(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function remove(id: number) {
    if (!confirm('Excluir revendedor? Os clientes vinculados ficarão sem revendedor.')) return
    try {
      await api.delete(`/api/revendedores/${id}`)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  const stats = {
    total: list.length,
    ativos: list.filter((r) => (r.status || 'ativo') === 'ativo').length,
    suspensos: list.filter((r) => r.status === 'suspenso').length,
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Store className="w-5 h-5" />
            Revendedores IPTV
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Gestão de revendedores do serviço de IPTV</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-netflix-panel/80 border border-netflix-border/60 text-gray-300 text-sm">
              <span className="font-semibold text-white">{stats.total}</span> total
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300 text-sm">
              <span className="font-semibold">{stats.ativos}</span> ativos
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-300 text-sm">
              <span className="font-semibold">{stats.suspensos}</span> suspensos
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm({ nome: '', contacto: '', servidorId: null, observacoes: '' })
              setModal('new')
            }}
            className="flex items-center gap-2 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium shadow-lg shadow-primary-900/30 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo revendedor
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 shadow-lg shadow-black/40 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">A carregar...</div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-netflix-panel/80 text-gray-300 text-sm">
                <tr>
                  <th className="px-4 py-3 font-medium w-12 text-center">Nº</th>
                  <th className="px-4 py-3 font-medium">Revendedor</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Servidor</th>
                  <th className="px-4 py-3 font-medium text-center">Clientes</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Observações</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-netflix-border/80 text-gray-200">
                {pagedList.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-netflix-hover/80 transition-colors">
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{(tablePageClamped - 1) * ROWS_PER_PAGE + idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary-600/20 text-primary-400">
                          <Store className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-white">{r.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{r.contacto}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {r.servidor ? r.servidor.nome : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-white">{r.totalClientes}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          (r.status || 'ativo') === 'ativo' ? 'bg-green-900/50 text-green-300' : 'bg-amber-900/50 text-amber-300'
                        }`}
                      >
                        {(r.status || 'ativo') === 'ativo' ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-[12rem] truncate" title={r.observacoes || undefined}>
                      {r.observacoes || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {(r.status || 'ativo') === 'ativo' ? (
                          <button
                            type="button"
                            onClick={() => setRevendedorSuspender(r)}
                            title="Suspender"
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/30 hover:text-white shadow-sm shadow-amber-900/40 transition-colors"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRevendedorAtivar(r)}
                            title="Ativar"
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-green-500/50 bg-green-500/10 text-green-300 hover:bg-green-500/30 hover:text-white shadow-sm shadow-green-900/40 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              id: r.id,
                              nome: r.nome,
                              contacto: r.contacto,
                              servidorId: r.servidorId,
                              observacoes: r.observacoes ?? '',
                              status: r.status,
                            })
                            setModal('edit')
                          }}
                          title="Editar"
                          className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-primary-500/50 bg-primary-500/10 text-primary-300 hover:bg-primary-500/30 hover:text-white hover:border-primary-400 shadow-sm shadow-primary-900/40 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
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
          <TablePagination totalItems={list.length} currentPage={tablePageClamped} onPageChange={setTablePage} />
          </>
        )}
        {!loading && list.length === 0 && (
          <div className="p-8 text-center text-gray-400">Nenhum revendedor. Adicione o primeiro.</div>
        )}
      </div>

      {/* Modal confirmar suspender */}
      {revendedorSuspender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-amber-500/40 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Suspender revendedor</h3>
                  <div className="h-1 w-12 bg-amber-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm text-gray-300">
                Tem a certeza que deseja suspender <span className="font-medium text-white">{revendedorSuspender.nome}</span>?
              </p>
              <p className="text-xs text-gray-500">O revendedor ficará com estado &quot;Suspenso&quot; e pode ser ativado novamente a qualquer momento.</p>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setRevendedorSuspender(null)}
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

      {/* Modal confirmar ativar */}
      {revendedorAtivar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-green-500/40 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-500/20 text-green-400 ring-1 ring-green-500/30">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Ativar revendedor</h3>
                  <div className="h-1 w-12 bg-green-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm text-gray-300">
                Tem a certeza que deseja ativar <span className="font-medium text-white">{revendedorAtivar.nome}</span>?
              </p>
              <p className="text-xs text-gray-500">O revendedor ficará com estado &quot;Ativo&quot; e poderá ser atribuído a novos clientes.</p>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setRevendedorAtivar(null)}
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

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-netflix-border max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/30">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {modal === 'new' ? 'Novo revendedor' : 'Editar revendedor'}
                  </h3>
                  <div className="h-1 w-12 bg-primary-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Nome</label>
                <input
                  type="text"
                  value={form.nome || ''}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome do revendedor"
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Contacto (telefone / WhatsApp)</label>
                <input
                  type="text"
                  value={form.contacto || ''}
                  onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))}
                  placeholder="+351 912 345 678"
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Servidor (obrigatório)</label>
                <select
                  value={form.servidorId ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, servidorId: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                >
                  <option value="">Selecione o servidor principal</option>
                  {servidoresPrincipais.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
              {modal === 'edit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-0.5">Estado</label>
                  <select
                    value={form.status || 'ativo'}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="suspenso">Suspenso</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Observações</label>
                <textarea
                  value={form.observacoes || ''}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 resize-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  rows={2}
                  placeholder="Notas opcionais"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80 bg-netflix-panel/30">
              <button
                type="button"
                onClick={() => setModal(null)}
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
