"use client"

import { InfoHint } from "@/components/ui/info-hint"

interface InfoTooltipProps {
  content: string
}

/** Compatibilidade: ajuda contextual antiga, agora baseada em InfoHint (toque e mouse, alvo de 44 px). */
export function InfoTooltip({ content }: InfoTooltipProps) {
  return <InfoHint content={content} contentClassName="w-56 text-xs leading-5" />
}
