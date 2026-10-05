import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta no Preço Justo AI. Inclui 1 dia de Premium grátis, sem cartão.",
  alternates: { canonical: "/register" },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
