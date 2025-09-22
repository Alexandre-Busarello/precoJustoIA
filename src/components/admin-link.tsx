"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield } from 'lucide-react'

export default function AdminLink() {
  const { data: session } = useSession()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!session?.user?.id) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/admin/check')
        if (response.ok) {
          const data = await response.json()
          setIsAdmin(data.isAdmin)
        }
      } catch (error) {
        console.error('Erro ao verificar status de admin:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAdminStatus()
  }, [session])

  if (loading || !session || !isAdmin) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button asChild className="bg-red-600 hover:bg-red-700 text-white shadow-lg">
        <Link href="/admin/tickets" className="flex items-center gap-2">
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
