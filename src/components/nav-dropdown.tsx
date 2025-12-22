"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  description?: string
  isNew?: boolean
  badge?: string
  iconGradient?: string
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

interface NavDropdownProps {
  title: string
  sections: NavSection[]
}

export function NavDropdown({ title, sections }: NavDropdownProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { trackEngagement } = useEngagementPixel()
  
  // Flatten all items to check if any is active
  const allItems = sections.flatMap(section => section.items)
  const isActive = allItems.some((item) => pathname === item.href || pathname?.startsWith(item.href))

  // Handler para disparar pixel quando usuário deslogado clica em link
  const handleLinkClick = () => {
    if (!session) {
      trackEngagement()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isActive ? "default" : "ghost"}
          size="sm"
          className="flex items-center gap-2"
        >
          {title}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-[320px] p-2">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {section.label && (
              <>
                {sectionIndex > 0 && <DropdownMenuSeparator className="my-2" />}
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                  {section.label}
                </DropdownMenuLabel>
              </>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const isItemActive = pathname === item.href || pathname?.startsWith(item.href)
              const iconGradient = item.iconGradient || "bg-gradient-to-br from-blue-500 to-purple-500"
              
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link
                    href={item.href}
                    onClick={handleLinkClick}
                    className={cn(
                      "flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-muted/50 focus:bg-muted/50 cursor-pointer",
                      isItemActive && "bg-muted"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg", iconGradient)}>
                      <div className="text-white">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium leading-none">
                          {item.title}
                        </span>
                        {item.isNew && (
                          <Badge variant="secondary" className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white">
                            🚀 Novo
                          </Badge>
                        )}
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

