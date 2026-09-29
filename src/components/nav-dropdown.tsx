"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { isActiveHref, isSectionActive, type NavSection as NavigationSection } from "@/lib/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

/** Legado: formato usado pelos dropdowns antigos (oportunidades/análise/carteiras), removidos na onda 3. */
export interface NavItem {
  title: string
  href: string
  icon?: React.ElementType
  description?: string
  isNew?: boolean
  badge?: string
  iconGradient?: string
}

/** Legado: grupo de `NavItem` (nome mantido para os dropdowns antigos). */
export interface NavSection {
  label?: string
  items: NavItem[]
}

interface NavDropdownProps {
  /** Item de topo vindo de @/lib/navigation (grupo com `items` ou link direto com `href`). */
  section?: NavigationSection
  /** Legado: título + grupos antigos. */
  title?: string
  sections?: NavSection[]
}

function toSection(props: NavDropdownProps): NavigationSection {
  if (props.section) return props.section
  return {
    label: props.title ?? "",
    items: (props.sections ?? []).flatMap((group) =>
      group.items.map((item) => ({ label: item.title, href: item.href, description: item.description }))
    ),
  }
}

const TRIGGER_CLASS = "h-9 gap-1 px-3 text-muted-foreground hover:text-foreground data-[active=true]:text-foreground data-[active=true]:bg-accent"

/** Item de navegação do header desktop: link direto ou dropdown com título + descrição de uma linha. */
export function NavDropdown(props: NavDropdownProps) {
  const section = toSection(props)
  const pathname = usePathname()
  const { data: session } = useSession()
  const { trackEngagement } = useEngagementPixel()
  const active = isSectionActive(pathname, section)

  const handleLinkClick = () => {
    if (!session) trackEngagement()
  }

  if (section.href) {
    return (
      <Button variant="ghost" size="sm" asChild data-active={active} className={TRIGGER_CLASS}>
        <Link href={section.href} onClick={handleLinkClick} aria-current={active ? "page" : undefined}>
          {section.label}
        </Link>
      </Button>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" data-active={active} className={TRIGGER_CLASS}>
          {section.label}
          <ChevronDown className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-1.5">
        {(section.items ?? []).map((item) => {
          const itemActive = isActiveHref(pathname, item.href, item.exact)
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                onClick={handleLinkClick}
                aria-current={itemActive ? "page" : undefined}
                className={cn("flex cursor-pointer flex-col items-start gap-0.5 rounded-md px-2.5 py-2", itemActive && "bg-accent")}
              >
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                {item.description && <span className="text-xs text-muted-foreground">{item.description}</span>}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
