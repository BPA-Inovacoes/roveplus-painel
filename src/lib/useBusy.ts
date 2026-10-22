import { useCallback, useRef, useState } from 'react'

/**
 * Estado de "a gravar" para botões de ação.
 * `run('chave', fn)` marca a ação como ocupada enquanto `fn` corre e ignora cliques repetidos;
 * no botão: `loading={busy === 'chave'}`.
 */
export function useBusy() {
  const [busy, setBusy] = useState<string | null>(null)
  const running = useRef(false)
  const run = useCallback(async (key: string, fn: () => Promise<unknown>) => {
    if (running.current) return
    running.current = true
    setBusy(key)
    try {
      await fn()
    } finally {
      running.current = false
      setBusy(null)
    }
  }, [])
  return { busy, run }
}
