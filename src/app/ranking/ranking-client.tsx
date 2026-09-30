"use client"

import { useSession } from "next-auth/react"
import { RankingWizard } from "@/components/ranking-wizard"

/** Parte interativa de /ranking (a página em si é um server component, para publicar metadata e canonical corretos). */
export function RankingClient() {
  const { data: session, status } = useSession()
  return <RankingWizard isLoggedIn={!!session} sessionLoading={status === "loading"} />
}
