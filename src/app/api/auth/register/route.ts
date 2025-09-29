import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { canUserRegister, markAsEarlyAdopter } from "@/lib/alfa-service"

export async function POST(request: Request) {
  try {
    const { name, email, password, isEarlyAdopter = false } = await request.json()

    // Validações básicas
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Todos os campos são obrigatórios" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "A senha deve ter pelo menos 6 caracteres" },
        { status: 400 }
      )
    }

    // Verificar se pode registrar (limite da fase Alfa)
    const canRegister = await canUserRegister(isEarlyAdopter)
    if (!canRegister) {
      return NextResponse.json(
        { message: "Limite de usuários atingido para a fase Alfa. Entre na lista de interesse." },
        { status: 403 }
      )
    }

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { message: "Usuário já existe com este email" },
        { status: 400 }
      )
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12)

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isEarlyAdopter,
        earlyAdopterDate: isEarlyAdopter ? new Date() : null,
        lastLoginAt: new Date(),
      }
    })

    // Remover a senha da resposta
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user

    return NextResponse.json(
      { 
        message: "Usuário criado com sucesso",
        user: userWithoutPassword
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Erro ao criar usuário:", error)
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
