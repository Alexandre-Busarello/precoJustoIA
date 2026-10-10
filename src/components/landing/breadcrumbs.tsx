import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

/** Trilha de navegação a partir do início. O último item é a página atual. */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Trilha de navegação" className={cn("mb-6", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <li>
          <Link href="/" className="relative inline-flex min-h-8 items-center hover:text-foreground hover:underline underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-1.5 before:content-['']">
            Início
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1">
            <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            {item.href ? (
              <Link href={item.href} className="relative inline-flex min-h-8 items-center hover:text-foreground hover:underline underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-1.5 before:content-['']">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
