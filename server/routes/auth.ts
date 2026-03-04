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
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT \'ativo\'').catch(() => {})
    const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Email ou senha incorretos' })
    }
    const statusRows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
      'SELECT status FROM "User" WHERE id = $1',
      user.id
    )
    const status = statusRows[0]?.status ?? 'ativo'
    if (status === 'suspenso') {
      return res.status(403).json({ error: 'Conta suspensa. Contacte o administrador.' })
    }
    const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
    res.cookie('token', token, { httpOnly: true, maxAge: COOKIE_MAX_AGE, sameSite: 'lax' })
    res.json({ user: { id: user.id, nome: user.nome, email: user.email, role: user.role } })
  } catch (err) {
    console.error('Login DB error:', err)
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('connect') || msg.includes('ECONNREFUSED') || msg.includes('timeout') || msg.includes('Connection')) {
      return res.status(503).json({ error: 'Sem ligação à base de dados. Verifique DATABASE_URL na Vercel.' })
    }
    return res.status(500).json({ error: 'Erro ao iniciar sessão. Tente novamente.' })
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
    select: { id: true, nome: true, email: true, role: true },
  })
  if (!user) return res.status(401).json({ error: 'Utilizador não encontrado' })
  res.json(user)
})

export default router
