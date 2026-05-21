import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      subscriptionTier: string
      premiumExpiresAt?: string
      trialStartedAt?: string
      trialEndsAt?: string
      partnerId?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    subscriptionTier: string
    premiumExpiresAt?: Date
    trialStartedAt?: Date
    trialEndsAt?: Date
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    subscriptionTier: string
    premiumExpiresAt?: string
    trialStartedAt?: string
    trialEndsAt?: string
    userId?: string
    partnerId?: string | null
    exp?: number  // Timestamp de expiração
    iat?: number // Timestamp de criação
  }
}
