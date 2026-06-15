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
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

import { tratamentoNome } from '../utils/tratamento'
import { defaultPanelPath } from '../lib/panelRoles'

const STAFF_ROLES = ['admin', 'geral', 'netflix', 'iptv', 'suporte'] as const

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: [...STAFF_ROLES] },
  { to: '/clientes', icon: Users, label: 'Clientes', roles: [...STAFF_ROLES] },
  { to: '/servidores', icon: Server, label: 'Servidores', roles: ['admin', 'geral', 'iptv', 'suporte'] },
  { to: '/revendedores', icon: Store, label: 'Revendedores', roles: ['admin', 'geral', 'iptv', 'suporte'] },
  { to: '/salas', icon: LayoutGrid, label: 'Salas', roles: ['admin', 'geral', 'netflix', 'suporte'] },
  { to: '/indicacoes', icon: Gift, label: 'Indicações', roles: [...STAFF_ROLES] },
  { to: '/utilizadores', icon: UserCog, label: 'Utilizadores', roles: ['admin'] },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro', roles: ['admin', 'financeiro'] },
  { to: '/audit', icon: FileText, label: 'Log', roles: ['admin'] },
]

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  geral: 'Operador (geral)',
  netflix: 'Operador Netflix',
  iptv: 'Operador IPTV',
  suporte: 'Suporte',
  financeiro: 'Financeiro',
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarHovered, setSidebarHovered] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  // Desktop: mostrar texto ao passar o rato. Mobile: o drawer não tem hover — usar sidebarOpen.
  const expanded = sidebarHovered || sidebarOpen

  // Mobile: com o drawer aberto, bloquear scroll do body para o gesto ir para a nav lateral.
  useEffect(() => {
    if (!sidebarOpen) return
    const mq = window.matchMedia('(max-width: 1023px)')
    if (!mq.matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sidebarOpen])

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-netflix-bg">
      {/* Sidebar: à esquerda, abre ao passar o rato (desktop) */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`fixed left-0 top-0 z-40 flex h-[100dvh] max-h-[100dvh] min-h-0 w-64 flex-col overflow-hidden bg-primary-800/80 backdrop-blur-2xl border-r border-primary-700/60 transition-all duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${
          expanded ? 'lg:w-64' : 'lg:w-[4.5rem]'
        }`}
      >
        {/* Header: logo (desktop) / logo + fechar (mobile) */}
        <div
          className={`flex items-center h-12 min-w-0 px-2 border-b border-primary-700/80 shrink-0 ${
            expanded ? 'justify-between' : 'justify-between lg:justify-center'
          }`}
        >
          <Link to={defaultPanelPath(user?.role)} className="flex items-center gap-2 min-w-0" onClick={() => setSidebarOpen(false)}>
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
        <nav
          className="rove-scrollbar min-h-0 flex-1 touch-pan-y space-y-0.5 overflow-y-auto overflow-x-hidden overscroll-y-contain p-2 pb-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]"
          aria-label="Navegação principal"
        >
          {nav.map((item) => {
            const allowedRoles = item.roles
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

        {/* Rodapé: email + Sair (safe-area em telemóveis com barra à base) */}
        <div className="shrink-0 border-t border-primary-700/80 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
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

      {/* Main: altura limitada + scroll no main (especialmente em mobile) */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pl-[4.5rem]">
        <header className="flex h-14 shrink-0 items-center border-b border-netflix-border bg-netflix-card/80 px-4 backdrop-blur-sm gap-2">
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
        <main className="rove-scrollbar min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 [-webkit-overflow-scrolling:touch] lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
