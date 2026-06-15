import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, Mail, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { defaultPanelPath } from '../lib/panelRoles'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loggedIn = await login(email, password)
      navigate(defaultPanelPath(loggedIn.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Painel esquerdo: branding em vermelho (estilo referência) */}
      <div className="relative lg:w-[42%] min-h-[280px] lg:min-h-screen bg-primary-800 flex flex-col justify-between pt-24 pb-8 px-8 lg:pt-32 lg:pb-12 lg:px-12 overflow-hidden">
        {/* Ondas/curvas decorativas em vermelho claro */}
        <div className="absolute inset-0 opacity-100" aria-hidden>
          <svg className="absolute inset-0 w-full h-full text-white/10" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="waves" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                <path d="M0 80 Q50 40 100 80 T200 80 T300 80" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M0 120 Q50 80 100 120 T200 120 T300 120" fill="none" stroke="currentColor" strokeWidth="1" />
                <path d="M0 160 Q80 100 160 160 T320 160" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#waves)" />
          </svg>
          <svg className="absolute top-0 right-0 w-2/3 h-full text-primary-500/20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMid meet">
            <ellipse cx="100%" cy="30%" rx="60%" ry="40%" fill="currentColor" />
            <ellipse cx="100%" cy="70%" rx="50%" ry="35%" fill="currentColor" />
          </svg>
        </div>
        <div className="relative z-10">
          <img src="/logo/logo-w.png" alt="Rove+" className="h-44 w-auto object-contain" />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-8 lg:mt-12"
          >
            <h1 className="text-5xl lg:text-7xl font-bold text-white">
              Olá Rove+!
            </h1>
            <p className="text-white/90 mt-6 text-lg lg:text-xl max-w-lg leading-relaxed">
              Gestão de clientes Netflix e IPTV, servidores, indicações e renovação. Tudo num só painel.
            </p>
          </motion.div>
        </div>
        <p className="relative z-10 text-white/80 text-xs mt-8 lg:mt-0">
          © {new Date().getFullYear()} Rove+. Todos os direitos reservados.
        </p>
      </div>

      {/* Painel direito: formulário */}
      <div className="flex-1 flex items-center justify-center bg-netflix-card border-t lg:border-t-0 lg:border-l border-netflix-border pt-24 pb-6 px-6 lg:pt-32 lg:pb-12 lg:px-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mt-3">Bem-vindo de volta!</h2>
            <div className="mt-1.5 h-0.5 w-12 rounded-full bg-primary-600" aria-hidden />
            <p className="text-gray-400 text-sm mt-3">Entre com a sua conta para continuar.</p>
            <div className="mt-6 h-px bg-primary-600/50" aria-hidden />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-900/50 text-red-300 text-sm p-3 rounded-lg border border-red-800" role="alert">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500/80 pointer-events-none" aria-hidden />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-netflix-panel border border-primary-600/60 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-300">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500/80 pointer-events-none" aria-hidden />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-netflix-panel border border-primary-600/60 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </form>

          <p className="text-gray-500 text-sm mt-6">
            Esqueceu a senha?{' '}
            <a href="#" className="text-primary-400 hover:text-primary-300 underline">
              Contacte o administrador
            </a>
          </p>
          <p className="text-gray-500 text-sm mt-3">
            É cliente Rove+?{' '}
            <Link to="/" className="text-primary-400 hover:text-primary-300 font-medium">
              Área do cliente
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
