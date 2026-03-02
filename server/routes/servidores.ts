import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, canAccessServidores } from '../middleware/auth.js'
import type { AuthPayload } from '../middleware/auth.js'
import { auditLog } from '../middleware/audit.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessServidores(user.role)) return res.status(403).json({ error: 'Sem acesso a servidores' })
  const list = await prisma.servidor.findMany({
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { clients: true } },
      servidor: { select: { id: true, nome: true } },
    },
  })
  res.json(
    list.map((s) => {
      const { _count, servidor, ...rest } = s
      return { ...rest, totalClientes: _count.clients, servidor }
    })
  )
})

router.get('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessServidores(user.role)) return res.status(403).json({ error: 'Sem acesso a servidores' })
  const s = await prisma.servidor.findUnique({
    where: { id: Number(req.params.id) },
    include: { clients: true },
  })
  if (!s) return res.status(404).json({ error: 'Servidor não encontrado' })
  res.json(s)
})

router.post('/', auditLog('create_servidor', 'servidor'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessServidores(user.role)) return res.status(403).json({ error: 'Sem acesso a servidores' })
  const { nome, tipo, status, servidorId } = req.body
  const data: Record<string, unknown> = {
    nome: nome || 'Novo servidor',
    tipo: tipo || 'principal',
    status: status || 'online',
  }
  if (tipo === 'secundario' && servidorId) data.servidorId = Number(servidorId)
  else if (tipo !== 'secundario') data.servidorId = null
  const servidor = await prisma.servidor.create({ data: data as never })
  res.status(201).json(servidor)
})

router.patch('/:id', auditLog('update_servidor', 'servidor'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessServidores(user.role)) return res.status(403).json({ error: 'Sem acesso a servidores' })
  const id = Number(req.params.id)
  const { nome, tipo, status, servidorId } = req.body
  const update: Record<string, unknown> = {}
  if (nome != null) update.nome = nome
  if (tipo != null) update.tipo = tipo
  if (status != null) update.status = status
  if (tipo === 'secundario' && servidorId != null) update.servidorId = Number(servidorId)
  else if (tipo !== 'secundario') update.servidorId = null
  const servidor = await prisma.servidor.update({ where: { id }, data: update })
  res.json(servidor)
})

router.delete('/:id', auditLog('delete_servidor', 'servidor'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user
  if (!canAccessServidores(user.role)) return res.status(403).json({ error: 'Sem acesso a servidores' })
  await prisma.servidor.delete({ where: { id: Number(req.params.id) } })
  res.status(204).send()
})

export default router
