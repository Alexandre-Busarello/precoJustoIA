import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Minha conta',
  description: 'Dados de acesso, assinatura e preferências da sua conta no Preço Justo AI.',
  robots: { index: false, follow: false },
}

export default function PerfilLayout({ children }: { children: ReactNode }) {
  return children
}
