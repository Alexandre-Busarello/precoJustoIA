import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { withRateLimit, RATE_LIMIT_CONFIGS, RateLimitMiddleware } from "@/lib/rate-limit-middleware"
import { canRegisterFromIP, recordIPRegistration, flagAccountAsSuspicious } from "@/lib/ip-protection-service"
import { sendVerificationEmail } from "@/lib/email-verification-service"

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    RATE_LIMIT_CONFIGS.REGISTER,
    async () => {
      try {
        const body = await request.json()
        
        // 🔒 SEGURANÇA: Whitelist explícita de campos permitidos
        // Extrair apenas os campos permitidos e ignorar qualquer campo extra
        const { name, email, password, website, acquisition, partnerId, ...rest } = body
        
        // 🍯 HONEYPOT: Verificar se campo honeypot foi preenchido (indica bot)
        // Estratégia do "Sucesso Falso": Retornar 200 OK para não alertar o criador do bot
        if (website && website.trim().length > 0) {
          const ip = RateLimitMiddleware.getClientIP(request)
          RateLimitMiddleware.logSuspiciousActivity(ip, 'HONEYPOT_TRIGGERED', 'register', {
            honeypotField: 'website',
            honeypotValue: website.substring(0, 50) // Log apenas primeiros 50 caracteres
          })
          
          // Bloquear IP imediatamente por tentativa de bot
          await RateLimitMiddleware.checkRateLimit(request, {
            ...RATE_LIMIT_CONFIGS.REGISTER,
            blockAfterViolations: 1 // Bloquear imediatamente
          })
          
          // Retornar sucesso falso (200 OK) para não alertar o bot
          // NÃO criar usuário, NÃO enviar email, NÃO disparar pixels
          return NextResponse.json(
            { success: true, message: "Cadastro realizado!" },
            { status: 200 }
          )
        }
        
        // 🍯 HONEYPOT: Verificar se outros campos ocultos foram preenchidos (camada adicional)
        // Também detecta tentativas de injeção de campos sensíveis
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
          
          // Retornar sucesso falso (200 OK) para não alertar o bot
          return NextResponse.json(
            { success: true, message: "Cadastro realizado!" },
            { status: 200 }
          )
        }
        
        // 🔒 SEGURANÇA: Detectar tentativas de injeção de campos sensíveis
        const sensitiveFields = [
          'isEarlyAdopter', 'earlyAdopterDate', 'isAdmin', 'subscriptionTier',
          'premiumExpiresAt', 'wasPremiumBefore', 'firstPremiumAt', 'lastPremiumAt',
          'premiumCount', 'stripeCustomerId', 'stripeSubscriptionId', 'stripePriceId',
          'stripeCurrentPeriodEnd', 'isInactive', 'inactivatedAt', 'lastLoginAt',
          'emailVerified', 'id'
        ]
        
        const attemptedInjection = sensitiveFields.some(field => rest[field] !== undefined)
        if (attemptedInjection) {
          const ip = RateLimitMiddleware.getClientIP(request)
          RateLimitMiddleware.logSuspiciousActivity(ip, 'SENSITIVE_FIELD_INJECTION', 'register', {
            attemptedFields: sensitiveFields.filter(field => rest[field] !== undefined)
          })
          
          // Bloquear IP por tentativa de injeção de campos sensíveis
          await RateLimitMiddleware.checkRateLimit(request, {
            ...RATE_LIMIT_CONFIGS.REGISTER,
            blockAfterViolations: 1
          })
          
          return NextResponse.json(
            { message: "Erro ao processar requisição" },
            { status: 400 }
          )
        }

        // 🚫 BLACKLIST: Verificar emails/domínios conhecidos de bots e testes
        const emailBlacklist = [
          // Domínios temporários conhecidos
          '10minutemail.com',
          'tempmail.com',
          'guerrillamail.com',
          'mailinator.com',
          'throwaway.email',
          'temp-mail.org',
          'getnada.com',
          'mohmal.com',
          'fakeinbox.com',
          'trashmail.com',
          'dispostable.com',
          'yopmail.com',
          'sharklasers.com',
          'grr.la',
          'spamgourmet.com',
          'mintemail.com',
          'emailondeck.com',
          'maildrop.cc',
          'getairmail.com',
          'meltmail.com',
          'melt.li',
          '33mail.com',
          'inboxbear.com',
          'mailcatch.com',
          'spambox.us',
          'spamfree24.org',
          'spamfree24.de',
          'spamfree24.eu',
          'spamgourmet.com',
          'spamhole.com',
          'spam.la',
          'spamex.com',
          'spamtraps.com',
          'tempail.com',
          'tempmailaddress.com',
          'tempmailer.com',
          'tempmailer.de',
          'tempinbox.co.uk',
          'tempinbox.com',
          'tempmail.de',
          'tempmail.net',
          'tempmail.org',
          'tempmail.us',
          'tempmailbox.com',
          'tempmailer.com',
          'tempmailer.de',
          'tempmailer.net',
          'tempmailer.org',
          'tempmailer.ru',
          'tempmailer.se',
          'tempmailer.tk',
          'tempmailer.ws',
          'tempmailer.xyz',
          'tempmailo.com',
          'tempmailo.net',
          'tempmailo.org',
          'tempmailo.tk',
          'tempmailo.ws',
          'tempmailo.xyz',
          'tempmails.org',
          'tempmails.tk',
          'tempmails.ws',
          'tempmails.xyz',
          'tempmailto.com',
          'tempmailto.net',
          'tempmailto.org',
          'tempmailto.tk',
          'tempmailto.ws',
          'tempmailto.xyz',
          'tempmail.us',
          'tempmail.ws',
          'tempmail.xyz',
          'temp-mail.io',
          'temp-mail.org',
          'temp-mail.ru',
          'temp-mail.xyz',
          'tempail.com',
          'tempail.net',
          'tempail.org',
          'tempail.tk',
          'tempail.ws',
          'tempail.xyz',
          'tempalias.com',
          'tempalias.net',
          'tempalias.org',
          'tempalias.tk',
          'tempalias.ws',
          'tempalias.xyz',
          'tempinbox.co.uk',
          'tempinbox.com',
          'tempinbox.net',
          'tempinbox.org',
          'tempinbox.tk',
          'tempinbox.ws',
          'tempinbox.xyz',
          'tempmailaddress.com',
          'tempmailer.com',
          'tempmailer.de',
          'tempmailer.net',
          'tempmailer.org',
          'tempmailer.ru',
          'tempmailer.se',
          'tempmailer.tk',
          'tempmailer.ws',
          'tempmailer.xyz',
          'tempmailo.com',
          'tempmailo.net',
          'tempmailo.org',
          'tempmailo.tk',
          'tempmailo.ws',
          'tempmailo.xyz',
          'tempmails.org',
          'tempmails.tk',
          'tempmails.ws',
          'tempmails.xyz',
          'tempmailto.com',
          'tempmailto.net',
          'tempmailto.org',
          'tempmailto.tk',
          'tempmailto.ws',
          'tempmailto.xyz',
          'tempmail.us',
          'tempmail.ws',
          'tempmail.xyz',
          'throwaway.email',
          'throwawaymail.com',
          'throwawaymail.net',
          'throwawaymail.org',
          'throwawaymail.tk',
          'throwawaymail.ws',
          'throwawaymail.xyz',
          'trashmail.com',
          'trashmail.net',
          'trashmail.org',
          'trashmail.tk',
          'trashmail.ws',
          'trashmail.xyz',
          'yopmail.com',
          'yopmail.fr',
          'yopmail.net',
          'yopmail.org',
          'yopmail.tk',
          'yopmail.ws',
          'yopmail.xyz',
          // Domínios de teste conhecidos
          'test.com',
          'test.net',
          'test.org',
          'example.com',
          'example.net',
          'example.org',
          'sample.com',
          'sample.net',
          'sample.org',
          'demo.com',
          'demo.net',
          'demo.org',
          'fake.com',
          'fake.net',
          'fake.org',
          'invalid.com',
          'invalid.net',
          'invalid.org',
          // Domínios de bots conhecidos
          'bot.com',
          'bot.net',
          'bot.org',
          'spam.com',
          'spam.net',
          'spam.org',
          'noreply.com',
          'no-reply.com',
          'donotreply.com',
          'do-not-reply.com',
        ]
        
        // Normalizar email para verificação
        const normalizedEmail = email?.toLowerCase().trim() || ''
        const emailDomain = normalizedEmail.split('@')[1] || ''
        
        // Verificar se domínio está na blacklist
        if (emailDomain && emailBlacklist.includes(emailDomain.toLowerCase())) {
          const ip = RateLimitMiddleware.getClientIP(request)
          RateLimitMiddleware.logSuspiciousActivity(ip, 'BLACKLISTED_EMAIL_DOMAIN', 'register', {
            email: normalizedEmail.substring(0, 50), // Log apenas primeiros 50 caracteres
            domain: emailDomain
          })
          
          // Bloquear IP por tentativa de cadastro com email blacklisted
          await RateLimitMiddleware.checkRateLimit(request, {
            ...RATE_LIMIT_CONFIGS.REGISTER,
            blockAfterViolations: 1
          })
          
          // Retornar sucesso falso (200 OK) para não alertar o bot
          return NextResponse.json(
            { success: true, message: "Cadastro realizado!" },
            { status: 200 }
          )
        }
        
        // Verificar padrões comuns de emails de teste/bot
        const testEmailPatterns = [
          /^test\d*@/i,
          /^bot\d*@/i,
          /^spam\d*@/i,
          /^fake\d*@/i,
          /^demo\d*@/i,
          /^sample\d*@/i,
          /^invalid\d*@/i,
          /^noreply\d*@/i,
          /^no-reply\d*@/i,
          /^donotreply\d*@/i,
          /^do-not-reply\d*@/i,
          /^admin\d*@/i,
          /^administrator\d*@/i,
          /^root\d*@/i,
          /^user\d+@/i,
          /^email\d+@/i,
          /^account\d+@/i,
          /^temp\d+@/i,
          /^temporary\d+@/i,
        ]
        
        const matchesTestPattern = testEmailPatterns.some(pattern => pattern.test(normalizedEmail))
        if (matchesTestPattern) {
          const ip = RateLimitMiddleware.getClientIP(request)
          RateLimitMiddleware.logSuspiciousActivity(ip, 'TEST_EMAIL_PATTERN', 'register', {
            email: normalizedEmail.substring(0, 50),
            pattern: 'test/bot pattern detected'
          })
          
          // Bloquear IP por tentativa de cadastro com email de teste
          await RateLimitMiddleware.checkRateLimit(request, {
            ...RATE_LIMIT_CONFIGS.REGISTER,
            blockAfterViolations: 1
          })
          
          // Retornar sucesso falso (200 OK) para não alertar o bot
          return NextResponse.json(
            { success: true, message: "Cadastro realizado!" },
            { status: 200 }
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
        if (!email || !password) {
          return NextResponse.json(
            { message: "Email e senha são obrigatórios" },
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

        // Nome é opcional - se fornecido, validar formato
        let finalName = name?.trim() || null
        if (finalName) {
          // Validar formato de nome (não pode ser apenas números ou caracteres especiais)
          if (finalName.length < 2 || /^[0-9\s]+$/.test(finalName)) {
            return NextResponse.json(
              { message: "Nome inválido" },
              { status: 400 }
            )
          }
        } else {
          // Se não fornecido, usar parte do email antes do @ como nome temporário
          const emailPart = email.split('@')[0]
          finalName = emailPart || 'Usuário'
        }

        if (password.length < 6) {
          return NextResponse.json(
            { message: "A senha deve ter pelo menos 6 caracteres" },
            { status: 400 }
          )
        }

        // Validar acquisition se fornecido (deve ser um valor permitido)
        const allowedAcquisitions = [
          'Calculadora de Dividend Yield',
          'Landing Page',
          'Blog',
          'Referral',
          'Google Ads',
          'Facebook Ads',
          'Outros'
        ]
        
        if (acquisition && !allowedAcquisitions.includes(acquisition)) {
          return NextResponse.json(
            { message: "Valor de acquisition inválido" },
            { status: 400 }
          )
        }

        // Early Adopters são marcados apenas via webhooks após pagamento confirmado

        // Capturar IP do request
        const ip = RateLimitMiddleware.getClientIP(request)

        // Verificar limite de contas por IP
        const ipCheck = await canRegisterFromIP(ip, email)

        if (!ipCheck.allowed) {
          return NextResponse.json(
            { 
              message: ipCheck.message || "Não foi possível criar a conta. Limite de contas por IP atingido."
            },
            { status: 403 }
          )
        }

        // Verificar se usuário já existe (dupla verificação)
        const existingUser = await prisma.user.findUnique({
          where: { email }
        })

        if (existingUser) {
          return NextResponse.json(
            { message: "Este email já está cadastrado. Tente fazer login ou recuperar sua senha." },
            { status: 400 }
          )
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(password, 12)

        // Validar partnerId se fornecido — deve existir na tabela partners
        let resolvedPartnerId: string | null = null
        if (partnerId && typeof partnerId === 'string') {
          const partner = await prisma.partner.findUnique({
            where: { id: partnerId },
            select: { id: true },
          })
          resolvedPartnerId = partner ? partner.id : null
        }

        // 🔒 SEGURANÇA: Criar usuário com campos explícitos apenas
        // isEarlyAdopter sempre false no registro - será atualizado via webhook após pagamento
        // Campos sensíveis são definidos apenas pelo servidor/webhooks
        // emailVerified = null inicialmente - será verificado via email
        const user = await prisma.user.create({
          data: {
            name: finalName,
            email,
            password: hashedPassword,
            isEarlyAdopter: false, // Sempre false - webhooks atualizam após pagamento
            earlyAdopterDate: null, // Será definido pelo webhook se for Early Adopter
            lastLoginAt: new Date(),
            acquisition: acquisition || null, // Rastrear origem do cadastro
            emailVerified: null, // Será verificado via email
            partnerId: resolvedPartnerId,
          }
        })

        // Registrar IP de registro
        await recordIPRegistration(ip, user.id)

        // Marcar como suspeita se necessário (2-5 contas do mesmo IP)
        if (ipCheck.shouldFlagAsSuspicious) {
          await flagAccountAsSuspicious(
            user.id,
            `IP possui ${ipCheck.totalCount} contas cadastradas`,
            ip
          )
        }

        // Vincular subscriptions anônimas existentes ao novo usuário
        try {
          const normalizedEmail = email.toLowerCase().trim()
          const anonymousSubscriptions = await prisma.userAssetSubscription.findMany({
            where: {
              email: normalizedEmail,
              userId: null, // Apenas subscriptions anônimas
            },
          })

          if (anonymousSubscriptions.length > 0) {
            console.log(`[REGISTER] Vinculando ${anonymousSubscriptions.length} subscription(s) anônima(s) ao novo usuário ${user.id} (${email})`)
            
            // Atualizar todas as subscriptions anônimas para vincular ao novo usuário
            await prisma.userAssetSubscription.updateMany({
              where: {
                email: normalizedEmail,
                userId: null,
              },
              data: {
                userId: user.id,
                email: null, // Remover email já que agora tem userId
                unsubscribeToken: null, // Remover token já que agora tem userId
              },
            })

            console.log(`[REGISTER] ✅ ${anonymousSubscriptions.length} subscription(s) vinculada(s) com sucesso`)
          }
        } catch (error) {
          // Não falhar o registro se houver erro ao vincular subscriptions
          console.error('Erro ao vincular subscriptions anônimas:', error)
        }

        // Enviar email de verificação (NÃO iniciar trial ainda)
        try {
          await sendVerificationEmail(user.id, email, name)
        } catch (error) {
          // Não falhar o registro se houver erro ao enviar email
          console.error('Erro ao enviar email de verificação:', error)
        }

        // Remover a senha da resposta
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _password, ...userWithoutPassword } = user

        return NextResponse.json(
          { 
            message: "Usuário criado com sucesso. Verifique seu email para ativar sua conta.",
            user: userWithoutPassword,
            requiresEmailVerification: true
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
