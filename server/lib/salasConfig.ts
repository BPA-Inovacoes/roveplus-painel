import { prisma } from './prisma.js'

/**
 * Salas Netflix: cada conta (sala) custa 11 000 kz/mês.
 * O orçamento mensal das salas = nº de salas ativas × custo por sala (não há limite de salas).
 * SALA_NETFLIX_CUSTO_MENSAL (env) permite alterar o custo sem mexer no código.
 */
export function salaCustoMensal(): number {
  const fromEnv = Number(process.env.SALA_NETFLIX_CUSTO_MENSAL)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 11000
}

export function orcamentoMensalSalas(totalSalasAtivas: number): number {
  return totalSalasAtivas * salaCustoMensal()
}

/** Cada sala (conta Netflix) tem no máximo 5 clientes. Clientes cancelados não ocupam lugar. */
export const MAX_CLIENTES_POR_SALA = 5

/** Nº de lugares ocupados numa sala (opcionalmente sem contar um cliente, ex.: o que está a ser editado). */
export async function lugaresOcupados(salaId: number, excluirClientId?: number): Promise<number> {
  return prisma.client.count({
    where: {
      salaId,
      status: { not: 'cancelado' },
      ...(excluirClientId ? { NOT: { id: excluirClientId } } : {}),
    },
  })
}
