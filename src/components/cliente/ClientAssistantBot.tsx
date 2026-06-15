import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Send, Loader2, ExternalLink, MessageCircle, Copy, KeyRound } from 'lucide-react'
import { clientPortalApi } from '../../api/clientPortal'

export type ClientTab = 'inicio' | 'servico' | 'renovar' | 'indicar' | 'conta'

export type AssistantAction =
  | { type: 'tab'; label: string; tab: ClientTab }
  | { type: 'link'; label: string; url: string }
  | { type: 'whatsapp'; label: string; phone: string; message: string }
  | { type: 'copy'; label: string; text: string }
  | { type: 'openPinModal'; label: string }

export interface AssistantReply {
  reply: string
  suggestions: string[]
  actions?: AssistantAction[]
  autoActions?: AssistantAction[]
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  suggestions?: string[]
  actions?: AssistantAction[]
}

function formatReply(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 ? <br /> : null}
      </span>
    ))
  })
}

function waUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

interface ClientAssistantBotProps {
  onOpenTab?: (tab: ClientTab) => void
  onOpenPinModal?: () => void
  onCopy?: (text: string) => void | Promise<void>
}

export function ClientAssistantBot({ onOpenTab, onOpenPinModal, onCopy }: ClientAssistantBotProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  const runAction = useCallback(
    async (action: AssistantAction, opts?: { closeChat?: boolean }) => {
      if (action.type === 'tab') {
        onOpenTab?.(action.tab)
        if (opts?.closeChat !== false) setOpen(false)
        return
      }
      if (action.type === 'link') {
        window.open(action.url, '_blank', 'noopener,noreferrer')
        return
      }
      if (action.type === 'whatsapp') {
        window.open(waUrl(action.phone, action.message), '_blank', 'noopener,noreferrer')
        return
      }
      if (action.type === 'copy') {
        if (onCopy) {
          await onCopy(action.text)
        } else {
          await navigator.clipboard.writeText(action.text)
        }
        return
      }
      if (action.type === 'openPinModal') {
        onOpenPinModal?.()
      }
    },
    [onOpenTab, onOpenPinModal, onCopy]
  )

  const pushAssistant = useCallback(
    (reply: AssistantReply) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.random()}`,
          role: 'assistant',
          text: reply.reply,
          suggestions: reply.suggestions,
          actions: reply.actions,
        },
      ])
      scrollToBottom()
      if (reply.autoActions?.length) {
        void (async () => {
          for (const action of reply.autoActions!) {
            await runAction(action, { closeChat: action.type === 'tab' })
          }
        })()
      }
    },
    [scrollToBottom, runAction]
  )

  const loadWelcome = useCallback(async () => {
    setLoading(true)
    try {
      const reply = await clientPortalApi.get<AssistantReply>('/api/client-portal/assistente/saudacao')
      pushAssistant(reply)
      setBootstrapped(true)
    } catch {
      pushAssistant({
        reply: 'Olá! Sou o assistente Rove+. Posso ajudar com renovação, credenciais e indicações.',
        suggestions: ['Quando renovo?', 'Ver credenciais', 'Falar com suporte'],
      })
      setBootstrapped(true)
    } finally {
      setLoading(false)
    }
  }, [pushAssistant])

  useEffect(() => {
    if (open && !bootstrapped) {
      void loadWelcome()
    }
  }, [open, bootstrapped, loadWelcome])

  useEffect(() => {
    if (open) {
      scrollToBottom()
      window.setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open, scrollToBottom])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: trimmed },
    ])
    setInput('')
    setLoading(true)
    scrollToBottom()

    try {
      const reply = await clientPortalApi.post<AssistantReply>('/api/client-portal/assistente', {
        message: trimmed,
      })
      pushAssistant(reply)
    } catch (e) {
      pushAssistant({
        reply: e instanceof Error ? e.message : 'Não foi possível obter resposta. Tente de novo.',
        suggestions: ['Menu', 'Falar com suporte'],
      })
    } finally {
      setLoading(false)
    }
  }

  function handleAction(action: AssistantAction) {
    void runAction(action)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void sendMessage(input)
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-[4.75rem] right-4 sm:right-6 z-50 flex flex-col w-[min(100vw-2rem,22rem)] h-[min(70vh,28rem)] rounded-2xl border border-sky-500/30 bg-netflix-card/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
            role="dialog"
            aria-label="Assistente Rove+"
          >
            <header className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] bg-gradient-to-r from-sky-950/40 to-netflix-card shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 border border-sky-500/30">
                <Bot className="w-5 h-5 text-sky-300" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">Assistente Rove+</p>
                <p className="text-[11px] text-gray-500">Renovação, credenciais e suporte</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                aria-label="Fechar assistente"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 [scrollbar-width:thin]">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-primary-600/90 text-white rounded-br-md'
                        : 'bg-netflix-panel/90 text-gray-200 border border-white/[0.06] rounded-bl-md'
                    }`}
                  >
                    {m.role === 'assistant' ? formatReply(m.text) : m.text}
                    {m.role === 'assistant' && m.actions && m.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/[0.06]">
                        {m.actions.map((action, idx) => (
                          <button
                            key={`${m.id}-action-${idx}`}
                            type="button"
                            onClick={() => handleAction(action)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                              action.type === 'whatsapp'
                                ? 'bg-green-600/25 text-green-200 hover:bg-green-600/40 border border-green-500/30'
                                : action.type === 'copy'
                                  ? 'bg-violet-600/20 text-violet-200 hover:bg-violet-600/35 border border-violet-500/25'
                                  : action.type === 'openPinModal'
                                    ? 'bg-amber-600/20 text-amber-200 hover:bg-amber-600/35 border border-amber-500/25'
                                    : 'bg-sky-600/20 text-sky-200 hover:bg-sky-600/35 border border-sky-500/25'
                            }`}
                          >
                            {action.type === 'whatsapp' ? (
                              <MessageCircle className="w-3 h-3" />
                            ) : action.type === 'copy' ? (
                              <Copy className="w-3 h-3" />
                            ) : action.type === 'openPinModal' ? (
                              <KeyRound className="w-3 h-3" />
                            ) : (
                              <ExternalLink className="w-3 h-3" />
                            )}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.suggestions.map((s) => (
                          <button
                            key={`${m.id}-s-${s}`}
                            type="button"
                            disabled={loading}
                            onClick={() => void sendMessage(s)}
                            className="px-2 py-0.5 rounded-full text-[11px] bg-white/[0.06] text-gray-300 hover:bg-white/[0.12] hover:text-white border border-white/[0.08] disabled:opacity-50"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-netflix-panel/80 border border-white/[0.06] text-gray-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    A escrever…
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="shrink-0 flex items-center gap-2 p-3 border-t border-white/[0.08] bg-netflix-bg/80"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escreva a sua pergunta…"
                maxLength={500}
                disabled={loading}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-netflix-panel border border-netflix-border text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 transition-colors shrink-0"
                aria-label="Enviar mensagem"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-5 right-4 sm:right-6 z-50">
        <motion.div
          className="relative inline-flex"
          initial={{ opacity: 0, x: 36, rotate: 8, scale: 0.85 }}
          animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        >
          {!open && (
            <>
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full border border-sky-400/30"
                animate={{ scale: [1, 1.55], opacity: [0.35, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full border border-sky-300/20"
                animate={{ scale: [1, 1.85], opacity: [0.2, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 1.2 }}
              />
              <motion.span
                aria-hidden
                className="pointer-events-none absolute -inset-1 rounded-full bg-sky-500/15 blur-md"
                animate={{ opacity: [0.25, 0.45, 0.25] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </>
          )}

          <motion.div
            animate={open ? { y: 0 } : { y: [0, -2, 0] }}
            transition={
              open
                ? { duration: 0.25 }
                : { duration: 4, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <motion.button
              type="button"
              onClick={() => setOpen((v) => !v)}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-semibold border overflow-hidden shadow-lg ${
                open
                  ? 'bg-sky-700 border-sky-400/30 shadow-black/30'
                  : 'bg-gradient-to-r from-sky-600 to-sky-700 border-sky-400/20 shadow-sky-950/30'
              }`}
              aria-expanded={open}
              aria-label={open ? 'Fechar assistente' : 'Abrir assistente Rove+'}
            >
              {!open && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                  animate={{ x: ['-130%', '230%'] }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    repeatDelay: 2.8,
                  }}
                />
              )}

              <AnimatePresence mode="wait" initial={false}>
                {open ? (
                  <motion.span
                    key="close"
                    initial={{ opacity: 0, rotate: -72, scale: 0.7 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 72, scale: 0.7 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    className="relative inline-flex"
                  >
                    <X className="w-4 h-4" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="bot"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1, rotate: [0, -5, 5, 0] }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{
                      opacity: { duration: 0.2 },
                      scale: { type: 'spring', stiffness: 400, damping: 22 },
                      rotate: { duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 },
                    }}
                    className="relative inline-flex"
                  >
                    <Bot className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>

              <motion.span
                key={open ? 'fechar' : 'assistente'}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="relative"
              >
                {open ? 'Fechar' : 'Assistente'}
              </motion.span>
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}
