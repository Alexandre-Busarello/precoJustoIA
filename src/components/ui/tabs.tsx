"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

/**
 * Tabs.
 * - `variant="underline"`: navegação de conteúdo (indicador de 2 px na cor da marca).
 * - `variant="segmented"` (padrão, igual a `default`): alternar visualização (fundo `muted`).
 * A lista rola na horizontal (sem barra) quando não cabe e mostra um esmaecimento na borda que tem conteúdo oculto.
 * A altura é mínima (não fixa): listas em `grid` com várias linhas crescem e nenhum gatilho é cortado.
 * Em `grid`: com 3+ colunas, no mobile vira a faixa rolável; com 2 colunas (ou em sm+) os rótulos quebram linha. Nunca se sobrepõem a 320 px.
 */
type TabsVariant = "default" | "segmented" | "underline"

const TabsVariantContext = React.createContext<TabsVariant>("default")

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

type Fade = "none" | "start" | "end" | "both"

/** Observa overflow horizontal e devolve de que lado há conteúdo escondido. */
function useOverflowFade(ref: React.RefObject<HTMLElement | null>): Fade {
  const [fade, setFade] = React.useState<Fade>("none")

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      if (max <= 1) return setFade("none")
      // Com scroll-snap, a posição de repouso pode ficar no padding da lista (3–4 px), e não em 0.
      // Por isso o início/fim considera o padding horizontal como tolerância.
      const style = getComputedStyle(el)
      const padStart = (parseFloat(style.paddingLeft) || 0) + 1
      const padEnd = (parseFloat(style.paddingRight) || 0) + 1
      const atStart = el.scrollLeft <= padStart
      const atEnd = el.scrollLeft >= max - padEnd
      setFade(atStart ? "end" : atEnd ? "start" : "both")
    }
    update()
    el.addEventListener("scroll", update, { passive: true })
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null
    observer?.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      observer?.disconnect()
    }
  }, [ref])

  return fade
}

const FADE_CLASSES =
  "data-[fade=end]:[mask-image:linear-gradient(to_right,#000_calc(100%_-_2rem),transparent)] data-[fade=start]:[mask-image:linear-gradient(to_left,#000_calc(100%_-_2rem),transparent)] data-[fade=both]:[mask-image:linear-gradient(to_right,transparent,#000_2rem,#000_calc(100%_-_2rem),transparent)]"

function TabsList({
  className,
  variant = "default",
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  const innerRef = React.useRef<HTMLDivElement | null>(null)
  const fade = useOverflowFade(innerRef)

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        ref={setRefs}
        data-slot="tabs-list"
        data-variant={variant}
        data-fade={fade}
        className={cn(
          "no-scrollbar inline-flex max-w-full snap-x items-center overflow-x-auto text-muted-foreground",
          // Listas `grid` com 3+ colunas viram a mesma faixa rolável no mobile (rótulos inteiros, com esmaecimento).
          // Nas demais grades (2 colunas ou sm+), o rótulo quebra linha em vez de invadir a coluna vizinha.
          "max-sm:[&.grid:not(.grid-cols-2)]:flex [&.grid_[data-slot=tabs-trigger]]:min-w-0 [&.grid_[data-slot=tabs-trigger]]:whitespace-normal [&.grid_[data-slot=tabs-trigger]]:text-center [&.grid_[data-slot=tabs-trigger]]:leading-tight [&.grid_[data-slot=tabs-trigger]]:break-words max-sm:[&.grid:not(.grid-cols-2)_[data-slot=tabs-trigger]]:min-w-fit max-sm:[&.grid:not(.grid-cols-2)_[data-slot=tabs-trigger]]:whitespace-nowrap",
          variant === "underline"
            ? "w-full justify-start gap-5 shadow-[inset_0_-1px_0_var(--border)]"
            : "min-h-11 w-fit scroll-px-[3px] rounded-lg bg-muted p-[3px] md:min-h-9 [&.grid]:items-stretch [&.grid]:auto-rows-[minmax(38px,auto)] [&.grid>*>[data-slot=tabs-trigger]]:h-full [&.grid>*>[data-slot=tabs-trigger]]:w-full md:[&.grid]:auto-rows-[minmax(30px,auto)]",
          FADE_CLASSES,
          className
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsVariantContext)

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex shrink-0 snap-start items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        variant === "underline"
          ? "relative min-h-11 px-0.5 text-muted-foreground hover:text-foreground data-[state=active]:text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-brand md:min-h-10"
          : "flex-1 self-stretch rounded-md px-3 py-1 text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:ring-1 data-[state=active]:ring-border",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
