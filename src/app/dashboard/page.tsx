import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
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

  return <DashboardClient />;
}
