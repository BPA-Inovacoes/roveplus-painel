import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'

const router = Router()

router.use(authMiddleware)
router.use(requireAdmin)

router.get('/', async (req, res) => {
  const { entity, action, userId, from, to, limit = '100' } = req.query
  const where: { entity?: string; action?: string; userId?: number; createdAt?: { gte?: Date; lte?: Date } } = {}
  if (entity && String(entity).trim()) where.entity = String(entity).trim()
  if (action && String(action).trim()) where.action = String(action).trim()
  if (userId != null && String(userId).trim()) where.userId = Number(userId)
  if (from != null && String(from).trim()) {
    const d = new Date(String(from))
    if (!isNaN(d.getTime())) {
      where.createdAt = where.createdAt ?? {}
      where.createdAt.gte = d
    }
  }
  if (to != null && String(to).trim()) {
    const d = new Date(String(to))
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999)
      where.createdAt = where.createdAt ?? {}
      where.createdAt.lte = d
    }
  }
  const list = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { id: true, nome: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 100, 500),
  })
  res.json(list)
})

export default router
