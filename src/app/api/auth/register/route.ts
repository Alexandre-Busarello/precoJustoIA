import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { canUserRegister } from "@/lib/alfa-service"
import { withRateLimit, RATE_LIMIT_CONFIGS, RateLimitMiddleware } from "@/lib/rate-limit-middleware"

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    RATE_LIMIT_CONFIGS.REGISTER,
    async () => {
      try {
        const body = await request.json()
        const { name, email, password, isEarlyAdopter = false, ...rest } = body

        // 🍯 HONEYPOT: Verificar se campos ocultos foram preenchidos (indica bot)
        if (RateLimitMiddleware.checkHoneypot(rest)) {
          const ip = RateLimitMiddleware.getClientIP(request)
          RateLimitMiddleware.logSuspiciousActivity(ip, 'HONEYPOT_TRIGGERED', 'register', {
            filledFields: Object.keys(rest).filter(key => rest[key])
          })
          
          // Bloquear IP imediatamente por tentativa de bot
          await RateLimitMiddleware.checkRateLimit(request, {
            ...RATE_LIMIT_CONFIGS.REGISTER,
            blockAfterViolations: 1 // Bloquear imediatamente
          })
          
          return NextResponse.json(
            { message: "Erro ao processar requisição" },
            { status: 400 }
          )
        }

        // 🔍 Verificar padrões suspeitos
        const suspiciousPatterns = RateLimitMiddleware.detectSuspiciousPatterns(request)
        if (suspiciousPatterns.suspicious) {
          const ip = RateLimitMiddleware.getClientIP(request)
          RateLimitMiddleware.logSuspiciousActivity(ip, 'SUSPICIOUS_PATTERN', 'register', {
            reasons: suspiciousPatterns.reasons
          })
          
          // Incrementar violações para padrões suspeitos
          await RateLimitMiddleware.checkRateLimit(request, RATE_LIMIT_CONFIGS.REGISTER)
        }

        // Validações básicas
        if (!name || !email || !password) {
          return NextResponse.json(
            { message: "Todos os campos são obrigatórios" },
            { status: 400 }
          )
        }

        // Validação de email mais rigorosa
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { message: "Email inválido" },
            { status: 400 }
          )
        }

        // Validar formato de nome (não pode ser apenas números ou caracteres especiais)
        if (name.trim().length < 2 || /^[0-9\s]+$/.test(name.trim())) {
          return NextResponse.json(
            { message: "Nome inválido" },
            { status: 400 }
          )
        }

        if (password.length < 6) {
          return NextResponse.json(
            { message: "A senha deve ter pelo menos 6 caracteres" },
            { status: 400 }
          )
        }

        // Validar senha não é muito simples (apenas números ou apenas letras)
        if (/^[0-9]+$/.test(password) || /^[a-zA-Z]+$/.test(password)) {
          return NextResponse.json(
            { message: "A senha deve conter letras e números" },
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

      } catch (error: any) {
        console.error("Erro ao criar usuário:", error)
        
        // Não expor detalhes do erro para evitar informações úteis para bots
        const isUniqueConstraint = error?.code === 'P2002' || error?.message?.includes('Unique constraint')
        
        if (isUniqueConstraint) {
          return NextResponse.json(
            { message: "Usuário já existe com este email" },
            { status: 400 }
          )
        }
        
        return NextResponse.json(
          { message: "Erro interno do servidor" },
          { status: 500 }
        )
      }
    }
  )
}
