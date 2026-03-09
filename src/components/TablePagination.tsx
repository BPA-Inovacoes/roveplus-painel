import { ChevronLeft, ChevronRight } from 'lucide-react'

export const ROWS_PER_PAGE = 8

interface TablePaginationProps {
  totalItems: number
  currentPage: number
  onPageChange: (page: number) => void
  pageSize?: number
}

export function TablePagination({
  totalItems,
  currentPage,
  onPageChange,
  pageSize = ROWS_PER_PAGE,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)

  if (totalItems <= pageSize) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-netflix-border/60 bg-gradient-to-r from-netflix-panel/80 to-netflix-panel/40 text-sm rounded-b-xl">
      <span className="text-gray-400 tracking-wide">
        A mostrar <span className="font-semibold text-gray-200">{from}</span> a <span className="font-semibold text-gray-200">{to}</span> de <span className="font-semibold text-gray-200">{totalItems}</span> registos
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-netflix-border/80 bg-netflix-card/90 text-gray-400 hover:text-white hover:bg-primary-600 hover:border-primary-600/80 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-netflix-card/90 disabled:hover:border-netflix-border/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:ring-offset-2 focus:ring-offset-netflix-bg"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-w-[2.25rem] h-9 flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-netflix-bg ${
                p === currentPage
                  ? 'bg-primary-600 text-white border border-primary-500 shadow-md shadow-black/20 ring-2 ring-primary-400/40'
                  : 'border border-netflix-border/80 bg-netflix-card/90 text-gray-400 hover:text-white hover:bg-primary-600 hover:border-primary-600/80 focus:ring-primary-500/60'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-netflix-border/80 bg-netflix-card/90 text-gray-400 hover:text-white hover:bg-primary-600 hover:border-primary-600/80 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-netflix-card/90 disabled:hover:border-netflix-border/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:ring-offset-2 focus:ring-offset-netflix-bg"
          aria-label="Página seguinte"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
