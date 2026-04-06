import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AlertProvider } from './contexts/AlertContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Servidores from './pages/Servidores'
import Revendedores from './pages/Revendedores'
import Salas from './pages/Salas'
import Indicacoes from './pages/Indicacoes'
import Audit from './pages/Audit'
import Utilizadores from './pages/Utilizadores'
import Financeiro from './pages/Financeiro'
import Manual from './pages/Manual'
import Notificacoes from './pages/Notificacoes'
import MeuPerfil from './pages/MeuPerfil'
import ClienteLogin from './pages/ClienteLogin'
import ClientArea from './pages/ClientArea'
import { useClientPortal } from './contexts/ClientPortalContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-netflix-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function ProtectedClienteRoute({ children }: { children: React.ReactNode }) {
  const { client, loading } = useClientPortal()
  if (loading) {
    return (
      <div className="min-h-screen bg-netflix-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }
  if (!client) {
    return <Navigate to="/cliente/login" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <AlertProvider>
      <Routes>
      <Route path="/cliente/login" element={<ClienteLogin />} />
      <Route
        path="/cliente"
        element={
          <ProtectedClienteRoute>
            <ClientArea />
          </ProtectedClienteRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="servidores" element={<Servidores />} />
        <Route path="revendedores" element={<Revendedores />} />
        <Route path="salas" element={<Salas />} />
        <Route path="indicacoes" element={<Indicacoes />} />
        <Route path="utilizadores" element={<Utilizadores />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="notificacoes" element={<Notificacoes />} />
        <Route path="perfil" element={<MeuPerfil />} />
        <Route path="audit" element={<Audit />} />
        <Route path="manual" element={<Manual />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AlertProvider>
  )
}

export default App
