"use client"

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdminCheck } from '@/hooks/use-user-data'

/** Atalho para o painel admin (só administradores, desktop; no mobile o link fica no menu). */
export default function AdminLink() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { data: adminData, isLoading } = useAdminCheck()

  const isAdmin = adminData?.isAdmin || false

  if (isLoading || !session || !isAdmin || pathname?.startsWith('/admin')) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 hidden lg:block">
      <Button asChild variant="outline" size="sm" className="bg-background shadow-md">
        <Link href="/admin">
          <Shield className="size-4 text-muted-foreground" strokeWidth={1.75} />
          Painel admin
        </Link>
      </Button>
    </div>
  )
}
