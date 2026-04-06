import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCog,
  Server,
  Store,
  LayoutGrid,
  Gift,
  FileText,
  BookOpen,
  DollarSign,
  LogOut,
  Menu,
  X,
  Bell,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/servidores', icon: Server, label: 'Servidores', roles: ['admin', 'geral', 'iptv', 'suporte'] },
  { to: '/revendedores', icon: Store, label: 'Revendedores', roles: ['admin', 'geral', 'iptv', 'suporte'] },
  { to: '/salas', icon: LayoutGrid, label: 'Salas', roles: ['admin', 'geral', 'netflix', 'suporte'] },
  { to: '/indicacoes', icon: Gift, label: 'Indicações' },
  { to: '/utilizadores', icon: UserCog, label: 'Utilizadores', roles: ['admin'] },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro', roles: ['admin'] },
  { to: '/audit', icon: FileText, label: 'Log', roles: ['admin'] },
]

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  geral: 'Operador (geral)',
  netflix: 'Operador Netflix',
  iptv: 'Operador IPTV',
  suporte: 'Suporte',
}

import { tratamentoNome } from '../utils/tratamento'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarHovered, setSidebarHovered] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const expanded = sidebarHovered

  return (
    <div className="min-h-screen bg-netflix-bg flex">
      {/* Sidebar: à esquerda, abre ao passar o rato (desktop) */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-primary-800/80 backdrop-blur-2xl border-r border-primary-700/60 transition-all duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 w-64 ${
          expanded ? 'lg:w-64' : 'lg:w-[4.5rem]'
        }`}
      >
        {/* Header: logo (desktop) / logo + fechar (mobile) */}
        <div
          className={`flex items-center h-12 min-w-0 px-2 border-b border-primary-700/80 shrink-0 ${
            expanded ? 'justify-between' : 'justify-between lg:justify-center'
          }`}
        >
          <Link to="/" className="flex items-center gap-2 min-w-0" onClick={() => setSidebarOpen(false)}>
            <img src="/logo/logo-w.png" alt="Rove+" className="h-6 w-auto shrink-0 object-contain" />
            {expanded && <span className="font-semibold text-white truncate">Rove+</span>}
          </Link>
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-white/80 hover:bg-white/15"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav: ícones só (recolhido) ou ícone + label (expandido) */}
        <nav className="flex-1 min-h-0 p-2 space-y-0.5 overflow-y-auto overscroll-contain">
          {nav.map((item) => {
            const allowedRoles = 'roles' in item ? (item as { roles?: string[] }).roles : null
            if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) return null
            const isActive = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg transition-colors text-sm ${
                  expanded ? 'py-2 px-2.5' : 'justify-center p-2'
                } ${
                  isActive
                    ? expanded
                      ? 'bg-white/20 text-white border-l-4 border-l-white pl-[0.35rem]'
                      : 'bg-white/25 text-white'
                    : 'text-white/90 hover:bg-white/15 hover:text-white'
                }`}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Rodapé: email + Sair */}
        <div className="p-2 border-t border-primary-700/80 shrink-0">
          {expanded && (
            <>
              {user?.nome && (
                <div className="text-white font-medium text-xs mb-0.5 truncate px-1">{tratamentoNome(user.nome)}</div>
              )}
              <div className="text-white/80 text-[11px] mb-0.5 truncate px-1">{user?.email}</div>
              {user?.role && (
                <div className="text-white/60 text-[11px] mb-1.5 px-1">{roleLabels[user.role] || user.role}</div>
              )}
            </>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className={`flex items-center w-full rounded-lg text-sm transition-colors text-white/90 hover:bg-white/15 hover:text-white ${
              expanded ? 'gap-2 px-2.5 py-2' : 'justify-center p-2'
            }`}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {expanded && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar"
        />
      )}

      {/* Main: conteúdo (margem à esquerda no desktop para o menu colapsado) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[4.5rem]">
        <header className="h-14 bg-netflix-card/80 backdrop-blur-sm border-b border-netflix-border flex items-center px-4 gap-2 shrink-0">
          <button
            type="button"
            className="lg:hidden p-2 text-gray-300 rounded-lg hover:bg-white/10"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-white font-medium truncate flex-1 min-w-0">Painel Rove+</h1>
          <Link
            to="/notificacoes"
            className={`p-2 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white shrink-0 ${
              location.pathname === '/notificacoes' ? 'bg-white/15 text-white' : ''
            }`}
            aria-label="Notificações"
            title="Notificações"
          >
            <Bell className="w-5 h-5" />
          </Link>
          <Link
            to="/manual"
            className={`p-2 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white shrink-0 ${
              location.pathname === '/manual' ? 'bg-white/15 text-white' : ''
            }`}
            aria-label="Manual"
            title="Manual"
          >
            <BookOpen className="w-5 h-5" />
          </Link>
          <Link
            to="/perfil"
            className={`p-2 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white shrink-0 ${
              location.pathname === '/perfil' ? 'bg-white/15 text-white' : ''
            }`}
            aria-label="Meu perfil"
            title="Meu perfil"
          >
            <User className="w-5 h-5" />
          </Link>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
