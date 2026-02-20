"use client"

import { useState, useEffect } from "react"
import { RecoveryCalculator } from "@/components/recovery-calculator"
import { RecoveryLimitCTA } from "@/components/recovery-limit-cta"
import { Card, CardContent } from "@/components/ui/card"

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
      <Card>
        <CardContent className="py-12">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
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
