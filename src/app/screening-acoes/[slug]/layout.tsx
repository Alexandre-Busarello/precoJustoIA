import { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
}

export default function ScreeningConversionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Layout sem header - apenas renderiza children diretamente
  return <>{children}</>
}

