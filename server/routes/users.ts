import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import type { AuthPayload } from '../middleware/auth.js'

const router = Router()
const ROLES_OPERADORES = ['geral', 'netflix', 'iptv']

router.use(authMiddleware)
router.use(requireAdmin)

/** Garante que a coluna status existe em User */
async function ensureUserStatusColumn(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo'
  `)
}

/** Listar utilizadores (sem password) */
router.get('/', async (_req, res) => {
  await ensureUserStatusColumn().catch(() => {})
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, nome: true, email: true, role: true, createdAt: true },
  })
  let statusMap: Record<number, string> = {}
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; status: string }>>(
      'SELECT id, status FROM "User" ORDER BY id ASC'
    )
    statusMap = Object.fromEntries((rows ?? []).map((r) => [r.id, r.status]))
  } catch {
    // coluna status pode não existir
  }
  res.json(users.map((u) => ({ ...u, status: statusMap[u.id] ?? 'ativo' })))
})

/** Criar utilizador (apenas roles operador; nunca criar segundo admin) */
router.post('/', async (req, res) => {
  const { nome, email, password, role } = req.body
  if (!nome || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha obrigatórios' })
  }
  const r = String(role || 'geral').toLowerCase()
  if (!ROLES_OPERADORES.includes(r)) {
    return res.status(400).json({ error: 'Role deve ser geral, netflix ou iptv. Só pode existir um admin no sistema.' })
  }
  const emailNorm = String(email).trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: emailNorm } })
  if (existing) return res.status(400).json({ error: 'Email já utilizado' })
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { nome: String(nome), email: emailNorm, password: hash, role: r },
    select: { id: true, nome: true, email: true, role: true, createdAt: true },
  })
  res.status(201).json(user)
})

/** Suspender utilizador (não permitir suspender o último admin) */
router.post('/:id/suspender', async (req, res) => {
  const id = Number(req.params.id)
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Utilizador não encontrado' })
  if (existing.role === 'admin') {
    const adminsCount = await prisma.user.count({ where: { role: 'admin' } })
    if (adminsCount <= 1) {
      return res.status(400).json({ error: 'Não pode suspender o único administrador do sistema.' })
    }
  }
  try {
    await ensureUserStatusColumn()
    await prisma.$executeRawUnsafe('UPDATE "User" SET status = $1 WHERE id = $2', 'suspenso', id)
    const [row] = await prisma.$queryRawUnsafe<Array<{ id: number; nome: string; email: string; role: string; status: string; createdAt: Date }>>(
      'SELECT id, nome, email, role, status, "createdAt" FROM "User" WHERE id = $1',
      id
    )
    if (!row) return res.status(500).json({ error: 'Erro ao obter utilizador' })
    res.json({ id: row.id, nome: row.nome, email: row.email, role: row.role, status: row.status, createdAt: row.createdAt })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao suspender' })
  }
})

/** Ativar utilizador */
router.post('/:id/ativar', async (req, res) => {
  const id = Number(req.params.id)
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Utilizador não encontrado' })
  try {
    await ensureUserStatusColumn()
    await prisma.$executeRawUnsafe('UPDATE "User" SET status = $1 WHERE id = $2', 'ativo', id)
    const [row] = await prisma.$queryRawUnsafe<Array<{ id: number; nome: string; email: string; role: string; status: string; createdAt: Date }>>(
      'SELECT id, nome, email, role, status, "createdAt" FROM "User" WHERE id = $1',
      id
    )
    if (!row) return res.status(500).json({ error: 'Erro ao obter utilizador' })
    res.json({ id: row.id, nome: row.nome, email: row.email, role: row.role, status: row.status, createdAt: row.createdAt })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao ativar' })
  }
})

/** Atualizar utilizador (não permitir alterar role para admin; não permitir retirar role admin ao único admin) */
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { nome, email, role, password } = req.body
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Utilizador não encontrado' })
  const adminsCount = await prisma.user.count({ where: { role: 'admin' } })
  const newRole = role != null ? String(role).toLowerCase() : null
  if (newRole === 'admin') {
    return res.status(400).json({ error: 'Só pode existir um admin no sistema. Não é possível atribuir role admin.' })
  }
  if (existing.role === 'admin' && adminsCount <= 1 && newRole && newRole !== 'admin') {
    return res.status(400).json({ error: 'Não pode remover o único administrador do sistema.' })
  }
  const update: { nome?: string; email?: string; password?: string; role?: string } = {}
  if (nome != null) update.nome = String(nome)
  if (email != null) {
    const emailNorm = String(email).trim().toLowerCase()
    const dup = await prisma.user.findFirst({ where: { email: emailNorm, NOT: { id } } })
    if (dup) return res.status(400).json({ error: 'Email já utilizado' })
    update.email = emailNorm
  }
  if (newRole != null && ROLES_OPERADORES.includes(newRole)) update.role = newRole
  if (password != null && String(password).length > 0) update.password = await bcrypt.hash(String(password), 10)
  const user = await prisma.user.update({
    where: { id },
    data: update,
    select: { id: true, nome: true, email: true, role: true, createdAt: true },
  })
  res.json(user)
})

/** Eliminar utilizador (não permitir eliminar o último admin) */
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Utilizador não encontrado' })
  if (existing.role === 'admin') {
    const adminsCount = await prisma.user.count({ where: { role: 'admin' } })
    if (adminsCount <= 1) {
      return res.status(400).json({ error: 'Não pode eliminar o único administrador do sistema.' })
    }
  }
  await prisma.user.delete({ where: { id } })
  res.status(204).send()
})

export default router
