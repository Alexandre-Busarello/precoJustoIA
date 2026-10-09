"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { InfoHint } from "@/components/ui/info-hint"
import { Skeleton } from "@/components/ui/skeleton"

export type SortDirection = "asc" | "desc"

export interface DataTableColumn<T> {
  /** Identificador único; também é a chave lida de `row` quando `cell`/`sortValue` não são informados. */
  key: string
  header: React.ReactNode
  align?: "left" | "right" | "center"
  sortable?: boolean
  /** Valor usado na ordenação (padrão: `row[key]`). `null`/`undefined` vão para o fim. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Fixa a coluna à esquerda (use na 1ª coluna, ex.: ticker). */
  sticky?: boolean
  width?: string | number
  /** Conteúdo da célula (padrão: `row[key]`). Formate números com @/lib/format. */
  cell?: (row: T, index: number) => React.ReactNode
  /** Ajuda no cabeçalho (InfoHint). */
  hint?: React.ReactNode
  className?: string
  headerClassName?: string
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId?: (row: T, index: number) => string
  /** Linhas de 36 px (padrão 40 px). */
  dense?: boolean
  /** Fixa a 1ª coluna e mostra sombra na borda ao rolar na horizontal. */
  stickyFirstColumn?: boolean
  /** Altura máxima do contêiner; com ela o cabeçalho fica fixo ao rolar a tabela. */
  maxHeight?: string | number
  loading?: boolean
  loadingRows?: number
  empty?: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }
  defaultSort?: { key: string; direction: SortDirection }
  onRowClick?: (row: T) => void
  /** Conteúdo da linha expandida; adiciona um botão de expandir no fim de cada linha. */
  renderExpanded?: (row: T) => React.ReactNode
  /** Legenda acessível (visível só para leitores de tela). */
  caption?: string
  className?: string
}

function readKey<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || (typeof a === "number" && Number.isNaN(a))
  const bEmpty = b === null || b === undefined || (typeof b === "number" && Number.isNaN(b))
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" })
}

const ALIGN: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right tabular-nums",
  center: "text-center",
}

/**
 * Tabela de dados tipada: ordenação no cliente, 1ª coluna fixa com rolagem horizontal no mobile,
 * skeleton de carregamento, estado vazio, linhas expansíveis e clique na linha.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  dense = false,
  stickyFirstColumn = false,
  maxHeight,
  loading = false,
  loadingRows = 5,
  empty,
  defaultSort,
  onRowClick,
  renderExpanded,
  caption,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ key: string; direction: SortDirection } | null>(defaultSort ?? null)
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  const [scrolled, setScrolled] = React.useState(false)

  const sortedRows = React.useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column) return rows
    const valueOf = column.sortValue ?? ((row: T) => readKey(row, column.key) as string | number | null | undefined)
    const factor = sort.direction === "asc" ? 1 : -1
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const va = valueOf(a.row)
        const vb = valueOf(b.row)
        const aEmpty = va === null || va === undefined
        const bEmpty = vb === null || vb === undefined
        if (aEmpty || bEmpty) return compareValues(va, vb)
        return compareValues(va, vb) * factor || a.index - b.index
      })
      .map((entry) => entry.row)
  }, [rows, columns, sort])

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "desc" }
      return { key, direction: current.direction === "desc" ? "asc" : "desc" }
    })
  }

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandable = typeof renderExpanded === "function"
  const colCount = columns.length + (expandable ? 1 : 0)
  const rowHeight = dense ? "h-9" : "h-10"
  const isSticky = (column: DataTableColumn<T>, index: number) => column.sticky || (stickyFirstColumn && index === 0)
  const stickyCell = "sticky left-0 z-10 group-data-[scrolled=true]/dt:shadow-[6px_0_8px_-6px_rgb(0_0_0/0.18)]"

  return (
    <div
      data-scrolled={scrolled}
      className={cn("group/dt relative w-full overflow-auto rounded-lg border border-border bg-card", className)}
      style={maxHeight !== undefined ? { maxHeight } : undefined}
      onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 0)}
    >
      <table className="w-full caption-bottom border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className={cn("bg-surface", maxHeight !== undefined && "sticky top-0 z-20")}>
          <tr className="border-b border-border">
            {columns.map((column, index) => {
              const active = sort?.key === column.key
              const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
              const SortIcon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  style={column.width !== undefined ? { width: column.width } : undefined}
                  className={cn(
                    "h-11 px-3 align-middle text-xs font-medium whitespace-nowrap text-muted-foreground md:h-9",
                    ALIGN[column.align ?? "left"],
                    isSticky(column, index) && cn(stickyCell, "bg-surface"),
                    column.headerClassName
                  )}
                >
                  <span className={cn("inline-flex items-center gap-1", column.align === "right" && "flex-row-reverse")}>
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          "relative inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none before:absolute before:-inset-x-1 before:-inset-y-3.5 before:content-['']",
                          column.align === "right" && "flex-row-reverse",
                          active && "text-foreground"
                        )}
                      >
                        {column.header}
                        <SortIcon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    ) : (
                      column.header
                    )}
                    {column.hint && <InfoHint content={column.hint} side="bottom" />}
                  </span>
                </th>
              )
            })}
            {expandable && <th scope="col" className="w-11 px-1"><span className="sr-only">Detalhes</span></th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }, (_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`} className={cn(rowHeight, "border-b border-border last:border-0")}>
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cn("px-3", ALIGN[column.align ?? "left"], isSticky(column, index) && cn(stickyCell, "bg-card"))}
                  >
                    <Skeleton className={cn("h-4 w-16", column.align === "right" && "ml-auto")} />
                  </td>
                ))}
                {expandable && <td />}
              </tr>
            ))
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">{empty?.title ?? "Nenhum resultado"}</p>
                {empty?.description && <p className="mt-1 text-sm text-muted-foreground">{empty.description}</p>}
                {empty?.action && <div className="mt-4 flex justify-center">{empty.action}</div>}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, rowIndex) => {
              const id = getRowId ? getRowId(row, rowIndex) : String(rowIndex)
              const isOpen = expanded.has(id)
              const clickable = !!onRowClick || expandable
              const activate = () => (onRowClick ? onRowClick(row) : expandable ? toggleExpanded(id) : undefined)
              return (
                <React.Fragment key={id}>
                  <tr
                    className={cn(
                      "group/row border-b border-border transition-colors last:border-0 hover:bg-muted",
                      rowHeight,
                      clickable && "cursor-pointer",
                      isOpen && "border-b-0"
                    )}
                    onClick={clickable ? activate : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.target !== event.currentTarget) return
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              onRowClick(row)
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                  >
                    {columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-3 py-1.5 align-middle",
                          ALIGN[column.align ?? "left"],
                          isSticky(column, index) && cn(stickyCell, "bg-card group-hover/row:bg-muted"),
                          column.className
                        )}
                      >
                        {column.cell ? column.cell(row, rowIndex) : (readKey(row, column.key) as React.ReactNode)}
                      </td>
                    ))}
                    {expandable && (
                      <td className="w-11 px-1 text-right">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Recolher detalhes" : "Ver detalhes"}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleExpanded(id)
                          }}
                          className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground before:absolute before:-inset-1 before:content-[''] hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <ChevronDown
                            className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        </button>
                      </td>
                    )}
                  </tr>
                  {renderExpanded && isOpen && (
                    <tr className="border-b border-border last:border-0">
                      <td colSpan={colCount} className="bg-surface px-3 py-3">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
