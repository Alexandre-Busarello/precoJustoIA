"use client"

import { useState, useEffect } from "react"
import { RecoveryCalculator } from "@/components/recovery-calculator"
import { RecoveryLimitCTA } from "@/components/recovery-limit-cta"
import { Skeleton } from "@/components/ui/skeleton"

interface UsageResponse {
  allowed: boolean
  remaining: number
  limit: number
  tier: "ANONYMOUS" | "FREE" | "PREMIUM"
}

export function RecoveryCalculatorClient() {
  const [usage, setUsage] = useState<UsageResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/calculators/recovery/usage")
      .then((res) => res.json())
      .then((data) => {
        setUsage(data)
      })
      .catch(() => {
        setUsage({ allowed: true, remaining: -1, limit: -1, tier: "PREMIUM" })
      })
      .finally(() => setLoading(false))
  }, [])

  const handleRecordUsage = async () => {
    try {
      const res = await fetch("/api/calculators/recovery/usage", {
        method: "POST",
      })
      const data = await res.json()
      if (res.status === 403) {
        setUsage((prev) =>
          prev
            ? {
                ...prev,
                allowed: false,
                remaining: 0,
                limit: data.limit ?? prev.limit,
                tier: data.tier ?? prev.tier,
              }
            : {
                allowed: false,
                remaining: 0,
                limit: data.limit ?? 2,
                tier: (data.tier as "ANONYMOUS" | "FREE" | "PREMIUM") ?? "ANONYMOUS",
              }
        )
        return
      }
      if (res.ok && data.remaining !== undefined) {
        setUsage((prev) =>
          prev ? { ...prev, remaining: data.remaining } : null
        )
      }
    } catch {
      // Ignore network errors
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]" aria-busy="true">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (usage && !usage.allowed) {
    return (
      <RecoveryLimitCTA
        tier={usage.tier === "ANONYMOUS" ? "ANONYMOUS" : "FREE"}
        remaining={usage.remaining}
        limit={usage.limit}
      />
    )
  }

  return (
    <RecoveryCalculator
      onUsageRecord={handleRecordUsage}
    />
  )
}
