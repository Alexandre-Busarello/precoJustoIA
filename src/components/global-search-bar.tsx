"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import CompanySearch from "@/components/company-search"
import { useShell } from "@/components/shell-context"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

const DESKTOP_QUERY = "(min-width: 1024px)"

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(mql.matches)
    update()
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])
  return isDesktop
}

/**
 * Busca global de ativos: dialog no desktop (Ctrl/Cmd + K) e sheet em tela cheia no mobile.
 * Montado uma vez no header; abre via `useShell().openSearch()`.
 */
export function GlobalSearchBar() {
  const { searchOpen, setSearchOpen, openSearch } = useShell()
  const isDesktop = useIsDesktop()
  const close = () => setSearchOpen(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        openSearch()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [openSearch])

  if (isDesktop) {
    return (
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="top-[12vh] translate-y-0 gap-0 p-3 sm:max-w-xl sm:p-3" showCloseButton={false}>
          <DialogTitle className="sr-only">Buscar ativo</DialogTitle>
          <DialogDescription className="sr-only">Digite o ticker ou o nome da empresa e pressione Enter.</DialogDescription>
          <CompanySearch variant="list" autoFocus onNavigate={close} placeholder="Buscar por ticker ou nome (ex.: PETR4)" />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
      <SheetContent side="top" className="h-dvh gap-0 overflow-y-auto border-b-0 px-4 pb-6">
        <div className="flex h-14 items-center pr-10">
          <SheetTitle className="text-base">Buscar ativo</SheetTitle>
          <SheetDescription className="sr-only">Digite o ticker ou o nome da empresa.</SheetDescription>
        </div>
        <CompanySearch variant="list" autoFocus onNavigate={close} placeholder="Ticker ou nome (ex.: PETR4)" />
      </SheetContent>
    </Sheet>
  )
}

/** Botão compacto de busca no header desktop, com o atalho de teclado. */
export function SearchTrigger({ className }: { className?: string }) {
  const { openSearch } = useShell()
  const [shortcut, setShortcut] = useState("Ctrl K")

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘K")
  }, [])

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Buscar ativo"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center gap-2 rounded-md border border-border bg-background text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none xl:w-60 xl:justify-start xl:px-3",
        className
      )}
    >
      <Search className="size-4" strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden flex-1 text-left xl:inline">Buscar ativo</span>
      <kbd className="hidden rounded-sm border border-border bg-muted px-1.5 font-sans text-xs text-muted-foreground xl:inline">{shortcut}</kbd>
    </button>
  )
}
