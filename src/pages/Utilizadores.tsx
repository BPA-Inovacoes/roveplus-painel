import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Edit2, Trash2, KeyRound, UserCog, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAlert } from '../contexts/AlertContext'
import { api } from '../api/client'

export interface UserRow {
  id: number
  nome: string
  email: string
  role: string
  status?: string
  createdAt: string
}

const ROLES_OPERADORES = [
  { value: 'geral', label: 'Geral' },
  { value: 'netflix', label: 'Netflix' },
  { value: 'iptv', label: 'IPTV' },
]

const ROLE_STYLES: Record<
  string,
  { label: string; chip: string; pill: string }
> = {
  admin: {
    label: 'Administrador',
    chip: 'bg-amber-100 text-amber-900',
    pill: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
  },
  geral: {
    label: 'Geral',
    chip: 'bg-sky-500/15 text-sky-200',
    pill: 'bg-sky-500/15 text-sky-200 border border-sky-400/40',
  },
  netflix: {
    label: 'Netflix',
    chip: 'bg-red-500/20 text-red-200',
    pill: 'bg-red-500/15 text-red-200 border border-red-400/40',
  },
  iptv: {
    label: 'IPTV',
    chip: 'bg-violet-500/20 text-violet-200',
    pill: 'bg-violet-500/15 text-violet-200 border border-violet-400/40',
  },
  suporte: {
    label: 'Suporte',
    chip: 'bg-emerald-500/15 text-emerald-200',
    pill: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/40',
  },
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR')
}

export default function Utilizadores() {
  const { user } = useAuth()
  const { showError, showWarning } = useAlert()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form, setForm] = useState({ nome: '', email: '', password: '', role: 'geral' })
  const [submitLoading, setSubmitLoading] = useState(false)
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null)
  const [userToSuspender, setUserToSuspender] = useState<UserRow | null>(null)
  const [userToAtivar, setUserToAtivar] = useState<UserRow | null>(null)
  const [userToResetPassword, setUserToResetPassword] = useState<UserRow | null>(null)
  const [resetPasswordForm, setResetPasswordForm] = useState({ password: '', confirm: '' })

  const load = () => {
    setLoading(true)
    api
      .get<UserRow[]>('/api/users')
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setForm({ nome: '', email: '', password: '', role: 'geral' })
    setEditing(null)
    setModal('create')
  }

  const openEdit = (u: UserRow) => {
    setForm({ nome: u.nome, email: u.email, password: '', role: u.role === 'admin' ? 'geral' : u.role })
    setEditing(u)
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setEditing(null)
    setForm({ nome: '', email: '', password: '', role: 'geral' })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim() || !form.password) {
      setError('Preencha nome, email e senha.')
      return
    }
    setSubmitLoading(true)
    setError(null)
    api
      .post<UserRow>('/api/users', {
        nome: form.nome.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      .then(() => {
        closeModal()
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao criar'))
      .finally(() => setSubmitLoading(false))
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !form.nome.trim() || !form.email.trim()) return
    setSubmitLoading(true)
    setError(null)
    api
      .patch<UserRow>(`/api/users/${editing.id}`, {
        nome: form.nome.trim(),
        email: form.email.trim(),
        role: form.role,
      })
      .then(() => {
        closeModal()
        load()
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao guardar'))
      .finally(() => setSubmitLoading(false))
  }

  async function confirmarExcluir() {
    if (!userToDelete) return
    setSubmitLoading(true)
    setError(null)
    try {
      await api.delete(`/api/users/${userToDelete.id}`)
      setUserToDelete(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao eliminar')
    } finally {
      setSubmitLoading(false)
    }
  }

  async function confirmarSuspender() {
    if (!userToSuspender) return
    setSubmitLoading(true)
    setError(null)
    try {
      await api.post(`/api/users/${userToSuspender.id}/suspender`, {})
      setUserToSuspender(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao suspender')
    } finally {
      setSubmitLoading(false)
    }
  }

  async function confirmarAtivar() {
    if (!userToAtivar) return
    setSubmitLoading(true)
    setError(null)
    try {
      await api.post(`/api/users/${userToAtivar.id}/ativar`, {})
      setUserToAtivar(null)
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao ativar')
    } finally {
      setSubmitLoading(false)
    }
  }

  async function confirmarRedefinirSenha() {
    if (!userToResetPassword) return
    const pwd = resetPasswordForm.password.trim()
    const conf = resetPasswordForm.confirm.trim()
    if (!pwd) {
      showWarning('Introduza a nova senha.')
      return
    }
    if (pwd !== conf) {
      showWarning('As senhas não coincidem.')
      return
    }
    if (pwd.length < 6) {
      showWarning('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setSubmitLoading(true)
    setError(null)
    try {
      await api.patch(`/api/users/${userToResetPassword.id}`, { password: pwd })
      setUserToResetPassword(null)
      setResetPasswordForm({ password: '', confirm: '' })
      load()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao redefinir senha')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (user && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  const isLastAdmin = (u: UserRow) => {
    if (u.role !== 'admin') return false
    return users.filter((x) => x.role === 'admin').length <= 1
  }

  const stats = {
    total: users.length,
    administradores: users.filter((u) => u.role === 'admin').length,
    operadores: users.filter((u) => u.role !== 'admin').length,
    ativos: users.filter((u) => (u.status || 'ativo') === 'ativo').length,
    suspensos: users.filter((u) => u.status === 'suspenso').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <UserCog className="w-6 h-6" />
            Utilizadores
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gestão dos acessos ao painel. Apenas o administrador pode criar e editar utilizadores.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-netflix-panel/80 border border-netflix-border/60 text-gray-300 text-sm">
              <span className="font-semibold text-white">{stats.total}</span> total
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-300 text-sm">
              <span className="font-semibold">{stats.administradores}</span> administradores
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-900/30 border border-sky-700/40 text-sky-300 text-sm">
              <span className="font-semibold">{stats.operadores}</span> operadores
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
            onClick={openCreate}
            className="flex items-center gap-2 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium shadow-lg shadow-primary-900/30 shrink-0"
          >
            <span className="text-base leading-none">＋</span>
            Novo utilizador
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 text-red-300 rounded-lg border border-red-800" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-netflix-card/80 rounded-xl border border-netflix-border/80 shadow-lg shadow-black/40 overflow-hidden">
          <table className="min-w-full divide-y divide-netflix-border/80">
            <thead className="bg-netflix-panel/80">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wide w-12">
                  Nº
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Utilizador
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Perfil
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Criado em
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-netflix-border/80">
              {users.map((u, idx) => {
                const roleStyle = ROLE_STYLES[u.role] ?? ROLE_STYLES.geral
                return (
                  <tr key={u.id} className="hover:bg-netflix-hover/80 transition-colors">
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm text-white">
                      <div className="flex flex-col">
                        <span className="font-medium">{u.nome}</span>
                        <span className="text-xs text-gray-400">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium rounded-full ${roleStyle.pill}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                        {roleStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          (u.status || 'ativo') === 'ativo' ? 'bg-green-900/50 text-green-300' : 'bg-amber-900/50 text-amber-300'
                        }`}
                      >
                        {(u.status || 'ativo') === 'ativo' ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(u.status || 'ativo') === 'ativo' && u.role !== 'admin' && !isLastAdmin(u) && (
                          <button
                            type="button"
                            onClick={() => setUserToSuspender(u)}
                            title="Suspender"
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/30 hover:text-white shadow-sm shadow-amber-900/40 transition-colors"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                        {(u.status || 'ativo') === 'suspenso' && (
                          <button
                            type="button"
                            onClick={() => setUserToAtivar(u)}
                            title="Ativar"
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-green-500/50 bg-green-500/10 text-green-300 hover:bg-green-500/30 hover:text-white shadow-sm shadow-green-900/40 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {u.role !== 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              title="Editar"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-primary-500/50 bg-primary-500/10 text-primary-300 hover:bg-primary-500/30 hover:text-white hover:border-primary-400 shadow-sm shadow-primary-900/40 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setUserToResetPassword(u)
                                setResetPasswordForm({ password: '', confirm: '' })
                              }}
                              title="Redefinir senha"
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-sky-500/50 bg-sky-500/10 text-sky-300 hover:bg-sky-500/30 hover:text-white shadow-sm shadow-sky-900/40 transition-colors"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {u.role === 'admin' && (
                          <span className="text-gray-500 text-xs italic px-2">(único admin)</span>
                        )}
                        {!isLastAdmin(u) && (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            title="Eliminar"
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-red-500/60 bg-red-500/15 text-red-300 hover:bg-red-500/30 hover:text-white shadow-sm shadow-red-900/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal confirmar suspender utilizador */}
      {userToSuspender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-amber-500/40 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Suspender utilizador</h3>
                  <div className="h-1 w-12 bg-amber-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm text-gray-300">
                Tem a certeza que deseja suspender <span className="font-medium text-white">{userToSuspender.nome}</span>?
              </p>
              <p className="text-xs text-gray-500">O utilizador ficará com estado &quot;Suspenso&quot; e não poderá fazer login até ser ativado novamente.</p>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setUserToSuspender(null)}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarSuspender}
                disabled={submitLoading}
                className="flex-1 py-2.5 px-4 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-lg shadow-amber-900/30"
              >
                {submitLoading ? 'A suspender…' : 'Suspender'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar ativar utilizador */}
      {userToAtivar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-green-500/40 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-500/20 text-green-400 ring-1 ring-green-500/30">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Ativar utilizador</h3>
                  <div className="h-1 w-12 bg-green-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm text-gray-300">
                Tem a certeza que deseja ativar <span className="font-medium text-white">{userToAtivar.nome}</span>?
              </p>
              <p className="text-xs text-gray-500">O utilizador ficará com estado &quot;Ativo&quot; e poderá fazer login novamente.</p>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setUserToAtivar(null)}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarAtivar}
                disabled={submitLoading}
                className="flex-1 py-2.5 px-4 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors shadow-lg shadow-green-900/30"
              >
                {submitLoading ? 'A ativar…' : 'Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar utilizador */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-red-500/40 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Eliminar utilizador</h3>
                  <div className="h-1 w-12 bg-red-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-sm text-gray-300">
                Tem a certeza que deseja eliminar <span className="font-medium text-white">{userToDelete.nome}</span>?
              </p>
              <p className="text-xs text-gray-500">O utilizador deixará de ter acesso ao painel. Esta ação não pode ser revertida.</p>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExcluir}
                disabled={submitLoading}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors shadow-lg shadow-red-900/30"
              >
                {submitLoading ? 'A eliminar…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal redefinir senha */}
      {userToResetPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-netflix-border max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Redefinir senha</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{userToResetPassword.nome}</p>
                  <div className="h-1 w-12 bg-sky-500 rounded-full mt-2" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Nova senha</label>
                <input
                  type="password"
                  value={resetPasswordForm.password}
                  onChange={(e) => setResetPasswordForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Mín. 6 caracteres"
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-0.5">Confirmar senha</label>
                <input
                  type="password"
                  value={resetPasswordForm.confirm}
                  onChange={(e) => setResetPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repita a senha"
                  className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80 bg-netflix-panel/30">
              <button
                type="button"
                onClick={() => { setUserToResetPassword(null); setResetPasswordForm({ password: '', confirm: '' }) }}
                className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarRedefinirSenha}
                disabled={submitLoading}
                className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-lg shadow-primary-900/30"
              >
                {submitLoading ? 'A guardar…' : 'Redefinir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'create' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-netflix-card rounded-xl shadow-xl border border-netflix-border max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Novo utilizador</h2>
            <form onSubmit={handleCreate}>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className="w-full bg-netflix-panel border border-netflix-border rounded-lg px-3 py-2 text-white"
                  required
                />
                <label className="block text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-netflix-panel border border-netflix-border rounded-lg px-3 py-2 text-white"
                  required
                />
                <label className="block text-sm font-medium text-gray-300">Senha</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full bg-netflix-panel border border-netflix-border rounded-lg px-3 py-2 text-white"
                  required
                />
                <label className="block text-sm font-medium text-gray-300">Perfil</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full bg-netflix-panel border border-netflix-border rounded-lg px-3 py-2 text-white"
                >
                  {ROLES_OPERADORES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-300 hover:bg-netflix-hover rounded-lg">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitLoading ? 'A guardar…' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'edit' && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-netflix-card rounded-xl shadow-xl border border-netflix-border max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Editar utilizador</h2>
            <form onSubmit={handleEdit}>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className="w-full bg-netflix-panel border border-netflix-border rounded-lg px-3 py-2 text-white"
                  required
                />
                <label className="block text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-netflix-panel border border-netflix-border rounded-lg px-3 py-2 text-white"
                  required
                />
                <label className="block text-sm font-medium text-gray-300">Perfil</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full bg-netflix-panel border border-netflix-border rounded-lg px-3 py-2 text-white"
                >
                  {ROLES_OPERADORES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-300 hover:bg-netflix-hover rounded-lg">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitLoading ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
