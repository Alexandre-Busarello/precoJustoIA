import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user-service";
import { PortfolioService } from "@/lib/portfolio-service";
import { DashboardAgendaWidget } from "@/components/dashboard-agenda-widget";
import { DashboardAporteBlock } from "@/components/allocation/dashboard-aporte-block";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Visão geral",
  description: "Seu painel no Preço Justo AI: radar, carteiras, rankings recentes e empresas para analisar.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  // Bloco "Onde aportar este mês": carteiras e radar do usuário para o universo padrão.
  const user = await getCurrentUser();
  const [portfolios, radar] = user
    ? await Promise.all([
        PortfolioService.getUserPortfolios(user.id).catch(() => []),
        prisma.radarConfig.findUnique({ where: { userId: user.id }, select: { tickers: true } }).catch(() => null),
      ])
    : [[], null];
  const radarCount = Array.isArray(radar?.tickers) ? radar.tickers.length : 0;

  return (
    <>
      <DashboardClient
        aporte={
          <DashboardAporteBlock
            isPremium={!!user?.isPremium}
            portfolios={portfolios.map((p) => ({ id: p.id, name: p.name }))}
            radarCount={radarCount}
          />
        }
      />
      <div className="mx-auto w-full max-w-6xl px-4 pt-2 pb-6">
        <DashboardAgendaWidget />
      </div>
    </>
  );
}
