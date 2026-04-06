import { Router, type Request } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { normalizeClientWhatsappKey } from '../services/whatsapp.js'
import { clientPortalMiddleware, type ClientPortalJwtPayload } from '../middleware/clientPortalAuth.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 dias

type ClientPortalReq = Request & { clientPortal: ClientPortalJwtPayload }

function diasAteDataFim(dataFim: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fim = new Date(dataFim)
  fim.setHours(0, 0, 0, 0)
  return Math.ceil((fim.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

async function findClientByWhatsappInput(input: string) {
  const key = normalizeClientWhatsappKey(input)
  if (key.length < 8) return null
  const rows = await prisma.client.findMany({ select: { id: true, whatsapp: true } })
  const hit = rows.find((r) => normalizeClientWhatsappKey(r.whatsapp) === key)
  if (!hit) return null
  return prisma.client.findUnique({ where: { id: hit.id } })
}

router.post('/login', async (req, res) => {
  const { whatsapp, pin } = req.body as { whatsapp?: string; pin?: string }
  if (!whatsapp || !pin) {
    return res.status(400).json({ error: 'WhatsApp e PIN são obrigatórios' })
  }
  try {
    const client = await findClientByWhatsappInput(String(whatsapp))
    if (!client?.portalPinHash) {
      return res.status(401).json({
        error: 'Dados incorretos ou área cliente não ativada. Peça o PIN à Rove+.',
      })
    }
    if (!(await bcrypt.compare(String(pin), client.portalPinHash))) {
      return res.status(401).json({ error: 'WhatsApp ou PIN incorretos.' })
    }
    if (client.status === 'cancelado') {
      return res.status(403).json({ error: 'Conta cancelada. Contacte a Rove+.' })
    }
    const payload: ClientPortalJwtPayload = { clientId: client.id, typ: 'client_portal' }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
    res.cookie('client_token', token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })
    res.json({ ok: true, client: { id: client.id, nome: client.nome } })
  } catch (e) {
    console.error('[client-portal] login', e)
    res.status(500).json({ error: 'Erro ao iniciar sessão' })
  }
})

router.post('/logout', (_req, res) => {
  res.clearCookie('client_token', { path: '/' })
  res.json({ ok: true })
})

router.get('/me', clientPortalMiddleware, async (req, res) => {
  const { clientId } = (req as Request & { clientPortal: ClientPortalJwtPayload }).clientPortal
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { sala: { select: { id: true, nome: true, dataFim: true } }, servidor: { select: { id: true, nome: true, status: true } }, revendedor: { select: { nome: true } } },
  })
  if (!client) return res.status(401).json({ error: 'Sessão inválida' })
  res.json({
    id: client.id,
    nome: client.nome,
    whatsapp: client.whatsapp,
    servico: client.servico,
    plano: client.plano,
    status: client.status,
    dataInicio: client.dataInicio,
    dataFim: client.dataFim,
    valor: Number(client.valor),
    perfil: client.perfil,
    pin: client.pin,
    localizacao: client.localizacao,
    sala: client.sala,
    servidor: client.servidor,
    revendedor: client.revendedor,
    iptvUser: client.iptvUser,
    iptvPassSet: !!(client.iptvPass && String(client.iptvPass).length > 0),
    iptvMac: client.iptvMac,
    iptvM3u: client.iptvM3u,
    inscricaoPaga: client.inscricaoPaga,
    indicacoes: client.indicacoes,
  })
})

/** Avisos gerados a partir do estado da conta (renovação, lembrete WhatsApp, indicações, etc.). */
router.get('/notificacoes', clientPortalMiddleware, async (req, res) => {
  const { clientId } = (req as ClientPortalReq).clientPortal
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      status: true,
      dataFim: true,
      whatsappNotificadoVencimentoAt: true,
    },
  })
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })

  const indicacoesPendentes = await prisma.indicacao.count({
    where: { indicadorId: clientId, status: 'pendente' },
  })

  const items: Array<{
    id: string
    tipo: 'info' | 'warning' | 'success' | 'danger'
    titulo: string
    mensagem: string
    em?: string
  }> = []

  const dias = diasAteDataFim(client.dataFim)
  const dataStr = new Date(client.dataFim).toLocaleDateString('pt-BR')

  if (client.status === 'cancelado') {
    items.push({
      id: 'conta-cancelada',
      tipo: 'danger',
      titulo: 'Conta cancelada',
      mensagem: 'A sua conta está cancelada. Contacte a Rove+ para mais informações.',
    })
  } else if (client.status === 'vencido') {
    items.push({
      id: 'subscricao-vencida',
      tipo: 'warning',
      titulo: 'Subscrição vencida',
      mensagem: `A renovação não foi efetuada. Data de fim: ${dataStr}. Fale connosco no WhatsApp para reativar o serviço.`,
    })
  } else if (client.status === 'ativo') {
    if (dias < 0) {
      items.push({
        id: 'data-fim-passou',
        tipo: 'warning',
        titulo: 'Renovação em atraso',
        mensagem: `A data de fim (${dataStr}) já passou. Renove o mais breve possível.`,
      })
    } else if (dias === 0) {
      items.push({
        id: 'renova-hoje',
        tipo: 'warning',
        titulo: 'Renovação hoje',
        mensagem: 'A sua subscrição vence hoje. Renove para manter o acesso sem interrupções.',
      })
    } else if (dias <= 3) {
      items.push({
        id: 'renova-curto',
        tipo: 'warning',
        titulo: 'Renovação muito próxima',
        mensagem: `Faltam ${dias} dia(s). Data de fim: ${dataStr}.`,
      })
    } else if (dias <= 7) {
      items.push({
        id: 'renova-7',
        tipo: 'warning',
        titulo: 'Renovação na próxima semana',
        mensagem: `Faltam ${dias} dias até ${dataStr}.`,
      })
    } else if (dias <= 30) {
      items.push({
        id: 'renova-30',
        tipo: 'info',
        titulo: 'Lembrete de renovação',
        mensagem: `Faltam ${dias} dias até a próxima data de renovação (${dataStr}).`,
      })
    } else {
      items.push({
        id: 'conta-ativa',
        tipo: 'success',
        titulo: 'Tudo em dia',
        mensagem: 'A sua subscrição está ativa. Obrigado por ser cliente Rove+.',
      })
    }
  }

  if (client.whatsappNotificadoVencimentoAt) {
    items.push({
      id: 'lembrete-whatsapp',
      tipo: 'info',
      titulo: 'Lembrete enviado por WhatsApp',
      mensagem: 'Enviámos um aviso de renovação para o seu número.',
      em: client.whatsappNotificadoVencimentoAt.toISOString(),
    })
  }

  if (indicacoesPendentes > 0) {
    items.push({
      id: 'indicacoes-pendentes',
      tipo: 'info',
      titulo: 'Indicações em análise',
      mensagem:
        indicacoesPendentes === 1
          ? 'Tem 1 indicação pendente de confirmação pela equipa.'
          : `Tem ${indicacoesPendentes} indicações pendentes de confirmação pela equipa.`,
    })
  }

  res.json({ items })
})

/** Lista de indicações feitas por este cliente (área /cliente). */
router.get('/indicacoes', clientPortalMiddleware, async (req, res) => {
  const { clientId } = (req as ClientPortalReq).clientPortal
  const list = await prisma.indicacao.findMany({
    where: { indicadorId: clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      indicadoNome: true,
      indicadoWhatsapp: true,
      status: true,
      createdAt: true,
    },
  })
  res.json(list)
})

/** Registar nova indicação (pendente até a equipa confirmar). */
router.post('/indicacoes', clientPortalMiddleware, async (req, res) => {
  const { clientId } = (req as ClientPortalReq).clientPortal
  const body = req.body as { indicadoNome?: string; indicadoWhatsapp?: string }
  const nome = String(body.indicadoNome ?? '').trim()
  const waRaw = String(body.indicadoWhatsapp ?? '').trim()
  if (nome.length < 2) {
    return res.status(400).json({ error: 'Indique o nome completo da pessoa indicada (mín. 2 caracteres).' })
  }
  if (!waRaw) {
    return res.status(400).json({ error: 'Indique o WhatsApp de quem vai ser contactado.' })
  }
  const keyNew = normalizeClientWhatsappKey(waRaw)
  if (keyNew.length < 8) {
    return res.status(400).json({ error: 'WhatsApp do indicado parece inválido. Use o número com indicativo.' })
  }
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
  if (client.status === 'cancelado') {
    return res.status(403).json({ error: 'Conta cancelada. Não é possível registar indicações.' })
  }
  const selfKey = normalizeClientWhatsappKey(client.whatsapp)
  if (keyNew === selfKey) {
    return res.status(400).json({ error: 'Não pode indicar o seu próprio número de WhatsApp.' })
  }
  const jaExistem = await prisma.indicacao.findMany({
    where: { indicadorId: clientId },
    select: { indicadoWhatsapp: true },
  })
  for (const row of jaExistem) {
    if (normalizeClientWhatsappKey(row.indicadoWhatsapp) === keyNew) {
      return res.status(400).json({ error: 'Já registou uma indicação com este WhatsApp.' })
    }
  }
  const indicacao = await prisma.indicacao.create({
    data: {
      indicadorId: clientId,
      indicadoNome: nome,
      indicadoWhatsapp: waRaw,
      status: 'pendente',
    },
  })
  await prisma.client.update({
    where: { id: clientId },
    data: { indicacoes: { increment: 1 } },
  })
  res.status(201).json(indicacao)
})

export default router
