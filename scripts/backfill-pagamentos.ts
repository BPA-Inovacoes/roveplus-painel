/**
 * Cria o histórico inicial de pagamentos para clientes que ainda não têm nenhum.
 * Para cada cliente (exceto cancelados) gera 1 Pagamento "inicial" com os meses entre
 * data início e data fim (máx. 24), terminando exatamente na data fim atual.
 * Meses já terminados ficam marcados como notificados (não geram WhatsApp).
 *
 * Uso:
 *   npx tsx scripts/backfill-pagamentos.ts          → só mostra o que faria
 *   npx tsx scripts/backfill-pagamentos.ts --apply  → grava na base de dados
 */
import 'dotenv/config'
import { prisma } from '../server/lib/prisma.js'
import {
  addMonthsKeepingBillingDay,
  ensurePagamentosTables,
  mesesEntre,
  registarPagamentoCliente,
} from '../server/lib/pagamentos.js'

const apply = process.argv.includes('--apply')

async function main() {
  await ensurePagamentosTables()
  const clients = await prisma.client.findMany({
    where: { status: { not: 'cancelado' }, pagamentos: { none: {} } },
    select: { id: true, nome: true, dataInicio: true, dataFim: true, valor: true },
    orderBy: { id: 'asc' },
  })
  console.log(`${clients.length} cliente(s) sem histórico de pagamentos.${apply ? '' : ' (simulação — use --apply para gravar)'}`)
  for (const c of clients) {
    const meses = Math.min(24, mesesEntre(c.dataInicio, c.dataFim))
    const inicio = addMonthsKeepingBillingDay(c.dataFim, -meses)
    console.log(
      `#${c.id} ${c.nome}: ${meses} mês(es) ${inicio.toLocaleDateString('pt-PT')} → ${c.dataFim.toLocaleDateString('pt-PT')}`
    )
    if (!apply) continue
    await registarPagamentoCliente({
      clientId: c.id,
      meses,
      inicio,
      fim: c.dataFim,
      dataPagamento: c.dataInicio,
      observacoes: 'Histórico inicial (migrado de data início → data fim do cliente)',
      origem: 'inicial',
    })
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
