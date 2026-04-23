"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { ScreeningHubPage } from "@/components/screening/screening-hub-page"

export default function ScreeningAcoesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ScreeningHubPage variant="stocks" />
    </Suspense>
  )
}
