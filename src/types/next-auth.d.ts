import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      subscriptionTier: string
      premiumExpiresAt?: string
    } & DefaultSession["user"]
  }

  interface User {
    subscriptionTier: string
    premiumExpiresAt?: Date
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    subscriptionTier: string
    premiumExpiresAt?: string
  }
}
