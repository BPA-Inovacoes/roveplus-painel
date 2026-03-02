import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, LayoutGrid, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'

interface Sala {
  id: number
  nome: string
  email: string | null
  senha: string | null
  observacoes: string | null
  dataFim: string | null
  status: string
  totalClientes: number
}

export default function Salas() {
  const { showError, showWarning } = useAlert()
  const [list, setList] = useState<Sala[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [salaSuspender, setSalaSuspender] = useState<Sala | null>(null)
  const [salaAtivar, setSalaAtivar] = useState<Sala | null>(null)
  const [showSenha, setShowSenha] = useState(false)
  const [form, setForm] = useState<Partial<Sala>>({ nome: '', email: '', senha: '', observacoes: '', dataFim: '' })

  function load() {
    setLoading(true)
    api
      .get<Sala[]>('/api/salas')
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    if (!form.nome || !form.nome.trim()) {
      showWarning('Nome da sala é obrigatório.')
      return
    }
    try {
      if (modal === 'new') {
        await api.post('/api/salas', {
          nome: form.nome.trim(),
          email: form.email?.trim() || null,
          senha: form.senha || null,
          observacoes: form.observacoes?.trim() || null,
          dataFim: form.dataFim || undefined,
        })
      } else if (form.id) {
        await api.patch(`/api/salas/${form.id}`, {
          nome: form.nome.trim(),
          email: form.email?.trim() || null,
          senha: form.senha || null,
          observacoes: form.observacoes?.trim() || null,
          dataFim: form.dataFim || null,
          status: form.status ?? 'ativo',
        })
      }
      setModal(null)
      setShowSenha(false)
      setForm({ nome: '', email: '', senha: '', observacoes: '', dataFim: '' })
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao guardar')
    }
  }

  async function confirmarSuspender() {
    if (!salaSuspender) return
    try {
      await api.post(`/api/salas/${salaSuspender.id}/suspender`, {})
      setSalaSuspender(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function confirmarAtivar() {
    if (!salaAtivar) return
    try {
      await api.post(`/api/salas/${salaAtivar.id}/ativar`, {})
      setSalaAtivar(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function remove(id: number) {
    if (!confirm('Excluir sala? Os clientes vinculados ficarão sem sala atribuída.')) return
    try {
      await api.delete(`/api/salas/${id}`)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Salas Netflix
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Contas (salas) do Plano Room em que os clientes estão</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({ nome: '', email: '', senha: '', observacoes: '', dataFim: '' })
            setShowSenha(false)
            setModal('new')
          }}
          className="flex items-center gap-2 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium shadow-lg shadow-primary-900/30"
        >
          <Plus className="w-4 h-4" />
          Nova sala
        </button>
      </div>

      <div className="rounded-xl border border-netflix-border/80 bg-netflix-card/80 shadow-lg shadow-black/40 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">A carregar...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-netflix-panel/80 text-gray-300 text-sm">
                <tr>
                  <th className="px-4 py-3 font-medium w-12 text-center">Nº</th>
                  <th className="px-4 py-3 font-medium">Sala</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Senha</th>
                  <th className="px-4 py-3 font-medium text-center">Clientes</th>
                  <th className="px-4 py-3 font-medium">Data fim</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Observações</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-netflix-border/80 text-gray-200">
                {list.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-netflix-hover/80 transition-colors">
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-sky-600/20 text-sky-400">
                          <LayoutGrid className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-white">{s.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-[10rem] truncate" title={s.email || undefined}>
                      {s.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                      {s.senha ? '••••••••' : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-white">{s.totalClientes}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {s.dataFim ? new Date(s.dataFim).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          (s.status || 'ativo') === 'ativo' ? 'bg-green-900/50 text-green-300' : 'bg-amber-900/50 text-amber-300'
                        }`}
                      >
                        {(s.status || 'ativo') === 'ativo' ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-[12rem] truncate" title={s.observacoes || undefined}>
                      {s.observacoes || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {(s.status || 'ativo') === 'ativo' ? (
                          <button
                            type="button"
                            onClick={() => setSalaSuspender(s)}
                            title="Suspender"
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/30 hover:text-white shadow-sm shadow-amber-900/40 transition-colors"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSalaAtivar(s)}
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
                              id: s.id,
                              nome: s.nome,
                              email: s.email ?? '',
                              senha: s.senha ?? '',
                              observacoes: s.observacoes ?? '',
                              dataFim: s.dataFim ? String(s.dataFim).slice(0, 10) : '',
                              status: s.status,
                            })
                            setShowSenha(false)
                            setModal('edit')
                          }}
                          title="Editar"
                          className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-primary-500/50 bg-primary-500/10 text-primary-300 hover:bg-primary-500/30 hover:text-white hover:border-primary-400 shadow-sm shadow-primary-900/40 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(s.id)}
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
        )}
        {!loading && list.length === 0 && (
          <div className="p-8 text-center text-gray-400">Nenhuma sala. Crie uma para atribuir a clientes do Plano Room.</div>
        )}
      </div>

      {/* Modal confirmar suspender sala */}
      {salaSuspender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-amber-500/40 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Suspender sala</h3>
                  <div className="h-1 w-12 bg-amber-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm text-gray-300">
                Tem a certeza que deseja suspender <span className="font-medium text-white">{salaSuspender.nome}</span>?
              </p>
              <p className="text-xs text-gray-500">A sala ficará com estado &quot;Suspenso&quot; e pode ser ativada novamente a qualquer momento.</p>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setSalaSuspender(null)}
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

      {/* Modal confirmar ativar sala */}
      {salaAtivar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-green-500/40 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-500/20 text-green-400 ring-1 ring-green-500/30">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Ativar sala</h3>
                  <div className="h-1 w-12 bg-green-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm text-gray-300">
                Tem a certeza que deseja ativar <span className="font-medium text-white">{salaAtivar.nome}</span>?
              </p>
              <p className="text-xs text-gray-500">A sala ficará com estado &quot;Ativo&quot; e poderá ser atribuída a clientes.</p>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setSalaAtivar(null)}
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
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {modal === 'new' ? 'Nova sala' : 'Editar sala'}
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
                  placeholder="Ex: Sala 1, Conta A"
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Email</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Senha</label>
                <div className="relative">
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={form.senha || ''}
                    onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                    placeholder="••••••••"
                    autoComplete={modal === 'new' ? 'new-password' : 'current-password'}
                    className="w-full px-3 py-2 pr-10 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    title={showSenha ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Data fim (partilhada pelos 4 usuários)</label>
                <input
                  type="date"
                  value={form.dataFim ? String(form.dataFim).slice(0, 10) : ''}
                  onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Observações</label>
                <input
                  type="text"
                  value={form.observacoes || ''}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-colors"
                />
              </div>
              {modal === 'edit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-0.5">Estado</label>
                  <select
                    value={form.status || 'ativo'}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-colors"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="suspenso">Suspenso</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80 bg-netflix-panel/30">
              <button
                type="button"
                onClick={() => { setModal(null); setShowSenha(false) }}
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
