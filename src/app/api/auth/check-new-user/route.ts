import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-service";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/check-new-user
 * Verifica se o usuário atual foi criado há menos de 5 minutos
 * Usado para detectar novos usuários OAuth e adicionar ?new_user=true
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Buscar dados do usuário incluindo createdAt
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        createdAt: true,
        accounts: {
          where: { provider: "google" },
          select: { provider: true },
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verificar se é um novo usuário (criado há menos de 5 minutos)
    const now = new Date();
    const timeDiff = now.getTime() - dbUser.createdAt.getTime();
    const minutesDiff = timeDiff / (1000 * 60);
    const isNewUser = minutesDiff < 5;

    // Verificar se tem conta Google vinculada (OAuth)
    const hasGoogleAccount = dbUser.accounts.length > 0;

    return NextResponse.json({
      isNewUser: isNewUser && hasGoogleAccount,
      createdAt: dbUser.createdAt,
      hasGoogleAccount,
    });
  } catch (error) {
    console.error("Error checking new user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

