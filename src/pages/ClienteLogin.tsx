import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, Phone, KeyRound, Shield, Sparkles, LifeBuoy } from 'lucide-react'
import { useClientPortal } from '../contexts/ClientPortalContext'
import { clientPortalApi } from '../api/clientPortal'

export default function ClienteLogin() {
  const [whatsapp, setWhatsapp] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRecover, setShowRecover] = useState(false)
  const [recoverWhatsapp, setRecoverWhatsapp] = useState('')
  const [recoverMsg, setRecoverMsg] = useState('')
  const [recoverLoading, setRecoverLoading] = useState(false)
  const { login } = useClientPortal()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(whatsapp, pin)
      navigate('/cliente', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecoverPin(e: React.FormEvent) {
    e.preventDefault()
    setRecoverMsg('')
    setRecoverLoading(true)
    try {
      const r = await clientPortalApi.post<{ ok: boolean; message?: string }>('/api/client-portal/recover-pin', {
        whatsapp: recoverWhatsapp,
      })
      setRecoverMsg(r.message || 'Pedido processado. Verifique o seu WhatsApp.')
    } catch (err) {
      setRecoverMsg(err instanceof Error ? err.message : 'Erro ao recuperar PIN.')
    } finally {
      setRecoverLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-netflix-bg relative overflow-hidden">
      {/* Fundo atmosférico */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_15%_10%,rgba(229,9,20,0.22),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_80%,rgba(139,92,246,0.12),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]"
        aria-hidden
      />

      <div className="relative lg:w-[44%] min-h-[280px] lg:min-h-screen flex flex-col justify-between pt-14 pb-8 px-8 lg:pt-20 lg:pb-14 lg:px-14 border-b lg:border-b-0 lg:border-r border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-700/90 via-primary-800/95 to-[#0a0a0c] lg:rounded-none" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary-500/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-violet-600/15 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <motion.img
            src="/logo/logo-w.png"
            alt="Rove+"
            className="h-28 lg:h-32 w-auto object-contain drop-shadow-lg"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45 }}
            className="mt-10 space-y-5"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/90 text-xs font-medium backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Acesso seguro
            </div>
            <h1 className="text-3xl lg:text-[2.15rem] font-bold text-white tracking-tight leading-tight">
              Área do cliente
            </h1>
            <p className="text-white/80 text-[15px] lg:text-base max-w-md leading-relaxed">
              Consulte renovação, plano e dados do serviço com o WhatsApp registado na Rove+ e o PIN que lhe foi indicado.
            </p>
            <div className="flex items-start gap-3 pt-2 text-white/70 text-sm max-w-sm">
              <Shield className="w-5 h-5 text-emerald-400/90 shrink-0 mt-0.5" />
              <span>A sua sessão é privada. Não partilhe o PIN com terceiros.</span>
            </div>
          </motion.div>
        </div>
        <p className="relative z-10 text-white/45 text-xs">© {new Date().getFullYear()} Rove+</p>
      </div>

      <div className="relative flex-1 flex items-center justify-center px-5 py-12 sm:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
          className="w-full max-w-[420px]"
        >
          <div className="rounded-2xl border border-netflix-border/80 bg-netflix-card/90 backdrop-blur-xl shadow-2xl shadow-black/50 p-8 sm:p-9 ring-1 ring-white/[0.04]">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600/20 border border-primary-500/30">
                <KeyRound className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Entrar</h2>
                <p className="text-xs text-gray-500 mt-0.5">WhatsApp + PIN da área cliente</p>
              </div>
            </div>
            <div className="mt-5 h-px w-full bg-gradient-to-r from-primary-600/50 via-netflix-border to-transparent" />

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {error && (
                <div
                  className="bg-red-950/50 text-red-200 text-sm p-3.5 rounded-xl border border-red-500/30 shadow-lg shadow-red-950/20"
                  role="alert"
                >
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="cl-whatsapp" className="block text-sm font-medium text-gray-300 mb-2">
                  WhatsApp
                </label>
                <div className="relative group">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-primary-500/70 pointer-events-none group-focus-within:text-primary-400 transition-colors" />
                  <input
                    id="cl-whatsapp"
                    type="text"
                    inputMode="tel"
                    autoComplete="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-netflix-panel/90 border border-netflix-border rounded-xl text-white placeholder-gray-500 text-[15px] focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/60 outline-none transition-shadow"
                    placeholder="+244 9XX XXX XXX"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cl-pin" className="block text-sm font-medium text-gray-300 mb-2">
                  PIN
                </label>
                <div className="relative group">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-primary-500/70 pointer-events-none group-focus-within:text-primary-400 transition-colors" />
                  <input
                    id="cl-pin"
                    type="password"
                    autoComplete="current-password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-netflix-panel/90 border border-netflix-border rounded-xl text-white placeholder-gray-500 text-[15px] focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/60 outline-none transition-shadow tracking-widest"
                    placeholder="••••••"
                    required
                    minLength={4}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 mt-2 bg-gradient-to-b from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white font-semibold rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-primary-900/40 border border-primary-500/20"
              >
                <LogIn className="w-5 h-5" />
                {loading ? 'A entrar…' : 'Entrar na área cliente'}
              </button>
            </form>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRecoverWhatsapp(whatsapp || '')
                  setRecoverMsg('')
                  setShowRecover(true)
                }}
                className="text-xs text-primary-300 hover:text-primary-200 underline underline-offset-2"
              >
                Recuperar PIN
              </button>
            </div>

            <p className="text-gray-500 text-sm mt-8 text-center leading-relaxed">
              É da equipa?{' '}
              <Link
                to="/login"
                className="text-primary-400 hover:text-primary-300 font-semibold underline-offset-2 hover:underline"
              >
                Acesso ao painel
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {showRecover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-netflix-card rounded-2xl shadow-2xl border border-primary-500/30 max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-netflix-border/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/30">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Recuperar PIN</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Enviaremos um PIN temporário por WhatsApp</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleRecoverPin}>
              <div className="p-6 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    inputMode="tel"
                    value={recoverWhatsapp}
                    onChange={(e) => setRecoverWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 bg-netflix-panel border border-netflix-border rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                    placeholder="+244 9XX XXX XXX"
                    required
                  />
                </div>
                {recoverMsg && (
                  <div className="text-xs rounded-lg border border-netflix-border/80 bg-netflix-panel/60 text-gray-300 p-3">
                    {recoverMsg}
                  </div>
                )}
              </div>
              <div className="flex gap-3 p-6 pt-4 border-t border-netflix-border/80 bg-netflix-panel/30">
                <button
                  type="button"
                  onClick={() => setShowRecover(false)}
                  className="flex-1 py-2.5 px-4 border border-netflix-border rounded-xl text-sm font-medium text-gray-300 bg-netflix-panel hover:bg-netflix-hover transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={recoverLoading}
                  className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-lg shadow-primary-900/30"
                >
                  {recoverLoading ? 'A enviar…' : 'Enviar PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
