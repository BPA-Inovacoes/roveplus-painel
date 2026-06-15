import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { RoveModalOverlay } from '../components/RoveModalOverlay'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'

type AlertVariant = 'error' | 'warning' | 'info'

interface AlertState {
  open: boolean
  message: string
  variant: AlertVariant
}

interface AlertContextValue {
  showAlert: (message: string, variant?: AlertVariant) => void
  showError: (message: string) => void
  showWarning: (message: string) => void
  showInfo: (message: string) => void
}

const AlertContext = createContext<AlertContextValue | null>(null)

const variantStyles: Record<AlertVariant, { icon: typeof AlertCircle; border: string; iconBg: string; iconColor: string }> = {
  error: {
    icon: AlertCircle,
    border: 'border-red-500/50',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/50',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
  },
  info: {
    icon: Info,
    border: 'border-primary-500/50',
    iconBg: 'bg-primary-500/20',
    iconColor: 'text-primary-400',
  },
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AlertState>({ open: false, message: '', variant: 'info' })

  const showAlert = useCallback((message: string, variant: AlertVariant = 'info') => {
    setState({ open: true, message, variant })
  }, [])

  const showError = useCallback((message: string) => showAlert(message, 'error'), [showAlert])
  const showWarning = useCallback((message: string) => showAlert(message, 'warning'), [showAlert])
  const showInfo = useCallback((message: string) => showAlert(message, 'info'), [showAlert])

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  const value: AlertContextValue = { showAlert, showError, showWarning, showInfo }

  return (
    <AlertContext.Provider value={value}>
      {children}
      {state.open && (
        <RoveModalOverlay zIndex={100}>
          <div
            className={`rounded-2xl shadow-2xl border bg-netflix-card max-w-md w-full overflow-hidden ${variantStyles[state.variant].border}`}
          >
            <div className="p-6 flex items-start gap-4">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${variantStyles[state.variant].iconBg} ${variantStyles[state.variant].iconColor}`}
              >
                {(() => {
                  const Icon = variantStyles[state.variant].icon
                  return <Icon className="w-5 h-5" />
                })()}
              </div>
              <div className="flex-1 min-w-0 pt-0.5 flex items-center gap-4">
                <p className="text-sm text-gray-200 leading-relaxed flex-1 min-w-0">{state.message}</p>
                <button
                  type="button"
                  onClick={close}
                  className="py-2.5 px-5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-900/30 shrink-0"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </RoveModalOverlay>
      )}
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlert must be used within AlertProvider')
  return ctx
}
