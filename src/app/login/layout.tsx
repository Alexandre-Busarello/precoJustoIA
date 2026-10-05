import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre na sua conta do Preço Justo AI.",
  alternates: { canonical: "/login" },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
