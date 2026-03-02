import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, Server } from 'lucide-react'
import { api } from '../api/client'
import { useAlert } from '../contexts/AlertContext'

interface Servidor {
  id: number
  nome: string
  tipo: string
  status: string
  totalClientes: number
  servidorId?: number | null
  servidor?: { id: number; nome: string } | null
}

export default function Servidores() {
  const { showError, showWarning } = useAlert()
  const [list, setList] = useState<Servidor[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [form, setForm] = useState<Partial<Servidor>>({
    nome: '',
    tipo: 'principal',
    status: 'online',
    servidorId: null,
  })

  function load() {
    setLoading(true)
    api
      .get<Servidor[]>('/api/servidores')
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    const nome = (form.nome ?? '').trim()
    if (!nome) {
      showWarning('Nome do servidor é obrigatório.')
      return
    }
    if (form.tipo === 'secundario' && !form.servidorId) {
      showWarning('Selecione o servidor primário para um servidor secundário.')
      return
    }
    try {
      const payload = { ...form, nome }
      if (modal === 'new') {
        await api.post('/api/servidores', payload)
      } else if (form.id) {
        await api.patch(`/api/servidores/${form.id}`, payload)
      }
      setModal(null)
      setForm({ nome: '', tipo: 'principal', status: 'online', servidorId: null })
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao guardar')
    }
  }

  async function remove(id: number) {
    if (!confirm('Excluir servidor? Clientes vinculados ficarão sem servidor.')) return
    try {
      await api.delete(`/api/servidores/${id}`)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  const statusClass: Record<string, string> = {
    online: 'bg-green-900/50 text-green-300',
    instável: 'bg-amber-900/50 text-amber-300',
    offline: 'bg-red-900/50 text-red-300',
  }
  const tipoLabel: Record<string, string> = {
    principal: 'Principal',
    secundario: 'Secundário',
    backup: 'Secundário', // legado
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Server className="w-5 h-5" />
            Servidores IPTV
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Servidores do serviço IPTV. Principal e secundário. Associe clientes a cada servidor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({ nome: '', tipo: 'principal', status: 'online', servidorId: null })
            setModal('new')
          }}
          className="flex items-center gap-2 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo servidor
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full p-8 text-center text-gray-400">A carregar...</div>
        ) : (
          list.map((s) => (
            <div
              key={s.id}
              className="bg-netflix-card rounded-xl shadow border border-netflix-border p-5 flex items-start justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary-600/20 text-primary-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{s.nome}</h3>
                  <p className="text-sm text-gray-500">
                    {tipoLabel[s.tipo] ?? s.tipo}
                    {s.tipo === 'secundario' && s.servidor && (
                      <span className="text-gray-400"> → {s.servidor.nome}</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    <span className="font-medium">{s.totalClientes}</span> clientes
                  </p>
                  <span
                    className={`inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium ${statusClass[s.status] || 'bg-gray-700 text-gray-300'}`}
                  >
                    {s.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...s })
                    setModal('edit')
                  }}
                  className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-primary-500/50 bg-primary-500/10 text-primary-300 hover:bg-primary-500/30 hover:text-white hover:border-primary-400 shadow-sm shadow-primary-900/40 transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-red-500/60 bg-red-500/15 text-red-300 hover:bg-red-500/30 hover:text-white shadow-sm shadow-red-900/40 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-netflix-border max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/30">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {modal === 'new' ? 'Novo servidor' : 'Editar servidor'}
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
                  placeholder="Ex: Servidor 1"
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Tipo</label>
                <select
                  value={form.tipo || 'principal'}
                  onChange={(e) => {
                    const tipo = e.target.value
                    setForm((f) => ({
                      ...f,
                      tipo,
                      servidorId: tipo === 'secundario' ? f.servidorId : null,
                    }))
                  }}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                >
                  <option value="principal">Principal</option>
                  <option value="secundario">Secundário</option>
                </select>
              </div>
              {form.tipo === 'secundario' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-0.5">
                    Servidor primário
                  </label>
                  <select
                    value={form.servidorId ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        servidorId: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                  >
                    <option value="">Selecione o primário</option>
                    {list
                      .filter((s) => s.tipo === 'principal' && s.id !== form.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Estado</label>
                <select
                  value={form.status || 'online'}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-lg text-sm text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                >
                  <option value="online">Online</option>
                  <option value="instável">Instável</option>
                  <option value="offline">Offline</option>
                </select>
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
