/** Planos e preços usados no painel (kz). */

/** Salas Netflix: cada conta custa 11 000 kz/mês. Orçamento = nº de salas ativas × custo. */
export const SALA_CUSTO_MENSAL = 11000

/** Máximo de clientes por sala (conta Netflix). Clientes cancelados não ocupam lugar. */
export const MAX_CLIENTES_POR_SALA = 5

export const PLANOS_NETFLIX = [
  { id: 'Plano Room', label: 'Plano Room', valor: 4500, inscricao: 2000 },
  { id: 'Plano Solo', label: 'Plano Solo', valor: 18500, inscricao: 4000 },
] as const

export function inscricaoValorPlano(plano: string | null | undefined): number | null {
  const p = PLANOS_NETFLIX.find((x) => x.id === plano)
  return p?.inscricao ?? null
}
