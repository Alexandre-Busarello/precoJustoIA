import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { Adapter } from "next-auth/adapters"
import { startTrialForUser, startTrialAfterEmailVerification } from "@/lib/trial-service"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          subscriptionTier: user.subscriptionTier,
          premiumExpiresAt: user.premiumExpiresAt ?? undefined,
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 48 * 60 * 60, // 48 horas em segundos
  },
  jwt: {
    maxAge: 48 * 60 * 60, // 48 horas em segundos
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Após login bem-sucedido (especialmente OAuth), processar:
      // 1. Marcar email como verificado se for OAuth (Google já verifica)
      // 2. Registrar IP de registro/login
      // 3. Iniciar trial se necessário
      // IMPORTANTE: Para OAuth, user.id pode ser o ID do provider (Google), não o ID do banco
      // Por isso buscamos pelo email que é único e confiável
      // O PrismaAdapter cria o usuário durante este callback, então pode haver um pequeno delay
      if (user?.email) {
        try {
          const isOAuth = account?.provider === 'google'
          
          // Tentar buscar o usuário com retry (o PrismaAdapter pode ainda estar criando)
          let dbUser = null
          let retries = 5 // Aumentado para dar mais tempo ao PrismaAdapter
          while (retries > 0 && !dbUser) {
            dbUser = await prisma.user.findUnique({
              where: { email: user.email },
              select: {
                id: true,
                createdAt: true,
                emailVerified: true,
                trialStartedAt: true,
                trialEndsAt: true,
                subscriptionTier: true
              }
            })
            
            if (!dbUser && retries > 1) {
              // Aguardar um pouco antes de tentar novamente
              await new Promise(resolve => setTimeout(resolve, 200))
              retries--
            } else {
              break
            }
          }

          if (!dbUser) {
            console.warn(`[OAUTH] Usuário com email ${user.email} não encontrado no banco após ${5 - retries + 1} tentativas. Processamento será feito no callback jwt.`)
            // Não falhar o login - vamos tentar novamente no callback jwt
            return true
          }

          // Para OAuth (Google), marcar email como verificado automaticamente
          // O Google já verifica emails, então podemos confiar
          if (isOAuth && !dbUser.emailVerified) {
            console.log(`[OAUTH] Marcando email como verificado para usuário ${dbUser.id} (${user.email}) via Google OAuth`)
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { emailVerified: new Date() }
            })
            dbUser.emailVerified = new Date()
          }

          // Verificar se é novo usuário (criado há menos de 5 minutos)
          const now = new Date()
          const userCreatedAt = dbUser.createdAt
          const timeDiff = now.getTime() - userCreatedAt.getTime()
          const minutesDiff = timeDiff / (1000 * 60)
          const isNewUser = minutesDiff < 5

          // Se é novo usuário OAuth, registrar IP de registro
          // Nota: Não temos acesso direto ao request aqui, então vamos usar um placeholder
          // O IP real será atualizado no endpoint update-last-login
          if (isNewUser && isOAuth) {
            console.log(`[OAUTH] Novo usuário detectado via Google OAuth: ${dbUser.id} (${user.email})`)
            // Criar registro em user_security se não existir
            // O IP será atualizado no próximo login via update-last-login
            await prisma.userSecurity.upsert({
              where: { userId: dbUser.id },
              create: {
                userId: dbUser.id,
                // registrationIp será null por enquanto, será atualizado no próximo login
                // ou podemos tentar obter de algum header se disponível
              },
              update: {}
            })
          }

          // Iniciar trial se:
          // 1. Email está verificado (ou foi verificado agora via OAuth)
          // 2. Não tem trial iniciado
          // 3. Não é Premium
          // 4. É novo usuário OU foi criado há menos de 5 minutos
          if (dbUser.emailVerified && !dbUser.trialStartedAt && dbUser.subscriptionTier === 'FREE' && isNewUser) {
            console.log(`[TRIAL] Tentando iniciar trial para novo usuário ${dbUser.id} (${user.email}) via ${isOAuth ? 'Google OAuth' : 'credenciais'}`)
            const trialStarted = await startTrialAfterEmailVerification(dbUser.id)
            
            if (trialStarted) {
              console.log(`[TRIAL] ✅ Trial iniciado com sucesso para usuário ${dbUser.id} (${user.email})`)
              // Atualizar user com dados do trial iniciado para incluir na sessão
              const updatedUser = await prisma.user.findUnique({
                where: { id: dbUser.id },
                select: {
                  trialStartedAt: true,
                  trialEndsAt: true
                }
              })
              if (updatedUser) {
                user.trialStartedAt = updatedUser.trialStartedAt ?? undefined
                user.trialEndsAt = updatedUser.trialEndsAt ?? undefined
              }
            } else {
              console.warn(`[TRIAL] ⚠️ Falha ao iniciar trial para usuário ${dbUser.id} (${user.email}). Verifique: LAUNCH_PHASE=PROD e ENABLE_TRIAL=true`)
            }
          } else if (dbUser.trialStartedAt) {
            console.log(`[TRIAL] Usuário ${dbUser.id} (${user.email}) já possui trial iniciado`)
          } else if (dbUser.subscriptionTier === 'PREMIUM') {
            console.log(`[TRIAL] Usuário ${dbUser.id} (${user.email}) já é Premium - não precisa de trial`)
          } else if (!dbUser.emailVerified && !isOAuth) {
            console.log(`[TRIAL] Usuário ${dbUser.id} (${user.email}) precisa verificar email antes de iniciar trial`)
          }
        } catch (error) {
          // Não falhar o login se houver erro ao processar
          console.error('[OAUTH] Erro ao processar login OAuth:', error)
        }
      }
      return true
    },
    async jwt({ token, user, trigger, account }) {
      // Se é um novo login, verificar e iniciar trial se necessário
      if (user) {
        const isOAuth = account?.provider === 'google'
        console.log(`[TRIAL] [JWT] Novo login detectado - user.id: ${user.id}, user.email: ${user.email}, isOAuth: ${isOAuth}`)
        
        // Sempre buscar pelo email para garantir que temos o ID correto do banco
        // Isso é especialmente importante para OAuth onde o user.id pode ser do provider
        if (user.email) {
          try {
            // Tentar buscar usuário com retry (PrismaAdapter pode ainda estar criando)
            let dbUser = null
            let retries = 5
            while (retries > 0 && !dbUser) {
              dbUser = await prisma.user.findUnique({
                where: { email: user.email },
                select: {
                  id: true,
                  createdAt: true,
                  emailVerified: true,
                  trialStartedAt: true,
                  trialEndsAt: true,
                  subscriptionTier: true
                }
              })
              
              if (!dbUser && retries > 1) {
                await new Promise(resolve => setTimeout(resolve, 200))
                retries--
              } else {
                break
              }
            }

            if (dbUser) {
              console.log(`[TRIAL] [JWT] Usuário encontrado no banco: ${dbUser.id} (${user.email}), emailVerified: ${dbUser.emailVerified}, trialStartedAt: ${dbUser.trialStartedAt}, subscriptionTier: ${dbUser.subscriptionTier}`)
              
              // Usar o ID real do banco
              token.userId = dbUser.id
              
              // Para OAuth (Google), marcar email como verificado se ainda não estiver
              if (isOAuth && !dbUser.emailVerified) {
                console.log(`[OAUTH] [JWT] Marcando email como verificado para usuário ${dbUser.id} (${user.email}) via Google OAuth`)
                await prisma.user.update({
                  where: { id: dbUser.id },
                  data: { emailVerified: new Date() }
                })
                dbUser.emailVerified = new Date()
              }

              // Verificar se precisa iniciar trial (novo usuário sem trial)
              const now = new Date()
              const userCreatedAt = dbUser.createdAt
              const timeDiff = now.getTime() - userCreatedAt.getTime()
              const minutesDiff = timeDiff / (1000 * 60)
              const isNewUser = minutesDiff < 5

              console.log(`[TRIAL] [JWT] Usuário criado há ${minutesDiff.toFixed(2)} minutos, emailVerified: ${dbUser.emailVerified ? 'SIM' : 'NÃO'}, isNewUser: ${isNewUser}`)

              // Iniciar trial se:
              // 1. Email está verificado (ou foi verificado agora via OAuth)
              // 2. Não tem trial iniciado
              // 3. Não é Premium
              // 4. É novo usuário
              if (dbUser.emailVerified && !dbUser.trialStartedAt && dbUser.subscriptionTier === 'FREE' && isNewUser) {
                console.log(`[TRIAL] [JWT] ✅ Tentando iniciar trial para novo usuário ${dbUser.id} (${user.email}) via ${isOAuth ? 'Google OAuth' : 'credenciais'}`)
                const trialStarted = await startTrialAfterEmailVerification(dbUser.id)
                
                if (trialStarted) {
                  console.log(`[TRIAL] [JWT] ✅✅✅ Trial iniciado com sucesso para usuário ${dbUser.id} (${user.email})`)
                  // Buscar dados atualizados do trial
                  const updatedUser = await prisma.user.findUnique({
                    where: { id: dbUser.id },
                    select: {
                      trialStartedAt: true,
                      trialEndsAt: true,
                      subscriptionTier: true
                    }
                  })
                  if (updatedUser) {
                    token.trialStartedAt = updatedUser.trialStartedAt?.toISOString()
                    token.trialEndsAt = updatedUser.trialEndsAt?.toISOString()
                    token.subscriptionTier = updatedUser.subscriptionTier
                  }
                } else {
                  console.warn(`[TRIAL] [JWT] ⚠️ Falha ao iniciar trial para usuário ${dbUser.id} (${user.email}). Verifique: LAUNCH_PHASE=PROD e ENABLE_TRIAL=true`)
                }
              } else {
                if (dbUser.trialStartedAt) {
                  console.log(`[TRIAL] [JWT] Usuário ${dbUser.id} já possui trial iniciado`)
                } else if (dbUser.subscriptionTier === 'PREMIUM') {
                  console.log(`[TRIAL] [JWT] Usuário ${dbUser.id} já é Premium - não precisa de trial`)
                } else if (!dbUser.emailVerified) {
                  console.log(`[TRIAL] [JWT] Usuário ${dbUser.id} precisa verificar email antes de iniciar trial`)
                } else if (!isNewUser) {
                  console.log(`[TRIAL] [JWT] Usuário ${dbUser.id} criado há ${minutesDiff.toFixed(2)} minutos - não é novo usuário`)
                }
              }
              
              // Atualizar token com dados do banco
              token.subscriptionTier = dbUser.subscriptionTier || "FREE"
              token.trialStartedAt = dbUser.trialStartedAt?.toISOString()
              token.trialEndsAt = dbUser.trialEndsAt?.toISOString()
              token.premiumExpiresAt = user.premiumExpiresAt?.toISOString()
            } else {
              console.warn(`[TRIAL] [JWT] ⚠️ Usuário com email ${user.email} não encontrado no banco após ${5 - retries + 1} tentativas`)
              // Fallback para dados do user object
              token.userId = user.id
              token.subscriptionTier = user.subscriptionTier || "FREE"
              token.premiumExpiresAt = user.premiumExpiresAt?.toISOString()
              token.trialStartedAt = user.trialStartedAt?.toISOString()
              token.trialEndsAt = user.trialEndsAt?.toISOString()
            }
          } catch (error) {
            console.error('[TRIAL] [JWT] Erro ao verificar/iniciar trial:', error)
            // Fallback para dados do user object
            token.userId = user.id
            token.subscriptionTier = user.subscriptionTier || "FREE"
            token.premiumExpiresAt = user.premiumExpiresAt?.toISOString()
            token.trialStartedAt = user.trialStartedAt?.toISOString()
            token.trialEndsAt = user.trialEndsAt?.toISOString()
          }
        } else {
          // Sem email, usar dados do user object diretamente
          console.log(`[TRIAL] [JWT] Sem email disponível, usando user.id diretamente: ${user.id}`)
          token.userId = user.id
          token.subscriptionTier = user.subscriptionTier || "FREE"
          token.premiumExpiresAt = user.premiumExpiresAt?.toISOString()
          token.trialStartedAt = user.trialStartedAt?.toISOString()
          token.trialEndsAt = user.trialEndsAt?.toISOString()
        }
        return token
      }
      
      // Para tokens existentes, verificar se têm exp/iat válidos
      // Tokens antigos sem exp são considerados inválidos
      if (!token.exp || !token.iat) {
        throw new Error('Token inválido - requer novo login')
      }
      
      // Verificar se o token expirou
      if (Date.now() >= token.exp * 1000) {
        throw new Error('Token expirado')
      }
      
      // Se é uma atualização da sessão, buscar dados atualizados do banco
      if (trigger === "update" && token.userId) {
        try {
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: {
              subscriptionTier: true,
              premiumExpiresAt: true,
              trialStartedAt: true,
              trialEndsAt: true,
            }
          })
          
          if (updatedUser) {
            token.subscriptionTier = updatedUser.subscriptionTier
            token.premiumExpiresAt = updatedUser.premiumExpiresAt?.toISOString()
            token.trialStartedAt = updatedUser.trialStartedAt?.toISOString()
            token.trialEndsAt = updatedUser.trialEndsAt?.toISOString()
          }
        } catch (error) {
          console.error('Erro ao atualizar token JWT:', error)
        }
      }
      
      return token
    },
    async session({ session, token }) {
      // Validar token antes de criar a sessão
      // Tokens antigos sem exp são considerados inválidos
      if (!token || !token.exp || !token.iat) {
        // Retornar sessão sem user faz o NextAuth tratar como não autenticado
        return {
          ...session,
          user: null as any,
          expires: new Date(0).toISOString()
        }
      }
      
      // Verificar se o token expirou
      if (Date.now() >= token.exp * 1000) {
        // Retornar sessão sem user faz o NextAuth tratar como não autenticado
        return {
          ...session,
          user: null as any,
          expires: new Date(0).toISOString()
        }
      }
      
      // Token válido, preencher dados do usuário
      session.user.id = (token.userId as string) || token.sub!
      session.user.subscriptionTier = token.subscriptionTier as string
      session.user.premiumExpiresAt = token.premiumExpiresAt as string
      session.user.trialStartedAt = token.trialStartedAt as string
      session.user.trialEndsAt = token.trialEndsAt as string
      
      return session
    },
    async redirect({ url, baseUrl }) {
      // Após login bem-sucedido, redirecionar para dashboard
      if (url === baseUrl || url === `${baseUrl}/login`) {
        return `${baseUrl}/dashboard`
      }
      // Se já estiver tentando acessar uma URL específica, usar essa URL
      if (url.startsWith(baseUrl)) {
        return url
      }
      // Para URLs externas, redirecionar para dashboard
      return `${baseUrl}/dashboard`
    }
  },
  pages: {
    signIn: "/login"
  }
}
