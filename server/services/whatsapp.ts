// Integração WhatsApp Business
// Número: +244 933623143
// Para envio automático: configurar WhatsApp Cloud API (Meta) ou Twilio e definir
// WHATSAPP_API_URL + WHATSAPP_TOKEN nas variáveis de ambiente.

const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE || '244933623143'

/** Dígitos normalizados (evitar enviar duas vezes ao mesmo número na mesma operação). */
export function normalizeClientWhatsappKey(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0/, '')
}

/** Rodapé com contacto (todas as mensagens a clientes). */
function withFooter(core: string): string {
  const digits = WHATSAPP_PHONE.replace(/\D/g, '')
  return `${core.trim()}\n\n— Rove+\nDúvidas: https://wa.me/${digits}`
}

/** Corpo do lembrete (dias = dias de calendário até à data de renovação, 0 = hoje). */
function buildLembreteRenovacaoBody(nome: string, dataFim: string, dias: number): string {
  if (dias <= 0) {
    return `Olá ${nome}! A sua assinatura Rove+ vence hoje (${dataFim}). Renove o mais breve possível para manter o acesso.`
  }
  if (dias === 1) {
    return `Olá ${nome}! A sua assinatura Rove+ vence amanhã (${dataFim}). Renove para evitar interrupções.`
  }
  if (dias <= 3) {
    return `Olá ${nome}! A sua assinatura Rove+ renova em ${dias} dias (${dataFim}). Renove para continuar sem interrupções.`
  }
  return `Olá ${nome}! A sua assinatura Rove+ renova em ${dias} dias (${dataFim}). Aproveite para planear a renovação.`
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  const phone = normalizeClientWhatsappKey(to)
  const apiUrl = process.env.WHATSAPP_API_URL
  const token = process.env.WHATSAPP_TOKEN
  if (!apiUrl || !token) {
    console.log('[WhatsApp] (não configurado) Para:', phone, 'Mensagem:', message)
    return false
  }
  try {
    const baseUrl = apiUrl.replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone, message }),
    })
    return res.ok
  } catch (e) {
    console.error('[WhatsApp] Erro:', e)
    return false
  }
}

export function getBusinessPhone(): string {
  return WHATSAPP_PHONE
}

/**
 * Mensagens automáticas para clientes finais (cadastro, lembretes, renovação, etc.).
 * Todas incluem rodapé com link WhatsApp da Rove+.
 */
export const templates = {
  clienteCadastrado: (nome: string, dataFim: string) =>
    withFooter(
      `Olá ${nome}! Bem-vindo(a) à Rove+. A sua subscrição tem próxima renovação em ${dataFim}. Obrigado pela confiança.`
    ),

  /** Lembretes do cron (janela até 7 dias); dias = dias até dataFim (0 = hoje). */
  lembreteRenovacao: (nome: string, dataFim: string, dias: number) =>
    withFooter(buildLembreteRenovacaoBody(nome, dataFim, dias)),

  /** @deprecated Usar lembreteRenovacao; mantido para código legado. */
  lembrete3Dias: (nome: string, dataFim: string) =>
    withFooter(buildLembreteRenovacaoBody(nome, dataFim, 3)),

  /** @deprecated Usar lembreteRenovacao; mantido para código legado. */
  lembrete7Dias: (nome: string, dataFim: string, dias: number) =>
    withFooter(buildLembreteRenovacaoBody(nome, dataFim, dias)),

  pagamentoRegistado: (nome: string, dataFim: string) =>
    withFooter(
      `Olá ${nome}! Registámos o seu pagamento. O serviço mantém-se ativo; próxima renovação: ${dataFim}. Obrigado!`
    ),

  reativado: (nome: string, dataFim: string) =>
    withFooter(
      `Olá ${nome}! O seu serviço Rove+ foi reativado. Próxima data de renovação: ${dataFim}. Bom proveito!`
    ),

  /** Operador marcou o cliente como suspenso / vencido no painel. */
  servicoSuspenso: (nome: string) =>
    withFooter(
      `Olá ${nome}! O seu acesso Rove+ foi suspenso no nosso sistema. Para voltar a utilizar, regularize ou renove — estamos disponíveis para ajudar.`
    ),

  /** Período já passado (ex.: automações futuras). */
  periodoVencido: (nome: string) =>
    withFooter(`Olá ${nome}! A sua assinatura Rove+ está vencida. Renove para reativar o serviço.`),

  /** @deprecated Usar servicoSuspenso ou periodoVencido consoante o caso. */
  vencido: (nome: string) => templates.periodoVencido(nome),

  renovado: (nome: string, dataFim: string) =>
    withFooter(`Olá ${nome}! Renovação confirmada. Próxima data de renovação: ${dataFim}. Obrigado!`),
}
