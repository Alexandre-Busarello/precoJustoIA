import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Conversas com o Ben',
  description: 'Histórico das suas conversas com o Ben, o assistente de análise do Preço Justo AI.',
  robots: { index: false, follow: false },
}

export default function ConversasBenLayout({ children }: { children: ReactNode }) {
  return children
}
