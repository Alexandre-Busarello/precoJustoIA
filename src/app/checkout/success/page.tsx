import Link from "next/link"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { prisma } from "@/lib/prisma"
import { PaymentSuccessHandler } from "@/components/payment-success-handler"
import { getCurrentUser } from "@/lib/user-service"
import { GoogleAdsPurchasePixelWrapper } from "@/components/google-ads-purchase-pixel-wrapper"

export const metadata: Metadata = {
  title: "Pagamento confirmado",
  description: "Seu pagamento foi confirmado e sua conta Premium foi ativada.",
  robots: {
    index: false,
    follow: false,
  },
}

const NEXT_STEPS = [
  {
    title: "Rankings com todos os modelos",
    description: "Ranqueie ações por FCD, Gordon, Fórmula Mágica e os demais modelos, sem limite.",
    href: "/ranking",
  },
  {
    title: "Síntese com IA na página de cada ação",
    description: "Veja o resumo dos modelos e do contexto da empresa gerado por IA.",
    href: "/acao/petr4",
  },
  {
    title: "Comparador e backtest ilimitados",
    description: "Compare até 6 empresas e teste carteiras com dados históricos.",
    href: "/comparador",
  },
]

export default async function SuccessPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { email: currentUser.email! },
    select: { id: true },
  })

  if (!user) {
    redirect('/login')
  }

  const isPremium = currentUser.isPremium || false

  return (
    <div className="bg-background">
      <GoogleAdsPurchasePixelWrapper initialIsPremium={isPremium} />
      <div className="container mx-auto max-w-3xl space-y-8 px-4 py-8 sm:py-12">
        <PageHeader
          title="Pagamento confirmado"
          description="Bem-vindo ao Premium. Os recursos são liberados na sua conta assim que a ativação termina."
        />

        <PaymentSuccessHandler isPremium={isPremium} />

        <section aria-labelledby="proximos-passos">
          <h2 id="proximos-passos" className="text-lg font-semibold text-foreground">
            Por onde começar
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {NEXT_STEPS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block px-4 py-3 transition-colors hover:bg-accent">
                  <span className="block text-sm font-medium text-foreground">{item.title}</span>
                  <span className="block text-sm text-muted-foreground">{item.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">Ir para o dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contato">Falar com o suporte</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
