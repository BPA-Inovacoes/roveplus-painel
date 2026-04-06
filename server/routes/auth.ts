import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthPayload } from '../middleware/auth.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 dias

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha obrigatórios' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      select: { id: true, nome: true, email: true, role: true, password: true },
    })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Email ou senha incorretos' })
    }
    let status = 'ativo'
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
        'SELECT status FROM "User" WHERE id = $1',
        user.id
      )
      status = rows[0]?.status ?? 'ativo'
    } catch {
      // coluna status pode não existir na BD; assumir ativo
    }
    if (status === 'suspenso') {
      return res.status(403).json({ error: 'Conta suspensa. Contacte o administrador.' })
    }
    const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
    res.cookie('token', token, { httpOnly: true, maxAge: COOKIE_MAX_AGE, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' })
    res.json({ user: { id: user.id, nome: user.nome, email: user.email, role: user.role } })
  } catch (err) {
    console.error('Login error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    if (/connect|ECONNREFUSED|timeout|Connection|P1001|P1002|P1017/i.test(msg)) {
      return res.status(503).json({ error: 'Sem ligação à base de dados. Verifique DATABASE_URL na Vercel.' })
    }
    return res.status(500).json({
      error: 'Erro ao iniciar sessão. Tente novamente.',
      detail: msg,
    })
  }
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', authMiddleware, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nome: true, email: true, role: true, whatsapp: true },
  })
  if (!user) return res.status(401).json({ error: 'Utilizador não encontrado' })
  res.json(user)
})

/** Atualizar o próprio perfil (nome, email, WhatsApp, senha). Não altera perfil/role. */
router.patch('/me', authMiddleware, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user
  const { nome, email, whatsapp, currentPassword, newPassword } = req.body as Record<string, unknown>

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  })
  if (!existing) return res.status(401).json({ error: 'Utilizador não encontrado' })

  const wantsPasswordChange =
    newPassword != null && String(newPassword).length > 0
  if (wantsPasswordChange) {
    if (!currentPassword || !(await bcrypt.compare(String(currentPassword), existing.password))) {
      return res.status(400).json({ error: 'Senha atual incorreta' })
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' })
    }
  }

  const data: { nome?: string; email?: string; whatsapp?: string | null; password?: string } = {}
  if (nome != null) data.nome = String(nome).trim()
  if (email != null) {
    const emailNorm = String(email).trim().toLowerCase()
    const dup = await prisma.user.findFirst({ where: { email: emailNorm, NOT: { id: userId } } })
    if (dup) return res.status(400).json({ error: 'Email já utilizado' })
    data.email = emailNorm
  }
  if (whatsapp !== undefined) {
    data.whatsapp =
      whatsapp != null && String(whatsapp).trim() !== '' ? String(whatsapp).trim() : null
  }
  if (wantsPasswordChange) {
    data.password = await bcrypt.hash(String(newPassword), 10)
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nada para atualizar' })
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, nome: true, email: true, role: true, whatsapp: true },
  })
  res.json(user)
})

export default router
