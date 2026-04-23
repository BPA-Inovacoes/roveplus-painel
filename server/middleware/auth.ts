import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

export interface AuthPayload {
  userId: number
  email: string
  role: string
}

const PANEL_STAFF_ROLES = new Set(['admin', 'geral', 'netflix', 'iptv', 'suporte'])

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado' })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload
    if (!PANEL_STAFF_ROLES.has(payload.role)) {
      return res.status(403).json({ error: 'Acesso recusado' })
    }
    ;(req as Request & { user: AuthPayload }).user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' })
  }
  next()
}

/** Roles: admin, geral (vê tudo), netflix (só clientes Netflix), iptv (só clientes IPTV). suporte = geral */
export function getRoleServicoFilter(role: string): 'netflix' | 'iptv' | null {
  if (role === 'admin' || role === 'geral' || role === 'suporte') return null
  if (role === 'netflix') return 'netflix'
  if (role === 'iptv') return 'iptv'
  return null // desconhecido = ver tudo
}

export function canAccessServico(role: string, servico: string): boolean {
  const filter = getRoleServicoFilter(role)
  if (!filter) return true
  return filter === servico
}

export function canAccessServidores(role: string): boolean {
  return role === 'admin' || role === 'geral' || role === 'iptv' || role === 'suporte'
}

/** Acesso à gestão de salas (Netflix Plano Room) */
export function canAccessSalas(role: string): boolean {
  return role === 'admin' || role === 'geral' || role === 'netflix' || role === 'suporte'
}
