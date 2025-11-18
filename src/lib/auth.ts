import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { Adapter } from "next-auth/adapters"
import { startTrialForUser } from "@/lib/trial-service"

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
      // Após login bem-sucedido (especialmente OAuth), verificar e iniciar trial se necessário
      // IMPORTANTE: Para OAuth, user.id pode ser o ID do provider (Google), não o ID do banco
      // Por isso buscamos pelo email que é único e confiável
      // O PrismaAdapter cria o usuário durante este callback, então pode haver um pequeno delay
      if (user?.email) {
        try {
          // Tentar buscar o usuário com retry (o PrismaAdapter pode ainda estar criando)
          let dbUser = null
          let retries = 3
          while (retries > 0 && !dbUser) {
            dbUser = await prisma.user.findUnique({
              where: { email: user.email },
              select: {
                id: true,
                createdAt: true,
                trialStartedAt: true,
                trialEndsAt: true,
                subscriptionTier: true
              }
            })
            
            if (!dbUser && retries > 1) {
              // Aguardar um pouco antes de tentar novamente
              await new Promise(resolve => setTimeout(resolve, 100))
              retries--
            } else {
              break
            }
          }

          if (!dbUser) {
            console.warn(`[TRIAL] Usuário com email ${user.email} não encontrado no banco após ${3 - retries + 1} tentativas. Trial será verificado no callback jwt.`)
            // Não falhar o login - vamos tentar novamente no callback jwt
            return true
          }

          // Se usuário foi criado há menos de 5 minutos e não tem trial iniciado
          // e não é Premium, tentar iniciar trial
          if (!dbUser.trialStartedAt && dbUser.subscriptionTier === 'FREE') {
            const now = new Date()
            const userCreatedAt = dbUser.createdAt
            const timeDiff = now.getTime() - userCreatedAt.getTime()
            const minutesDiff = timeDiff / (1000 * 60)

            // Se foi criado há menos de 5 minutos, é um novo usuário
            // Aumentado para 5 minutos para evitar race conditions
            if (minutesDiff < 5) {
              console.log(`[TRIAL] Tentando iniciar trial para novo usuário ${dbUser.id} (${user.email}) criado há ${minutesDiff.toFixed(2)} minutos`)
              const trialStarted = await startTrialForUser(dbUser.id)
              
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
            } else {
              console.log(`[TRIAL] Usuário ${dbUser.id} (${user.email}) criado há ${minutesDiff.toFixed(2)} minutos - não é novo usuário`)
            }
          } else if (dbUser.trialStartedAt) {
            console.log(`[TRIAL] Usuário ${dbUser.id} (${user.email}) já possui trial iniciado`)
          } else if (dbUser.subscriptionTier === 'PREMIUM') {
            console.log(`[TRIAL] Usuário ${dbUser.id} (${user.email}) já é Premium - não precisa de trial`)
          }
        } catch (error) {
          // Não falhar o login se houver erro ao iniciar trial
          console.error('[TRIAL] Erro ao verificar/iniciar trial no login:', error)
        }
      }
      return true
    },
    async jwt({ token, user, trigger }) {
      // Se é um novo login, verificar e iniciar trial se necessário
      if (user) {
        console.log(`[TRIAL] [JWT] Novo login detectado - user.id: ${user.id}, user.email: ${user.email}`)
        
        // Sempre buscar pelo email para garantir que temos o ID correto do banco
        // Isso é especialmente importante para OAuth onde o user.id pode ser do provider
        if (user.email) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email },
              select: {
                id: true,
                createdAt: true,
                trialStartedAt: true,
                trialEndsAt: true,
                subscriptionTier: true
              }
            })

            if (dbUser) {
              console.log(`[TRIAL] [JWT] Usuário encontrado no banco: ${dbUser.id} (${user.email}), trialStartedAt: ${dbUser.trialStartedAt}, subscriptionTier: ${dbUser.subscriptionTier}`)
              
              // Usar o ID real do banco
              token.userId = dbUser.id
              
              // Verificar se precisa iniciar trial (novo usuário sem trial)
              if (!dbUser.trialStartedAt && dbUser.subscriptionTier === 'FREE') {
                const now = new Date()
                const userCreatedAt = dbUser.createdAt
                const timeDiff = now.getTime() - userCreatedAt.getTime()
                const minutesDiff = timeDiff / (1000 * 60)

                console.log(`[TRIAL] [JWT] Usuário criado há ${minutesDiff.toFixed(2)} minutos`)

                // Se foi criado há menos de 5 minutos, é um novo usuário
                if (minutesDiff < 5) {
                  console.log(`[TRIAL] [JWT] ✅ Novo usuário detectado! Tentando iniciar trial para ${dbUser.id} (${user.email})`)
                  const trialStarted = await startTrialForUser(dbUser.id)
                  
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
                  console.log(`[TRIAL] [JWT] Usuário ${dbUser.id} (${user.email}) criado há ${minutesDiff.toFixed(2)} minutos - não é novo usuário (limite: 5 minutos)`)
                }
              } else {
                if (dbUser.trialStartedAt) {
                  console.log(`[TRIAL] [JWT] Usuário ${dbUser.id} já possui trial iniciado`)
                } else if (dbUser.subscriptionTier === 'PREMIUM') {
                  console.log(`[TRIAL] [JWT] Usuário ${dbUser.id} já é Premium - não precisa de trial`)
                }
              }
              
              // Atualizar token com dados do banco
              token.subscriptionTier = dbUser.subscriptionTier || "FREE"
              token.trialStartedAt = dbUser.trialStartedAt?.toISOString()
              token.trialEndsAt = dbUser.trialEndsAt?.toISOString()
              token.premiumExpiresAt = user.premiumExpiresAt?.toISOString()
            } else {
              console.warn(`[TRIAL] [JWT] ⚠️ Usuário com email ${user.email} não encontrado no banco`)
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
