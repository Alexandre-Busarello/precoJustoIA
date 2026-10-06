"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Mail } from "lucide-react"

import { useEmailVerified } from "@/hooks/use-user-data"
import type { PageNoticeSource } from "@/components/page-notice"

const DISMISS_KEY = "email-verification-banner-dismissed"

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "true"
  } catch {
    return false
  }
}

/**
 * Aviso de verificação de e-mail (prioridade máxima no PageNotice).
 * Só aparece para quem está logado com e-mail ainda não verificado e não dispensou o aviso.
 */
export function useEmailVerificationNotice(): PageNoticeSource {
  const { status } = useSession()
  const { data, isLoading, isError } = useEmailVerified()
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, "true")
    } catch {
      // Sem localStorage: o aviso some só nesta visita
    }
  }

  if (status === "loading" || dismissed === null) return { pending: true, notice: null }
  if (status !== "authenticated" || dismissed || isError) return { pending: false, notice: null }
  if (isLoading) return { pending: true, notice: null }
  if (data?.verified !== false) return { pending: false, notice: null }

  return {
    pending: false,
    notice: {
      id: "email-verification",
      icon: Mail,
      title: "Verifique seu e-mail para ativar o teste Premium de 1 dia",
      description: "Você já pode usar a plataforma. O teste Premium começa depois da verificação.",
      action: { label: "Verificar e-mail", href: "/verificar-email" },
      onDismiss: dismiss,
    },
  }
}
