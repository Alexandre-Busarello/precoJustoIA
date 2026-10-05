import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Redefinir senha",
  description: "Receba por e-mail um link para criar uma nova senha no Preço Justo AI.",
  alternates: { canonical: "/esqueci-senha" },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
