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
      if (user?.id) {
        try {
          // Verificar se usuário acabou de ser criado (primeiro login)
          // O PrismaAdapter cria o usuário antes deste callback ser chamado
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              createdAt: true,
              trialStartedAt: true,
              trialEndsAt: true,
              subscriptionTier: true
            }
          })

          // Se usuário foi criado há menos de 1 minuto e não tem trial iniciado
          // e não é Premium, iniciar trial
          if (dbUser && !dbUser.trialStartedAt && dbUser.subscriptionTier === 'FREE') {
            const now = new Date()
            const userCreatedAt = dbUser.createdAt
            const timeDiff = now.getTime() - userCreatedAt.getTime()
            const minutesDiff = timeDiff / (1000 * 60)

            // Se foi criado há menos de 1 minuto, é um novo usuário
            if (minutesDiff < 1) {
              await startTrialForUser(user.id)
              // Atualizar user com dados do trial iniciado para incluir na sessão
              const updatedUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: {
                  trialStartedAt: true,
                  trialEndsAt: true
                }
              })
              if (updatedUser) {
                user.trialStartedAt = updatedUser.trialStartedAt ?? undefined
                user.trialEndsAt = updatedUser.trialEndsAt ?? undefined
              }
            }
          }
        } catch (error) {
          // Não falhar o login se houver erro ao iniciar trial
          console.error('Erro ao verificar/iniciar trial no login:', error)
        }
      }
      return true
    },
    async jwt({ token, user, trigger }) {
      // Se é um novo login, não precisa verificar expiração
      if (user) {
        token.userId = user.id // Armazenar o ID real do usuário
        token.subscriptionTier = user.subscriptionTier || "FREE"
        token.premiumExpiresAt = user.premiumExpiresAt?.toISOString()
        token.trialStartedAt = user.trialStartedAt?.toISOString()
        token.trialEndsAt = user.trialEndsAt?.toISOString()
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
