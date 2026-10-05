import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { DashboardAgendaWidget } from "@/components/dashboard-agenda-widget";
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

  return (
    <>
      <DashboardClient />
      <div className="mx-auto w-full max-w-6xl px-4 pt-2 pb-6">
        <DashboardAgendaWidget />
      </div>
    </>
  );
}
