"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { ScreeningHubPage } from "@/components/screening/screening-hub-page"

export default function ScreeningFiisPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} aria-label="Carregando" />
        </div>
      }
    >
      <ScreeningHubPage variant="fiis" />
    </Suspense>
  )
}
