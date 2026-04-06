import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import { auditLog } from '../middleware/audit.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  const { status } = req.query
  const where = status ? { status: String(status) } : {}
  const list = await prisma.indicacao.findMany({
    where,
    include: { indicador: { select: { id: true, nome: true, whatsapp: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(list)
})

router.post('/', auditLog('create_indicacao', 'indicacao'), async (req, res) => {
  const { indicadorId, indicadoNome, indicadoWhatsapp } = req.body
  const idIndicador = Number(indicadorId)
  if (!Number.isFinite(idIndicador) || idIndicador < 1) {
    return res.status(400).json({ error: 'Cliente indicador inválido' })
  }
  const nome = String(indicadoNome ?? '').trim()
  if (nome.length < 2) {
    return res.status(400).json({ error: 'Nome do indicado deve ter pelo menos 2 caracteres' })
  }
  const existe = await prisma.client.findUnique({ where: { id: idIndicador }, select: { id: true } })
  if (!existe) {
    return res.status(404).json({ error: 'Cliente indicador não encontrado' })
  }
  const indicacao = await prisma.indicacao.create({
    data: {
      indicadorId: idIndicador,
      indicadoNome: nome,
      indicadoWhatsapp: String(indicadoWhatsapp ?? '').trim(),
      status: 'pendente',
    },
  })
  await prisma.client.update({
    where: { id: idIndicador },
    data: { indicacoes: { increment: 1 } },
  })
  res.status(201).json(indicacao)
})

router.patch('/:id', auditLog('update_indicacao', 'indicacao'), async (req, res) => {
  const id = Number(req.params.id)
  const { status, indicadoNome, indicadoWhatsapp } = req.body
  const data: { status?: string; indicadoNome?: string; indicadoWhatsapp?: string } = {}
  if (status != null) data.status = String(status)
  if (indicadoNome != null) data.indicadoNome = String(indicadoNome).trim()
  if (indicadoWhatsapp != null) data.indicadoWhatsapp = String(indicadoWhatsapp).trim()
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' })
  const indicacao = await prisma.indicacao.update({
    where: { id },
    data,
  })
  res.json(indicacao)
})

router.delete('/:id', auditLog('delete_indicacao', 'indicacao'), async (req, res) => {
  const ind = await prisma.indicacao.findUnique({ where: { id: Number(req.params.id) } })
  if (ind) {
    await prisma.client.update({
      where: { id: ind.indicadorId },
      data: { indicacoes: { decrement: 1 } },
    })
  }
  await prisma.indicacao.delete({ where: { id: Number(req.params.id) } })
  res.status(204).send()
})

export default router
