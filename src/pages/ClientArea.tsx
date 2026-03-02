import { motion } from 'framer-motion'
import { useState } from 'react'
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  CreditCard, 
  Calendar, 
  Wifi, 
  Settings,
  Download,
  Headphones,
  LogOut,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react'

const ClientArea = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Mock user data
  const userData = {
    name: 'João Silva',
    email: 'joao@email.com',
    plan: {
      name: 'Plano Anual',
      price: 220.00,
      status: 'active' as const
    },
    expiresAt: '2024-12-31',
    devices: 3,
    lastLogin: '2024-01-15 14:30'
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock login - in real app would validate credentials
    if (email && password) {
      setIsLoggedIn(true)
    }
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setEmail('')
    setPassword('')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'expired':
        return 'text-red-600 bg-red-100'
      case 'cancelled':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo'
      case 'expired':
        return 'Expirado'
      case 'cancelled':
        return 'Cancelado'
      default:
        return 'Desconhecido'
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-20">
        <div className="max-w-md w-full mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="card p-8"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Área do Cliente
              </h1>
              <p className="text-gray-600">
                Faça login para acessar sua conta
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="seu@email.com"
                    required
                  />
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Sua senha"
                    required
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-primary"
              >
                Entrar
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Esqueceu sua senha?{' '}
                <button className="text-primary-600 hover:text-primary-700 font-semibold">
                  Recuperar senha
                </button>
              </p>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Dica:</strong> Use o mesmo e-mail que você usou para assinar o IPTV da Rove+.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Bem-vindo, {userData.name}!
              </h1>
              <p className="text-gray-600">
                Gerencie sua conta e aproveite ao máximo o IPTV da Rove+
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair</span>
            </button>
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Subscription Status */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Status da Assinatura</h2>
              <CreditCard className="w-6 h-6 text-primary-600" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Plano:</span>
                <span className="font-semibold">{userData.plan.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Valor:</span>
                <span className="font-semibold">R$ {userData.plan.price.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(userData.plan.status)}`}>
                  {getStatusText(userData.plan.status)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Expira em:</span>
                <span className="font-semibold">{new Date(userData.expiresAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            <button className="w-full mt-6 btn-secondary">
              Renovar Assinatura
            </button>
          </motion.div>

          {/* Usage Stats */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Uso da Conta</h2>
              <Wifi className="w-6 h-6 text-accent-600" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Dispositivos ativos:</span>
                <span className="font-semibold">{userData.devices}/5</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-accent-500 h-2 rounded-full" 
                  style={{ width: `${(userData.devices / 5) * 100}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Último login:</span>
                <span className="text-sm">{userData.lastLogin}</span>
              </div>
            </div>
            <button className="w-full mt-6 btn-secondary">
              Gerenciar Dispositivos
            </button>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Ações Rápidas</h2>
              <Settings className="w-6 h-6 text-secondary-600" />
            </div>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200">
                <div className="flex items-center space-x-3">
                  <Download className="w-5 h-5 text-primary-600" />
                  <span>Baixar Aplicativo</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200">
                <div className="flex items-center space-x-3">
                  <Headphones className="w-5 h-5 text-accent-600" />
                  <span>Suporte Técnico</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200">
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-5 h-5 text-secondary-600" />
                  <span>Histórico de Pagamentos</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="card p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Atividade Recente</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Login realizado com sucesso</p>
                <p className="text-sm text-gray-600">15 de janeiro de 2024 às 14:30</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Assinatura renovada</p>
                <p className="text-sm text-gray-600">1 de janeiro de 2024 às 10:15</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 p-4 bg-yellow-50 rounded-lg">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Novo dispositivo conectado</p>
                <p className="text-sm text-gray-600">30 de dezembro de 2023 às 20:45</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default ClientArea
