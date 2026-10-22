import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Enquanto true: mostra o spinner, desativa o botão e evita cliques repetidos. */
  loading?: boolean
  /** Texto durante o carregamento (por omissão mantém o texto do botão). */
  loadingText?: ReactNode
}

/**
 * Botão para ações que gravam dados (guardar, registar, excluir...).
 * Usa as mesmas classes do botão original; só acrescenta o estado de carregamento.
 */
export function LoadingButton({
  loading = false,
  loadingText,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${className} inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
        loading ? 'opacity-80' : ''
      }`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}
