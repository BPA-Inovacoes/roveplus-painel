// Integração WhatsApp Business
// Número: +244 933623143
// Para envio automático: configurar WhatsApp Cloud API (Meta) ou Twilio e definir
// WHATSAPP_API_URL + WHATSAPP_TOKEN nas variáveis de ambiente.

const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE || '244933623143'

function formatPhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0/, '')
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  const phone = formatPhone(to)
  const apiUrl = process.env.WHATSAPP_API_URL
  const token = process.env.WHATSAPP_TOKEN
  if (!apiUrl || !token) {
    console.log('[WhatsApp] (não configurado) Para:', phone, 'Mensagem:', message)
    return false
  }
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
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

// Mensagens automáticas (chamar após cadastro, renovação, etc.)
export const templates = {
  clienteCadastrado: (nome: string, dataFim: string) =>
    `Olá ${nome}! Bem-vindo(a) à Rove+. A sua assinatura renova em ${dataFim}. Qualquer dúvida, estamos à disposição.`,
  lembrete3Dias: (nome: string, dataFim: string) =>
    `Olá ${nome}! A sua assinatura Rove+ renova em 3 dias (${dataFim}). Renove para continuar sem interrupções.`,
  vencido: (nome: string) =>
    `Olá ${nome}! A sua assinatura Rove+ venceu. Renove para reativar o serviço.`,
  renovado: (nome: string, dataFim: string) =>
    `Olá ${nome}! A sua renovação foi confirmada. Próxima data: ${dataFim}. Obrigado!`,
}
