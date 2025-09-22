import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { Adapter } from "next-auth/adapters"

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
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Se é um novo login, usar dados do user
      if (user) {
        token.subscriptionTier = user.subscriptionTier || "FREE"
        token.premiumExpiresAt = user.premiumExpiresAt?.toISOString()
      }
      
      // Se é uma atualização da sessão, buscar dados atualizados do banco
      if (trigger === "update" && token.sub) {
        try {
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              subscriptionTier: true,
              premiumExpiresAt: true,
            }
          })
          
          if (updatedUser) {
            token.subscriptionTier = updatedUser.subscriptionTier
            token.premiumExpiresAt = updatedUser.premiumExpiresAt?.toISOString()
          }
        } catch (error) {
          console.error('Erro ao atualizar token JWT:', error)
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.subscriptionTier = token.subscriptionTier as string
        session.user.premiumExpiresAt = token.premiumExpiresAt as string
      }
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
