/**
 * Cores de dados para gráficos (Recharts precisa de hex, não de classes Tailwind).
 * Mantém-se igual a `theme.extend.colors.viz` em tailwind.config.js.
 * Validadas no fundo escuro do painel (#181818): série com contraste ≥ 3:1;
 * os estados não se distinguem só pela cor para daltónicos → usar sempre ícone/rótulo.
 */
export const VIZ = {
  series: '#3987e5',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  ink: '#f0efec',
  ink2: '#c3c2b7',
  surface: '#181818',
} as const

export const VIZ_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#1f1f1f',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '8px',
    color: VIZ.ink,
    fontSize: '12px',
  },
  labelStyle: { color: VIZ.ink2, marginBottom: 2 },
  itemStyle: { color: VIZ.ink },
} as const
