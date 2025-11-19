"use client"

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield } from 'lucide-react'
import { useAdminCheck } from '@/hooks/use-user-data'

export default function AdminLink() {
  const { data: session } = useSession()
  const { data: adminData, isLoading } = useAdminCheck()
  
  const isAdmin = adminData?.isAdmin || false

  if (isLoading || !session || !isAdmin) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button asChild className="bg-red-600 hover:bg-red-700 text-white shadow-lg">
        <Link href="/admin" className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline">Painel Admin</span>
          <Badge variant="secondary" className="bg-red-500 text-white text-xs">
            Admin
          </Badge>
        </Link>
      </Button>
    </div>
  )
}
