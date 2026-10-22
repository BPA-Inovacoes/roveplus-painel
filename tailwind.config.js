/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Netflix: vermelho principal #E50914, vermelho escuro #B20710
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#E50914', // Netflix Red
          700: '#B20710', // Netflix dark red (hover)
          800: '#8b0000',
          900: '#6b0000',
          950: '#450a0a',
        },
        // Fundos e superfícies estilo Netflix
        netflix: {
          bg: '#141414',
          card: '#181818',
          panel: '#1f1f1f',
          border: '#2f2f2f',
          hover: '#2a2a2a',
        },
        // Cores de dados (gráficos e indicadores) – validadas para o fundo escuro do painel.
        // series: cor única dos dados (o vermelho da marca fica para a interface, não para dados).
        // good/warning/critical: estados (pago / atenção / vencido) – usar sempre com ícone ou texto.
        viz: {
          series: '#3987e5',
          'series-soft': '#1c5cab',
          good: '#0ca30c',
          warning: '#fab219',
          critical: '#d03b3b',
          muted: '#898781',
          grid: '#2c2c2a',
          axis: '#383835',
          ink: '#f0efec',
          'ink-2': '#c3c2b7',
        },
        // Manter secondary/accent para compatibilidade (tons neutros escuros)
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        accent: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#E50914',
          700: '#B20710',
          800: '#8b0000',
          900: '#6b0000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
