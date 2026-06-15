const NETFLIX_LOGIN_URL = 'https://www.netflix.com/login'

export type AssistantAction =
  | { type: 'tab'; label: string; tab: 'servico' | 'renovar' | 'indicar' | 'conta' | 'inicio' }
  | { type: 'link'; label: string; url: string }
  | { type: 'whatsapp'; label: string; phone: string; message: string }
  | { type: 'copy'; label: string; text: string }
  | { type: 'openPinModal'; label: string }

export interface AssistantReply {
  reply: string
  suggestions: string[]
  actions?: AssistantAction[]
  /** Executadas automaticamente no site ao receber a resposta */
  autoActions?: AssistantAction[]
}

export interface ClientAssistantContext {
  nome: string
  whatsapp: string
  servico: string
  plano: string
  status: string
  dataFim: Date
  valor: number
  perfil: string | null
  pin: string | null
  iptvUser: string | null
  iptvPass: string | null
  iptvMac: string | null
  iptvM3u: string | null
  inscricaoPaga: boolean | null
  indicacoes: number
  portalFirstLogin: boolean
  roveId: string | null
  diasRestantes: number
}

const WA_BUSINESS = process.env.WHATSAPP_PHONE || '244933623143'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function matches(text: string, ...keywords: string[]): boolean {
  const n = normalize(text)
  return keywords.some((k) => n.includes(normalize(k)))
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR')
}

function formatValor(v: number): string {
  return `${Number(v).toLocaleString('pt-BR')} kz`
}

function buildRenewMessage(ctx: ClientAssistantContext): string {
  const lines = [
    'Olá Rove+, quero renovar o meu plano.',
    `Cliente: ${ctx.nome}`,
    `Plano: ${ctx.plano} (${ctx.servico === 'netflix' ? 'Netflix' : 'IPTV'})`,
    `Vencimento: ${formatDate(ctx.dataFim)}`,
    `Valor mensal: ${formatValor(ctx.valor)}`,
  ]
  if (ctx.roveId) lines.push(`ID ROVE: ${ctx.roveId}`)
  return lines.join('\n')
}

function buildSupportMessage(ctx: ClientAssistantContext): string {
  return [
    'Olá Rove+, preciso de ajuda com a minha conta.',
    `Cliente: ${ctx.nome}`,
    ctx.roveId ? `ID ROVE: ${ctx.roveId}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function getAssistantWelcome(ctx: ClientAssistantContext): AssistantReply {
  const firstName = ctx.nome.split(/\s+/)[0]
  const suggestions = ['Quando renovo?', 'Ver credenciais', 'Como indicar amigo?', 'Falar com suporte']

  if (ctx.portalFirstLogin) {
    return {
      reply: `Olá, ${firstName}! Sou o assistente Rove+. Por segurança, altere o seu PIN de acesso antes de continuar (aba Conta). Posso ajudar com renovação, credenciais e indicações.`,
      suggestions: ['Alterar PIN', 'Quando renovo?', 'Ver credenciais'],
      actions: [{ type: 'tab', label: 'Alterar PIN', tab: 'conta' }],
    }
  }

  if (ctx.status === 'vencido' || ctx.diasRestantes <= 7) {
    return {
      reply: `Olá, ${firstName}! A sua subscrição ${ctx.status === 'vencido' ? 'está vencida' : `vence em ${Math.max(0, ctx.diasRestantes)} dia(s)`} (${formatDate(ctx.dataFim)}). Posso ajudar a renovar ou esclarecer dúvidas sobre o serviço.`,
      suggestions: ['Pedir renovação', 'Qual o meu plano?', 'Ver credenciais', 'Falar com suporte'],
      actions: [
        {
          type: 'whatsapp',
          label: 'Pedir renovação',
          phone: WA_BUSINESS,
          message: buildRenewMessage(ctx),
        },
        { type: 'tab', label: 'Ver renovação', tab: 'renovar' },
      ],
    }
  }

  return {
    reply: `Olá, ${firstName}! Sou o assistente Rove+. Posso **abrir secções**, **copiar credenciais**, **alterar PIN** e **pedir renovação** por si. O que precisa?`,
    suggestions,
  }
}

function buildCredentialsText(ctx: ClientAssistantContext): string {
  if (ctx.servico === 'netflix') {
    return [
      ctx.perfil ? `Perfil: ${ctx.perfil}` : null,
      ctx.pin ? `PIN: ${ctx.pin}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    ctx.perfil || ctx.iptvUser ? `Utilizador: ${ctx.perfil || ctx.iptvUser}` : null,
    ctx.iptvPass ? `Senha: ${ctx.iptvPass}` : null,
    ctx.iptvMac ? `MAC: ${ctx.iptvMac}` : null,
    ctx.iptvM3u ? `M3U: ${ctx.iptvM3u}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

type AssistantTab = 'servico' | 'renovar' | 'indicar' | 'conta' | 'inicio'

function tabFromNavigationMsg(msg: string): AssistantTab | null {
  if (matches(msg, 'renov')) return 'renovar'
  if (matches(msg, 'indic')) return 'indicar'
  if (matches(msg, 'conta', 'segur')) return 'conta'
  if (matches(msg, 'inicio', 'início', 'home')) return 'inicio'
  if (matches(msg, 'servico', 'serviço', 'netflix', 'iptv', 'credenc')) return 'servico'
  return null
}

export function getAssistantReply(ctx: ClientAssistantContext, rawMessage: string): AssistantReply {
  const msg = rawMessage.trim()
  if (!msg) return getAssistantWelcome(ctx)

  const whatsappRenew = (): AssistantAction => ({
    type: 'whatsapp',
    label: 'Pedir renovação no WhatsApp',
    phone: WA_BUSINESS,
    message: buildRenewMessage(ctx),
  })

  const whatsappSupport = (): AssistantAction => ({
    type: 'whatsapp',
    label: 'Falar com a equipa',
    phone: WA_BUSINESS,
    message: buildSupportMessage(ctx),
  })

  if (matches(msg, 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'ajuda', 'menu', 'inicio', 'começar', 'comecar')) {
    return getAssistantWelcome(ctx)
  }

  if (matches(msg, 'abrir', 'ir para', 'mostrar', 'ver aba', 'aba', 'va para', 'vá para')) {
    const dest = tabFromNavigationMsg(msg)
    if (dest) {
      const labels: Record<string, string> = {
        renovar: 'Renovar',
        servico: ctx.servico === 'netflix' ? 'Netflix' : 'IPTV',
        indicar: 'Indicar',
        conta: 'Conta',
        inicio: 'Início',
      }
      return {
        reply: `A abrir a secção **${labels[dest]}**…`,
        suggestions: ['Ver credenciais', 'Quando renovo?', 'Menu'],
        autoActions: [{ type: 'tab', label: labels[dest], tab: dest }],
      }
    }
  }

  if (matches(msg, 'copia', 'copiar')) {
    if (matches(msg, 'pin') && ctx.pin) {
      return {
        reply: 'Copiei o **PIN do perfil Netflix** para a área de transferência.',
        suggestions: ['Abrir Netflix', 'Ver credenciais'],
        actions: [{ type: 'link', label: 'Abrir Netflix', url: NETFLIX_LOGIN_URL }],
        autoActions: [{ type: 'copy', label: 'PIN Netflix', text: ctx.pin }],
      }
    }
    if (matches(msg, 'm3u') && ctx.iptvM3u) {
      return {
        reply: 'Copiei a **lista M3U** para a área de transferência.',
        suggestions: ['Ver credenciais', 'Falar com suporte'],
        autoActions: [{ type: 'copy', label: 'M3U', text: ctx.iptvM3u }],
      }
    }
    if (matches(msg, 'rove', 'id') && ctx.roveId) {
      return {
        reply: `Copiei o **ID ROVE** (${ctx.roveId}).`,
        suggestions: ['Falar com suporte', 'Estado da conta'],
        autoActions: [{ type: 'copy', label: 'ID ROVE', text: ctx.roveId }],
      }
    }
    if (matches(msg, 'senha', 'password') && ctx.iptvPass) {
      return {
        reply: 'Copiei a **senha IPTV** para a área de transferência.',
        suggestions: ['Copiar credenciais', 'Ver credenciais'],
        autoActions: [{ type: 'copy', label: 'Senha IPTV', text: ctx.iptvPass }],
      }
    }
    const creds = buildCredentialsText(ctx)
    if (matches(msg, 'credenc', 'tudo', 'dados', 'utilizador', 'linha') && creds) {
      return {
        reply: 'Copiei as **credenciais** para a área de transferência.',
        suggestions: ['Ver credenciais', 'Quando renovo?'],
        actions: [{ type: 'tab', label: 'Ver credenciais', tab: 'servico' }],
        autoActions: [{ type: 'copy', label: 'Credenciais', text: creds }],
      }
    }
  }

  if (matches(msg, 'pedir renovacao', 'pedir renovação')) {
    return {
      reply: 'A abrir o WhatsApp com a mensagem de renovação pré-preenchida…',
      suggestions: ['Ver renovação', 'Estado da conta'],
      autoActions: [whatsappRenew()],
    }
  }

  if (matches(msg, 'renov', 'venc', 'pagar', 'pagamento', 'data fim', 'quando renovo', 'expir')) {
    const dias = Math.max(0, ctx.diasRestantes)
    let estado = ''
    if (ctx.status === 'cancelado') estado = 'A sua conta está cancelada.'
    else if (ctx.status === 'vencido') estado = 'A subscrição está vencida — renove para reativar o acesso.'
    else if (dias === 0) estado = 'A subscrição vence hoje.'
    else if (dias <= 7) estado = `Faltam ${dias} dia(s) para a renovação.`
    else estado = `Faltam ${dias} dia(s). Está tudo em dia por agora.`

    return {
      reply: [
        estado,
        `Plano: ${ctx.plano} (${ctx.servico === 'netflix' ? 'Netflix' : 'IPTV'})`,
        `Próxima data: ${formatDate(ctx.dataFim)}`,
        `Valor mensal: ${formatValor(ctx.valor)}`,
        'Para renovar, use o WhatsApp da Rove+ ou a aba Renovar.',
      ].join('\n'),
      suggestions: ['Pedir renovação', 'Qual o meu plano?', 'Falar com suporte'],
      actions: [whatsappRenew(), { type: 'tab', label: 'Abrir aba Renovar', tab: 'renovar' }],
    }
  }

  if (matches(msg, 'plano', 'valor', 'preco', 'preço', 'quanto pago', 'mensal')) {
    return {
      reply: `O seu plano é **${ctx.plano}** (${ctx.servico === 'netflix' ? 'Netflix' : 'IPTV'}), com valor mensal de **${formatValor(ctx.valor)}**. Renovação em ${formatDate(ctx.dataFim)}.`,
      suggestions: ['Pedir renovação', 'Ver credenciais', 'Estado da conta'],
    }
  }

  if (matches(msg, 'estado', 'status', 'conta', 'ativo', 'cancelado')) {
    const statusLabel =
      ctx.status === 'ativo' ? 'Ativa' : ctx.status === 'vencido' ? 'Vencida' : ctx.status === 'cancelado' ? 'Cancelada' : ctx.status
    return {
      reply: `Estado da conta: **${statusLabel}**. Serviço: ${ctx.servico === 'netflix' ? 'Netflix' : 'IPTV'}. ${ctx.roveId ? `ID ROVE: ${ctx.roveId}.` : ''}`,
      suggestions: ['Quando renovo?', 'Ver credenciais', 'Falar com suporte'],
    }
  }

  if (matches(msg, 'credenc', 'utilizador', 'senha', 'password', 'login', 'acesso', 'm3u', 'mac', 'linha', 'dados')) {
    if (ctx.servico === 'netflix') {
      const parts = [
        'As credenciais Netflix estão na aba **Netflix** (Serviço):',
        ctx.perfil ? `• Perfil: ${ctx.perfil}` : null,
        ctx.pin ? `• PIN do perfil: ${ctx.pin}` : null,
        `• Abrir Netflix: ${NETFLIX_LOGIN_URL}`,
        'Use o botão «Copiar» na aba para guardar o PIN.',
      ].filter(Boolean)
      return {
        reply: parts.join('\n'),
        suggestions: ['Abrir Netflix', 'Alterar PIN área cliente', 'Falar com suporte'],
        actions: [
          { type: 'tab', label: 'Ver credenciais', tab: 'servico' },
          { type: 'link', label: 'Abrir Netflix', url: NETFLIX_LOGIN_URL },
        ],
      }
    }

    const parts = [
      'As credenciais IPTV estão na aba **IPTV** (Serviço):',
      ctx.perfil || ctx.iptvUser ? `• Utilizador: ${ctx.perfil || ctx.iptvUser}` : null,
      ctx.iptvPass ? `• Senha: ${ctx.iptvPass}` : ctx.iptvPass === null ? '• Senha: contacte a Rove+ se não aparecer' : null,
      ctx.iptvMac ? `• MAC: ${ctx.iptvMac}` : null,
      ctx.iptvM3u ? '• Lista M3U disponível para copiar' : null,
      'Na aba Serviço pode copiar cada campo ou «Copiar tudo».',
    ].filter(Boolean)

    return {
      reply: parts.join('\n'),
      suggestions: ['Como usar M3U?', 'Quando renovo?', 'Falar com suporte'],
      actions: [{ type: 'tab', label: 'Ver credenciais IPTV', tab: 'servico' }],
    }
  }

  if (ctx.servico === 'netflix' && matches(msg, 'netflix', 'perfil', 'pin netflix')) {
    return getAssistantReply(ctx, 'credenciais')
  }

  if (matches(msg, 'm3u', 'lista', 'app iptv', 'smart tv iptv')) {
    if (ctx.servico !== 'iptv') {
      return {
        reply: 'O serviço M3U aplica-se a clientes IPTV. O seu serviço é Netflix — use a aba Netflix para ver o perfil e PIN.',
        suggestions: ['Ver credenciais', 'Abrir Netflix'],
        actions: [{ type: 'tab', label: 'Ver Netflix', tab: 'servico' }],
      }
    }
    return {
      reply: ctx.iptvM3u
        ? 'Copie a lista M3U na aba IPTV e cole na app do seu dispositivo (Smarters, XCIPTV, etc.). Se precisar de ajuda na instalação, fale connosco no WhatsApp.'
        : 'Ainda não há lista M3U registada na sua conta. Peça à equipa Rove+ pelo WhatsApp.',
      suggestions: ['Ver credenciais', 'Falar com suporte'],
      actions: [{ type: 'tab', label: 'Ver M3U', tab: 'servico' }, whatsappSupport()],
    }
  }

  if (matches(msg, 'pin area', 'pin da area', 'alterar pin', 'mudar pin', 'trocar pin', 'primeiro acesso')) {
    const abrirJa = matches(msg, 'alterar', 'mudar', 'trocar', 'primeiro')
    return {
      reply: abrirJa
        ? 'A abrir o formulário para **alterar o PIN** da área cliente…'
        : 'O PIN da área cliente protege o login em /cliente (mín. 6 caracteres). Se esqueceu, use «Recuperar PIN» na página de login.',
      suggestions: ['Alterar PIN', 'Recuperar PIN', 'Falar com suporte'],
      actions: [{ type: 'openPinModal', label: 'Alterar PIN agora' }],
      autoActions: abrirJa ? [{ type: 'openPinModal', label: 'Alterar PIN' }] : undefined,
    }
  }

  if (matches(msg, 'indic', 'amigo', 'refer', 'convidar')) {
    return {
      reply: `Na aba **Indicar** registe o nome e WhatsApp de quem quer indicar. Já tem **${ctx.indicacoes}** indicação(ões) registada(s). A equipa valida antes de contactar a pessoa.`,
      suggestions: ['Abrir indicações', 'Quando renovo?'],
      actions: [{ type: 'tab', label: 'Indicar amigo', tab: 'indicar' }],
    }
  }

  if (matches(msg, 'rove', 'id rove', 'referencia', 'referência')) {
    return {
      reply: ctx.roveId
        ? `O seu ID ROVE é **${ctx.roveId}**. Use-o quando falar connosco no WhatsApp.`
        : 'O ID ROVE será gerado automaticamente. Atualize a página ou contacte o suporte se não aparecer.',
      suggestions: ['Copiar ID ROVE', 'Falar com suporte', 'Estado da conta'],
      actions: ctx.roveId
        ? [{ type: 'copy', label: 'Copiar ID ROVE', text: ctx.roveId }]
        : undefined,
    }
  }

  if (matches(msg, 'whatsapp', 'suporte', 'humano', 'atendente', 'pessoa', 'equipa', 'falar')) {
    return {
      reply: 'Posso transferir para a equipa Rove+ no WhatsApp. Descreva o assunto na mensagem — respondemos o mais breve possível.',
      suggestions: ['Pedir renovação', 'Ver credenciais'],
      actions: [whatsappSupport()],
    }
  }

  if (matches(msg, 'site', 'rove plus', 'rove+', 'planos site')) {
    const site = process.env.ROVE_PUBLIC_SITE_URL || 'https://roveplus-bpa.vercel.app/'
    return {
      reply: `Visite o site da Rove+ para ver planos e novidades: ${site}`,
      suggestions: ['Pedir renovação', 'Quando renovo?'],
      actions: [{ type: 'link', label: 'Abrir site Rove+', url: site }],
    }
  }

  if (ctx.servico === 'netflix' && matches(msg, 'abrir netflix', 'entrar netflix', 'link netflix')) {
    return {
      reply: `Abra a Netflix em: ${NETFLIX_LOGIN_URL}\nEscolha o perfil **${ctx.perfil || 'indicado na aba Serviço'}** e use o PIN se pedido.`,
      suggestions: ['Ver credenciais', 'Qual o meu PIN?'],
      actions: [
        { type: 'link', label: 'Abrir Netflix', url: NETFLIX_LOGIN_URL },
        { type: 'tab', label: 'Ver perfil e PIN', tab: 'servico' },
      ],
    }
  }

  if (matches(msg, 'inscri', 'taxa', 'entrada')) {
    if (ctx.servico !== 'netflix') {
      return {
        reply: 'A taxa de inscrição aplica-se a planos Netflix. O seu serviço é IPTV — não há inscrição separada.',
        suggestions: ['Ver credenciais', 'Quando renovo?'],
      }
    }
    const pago = ctx.inscricaoPaga === true ? 'Sim, inscrição paga.' : ctx.inscricaoPaga === false ? 'Inscrição ainda pendente — fale connosco.' : 'Estado da inscrição não registado.'
    return {
      reply: `Inscrição Netflix: ${pago}`,
      suggestions: ['Falar com suporte', 'Ver credenciais'],
      actions: [whatsappSupport()],
    }
  }

  return {
    reply:
      'Não tenho a certeza sobre isso. Experimente perguntar sobre **renovação**, **credenciais**, **PIN**, **indicações** ou peça para **falar com suporte**.',
    suggestions: ['Quando renovo?', 'Ver credenciais', 'Falar com suporte', 'Menu'],
    actions: [whatsappSupport()],
  }
}
