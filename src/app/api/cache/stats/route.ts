import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/user-service'
import { getCacheStats, clearQueryCache } from '@/lib/prisma-wrapper'
import { cache } from '@/lib/cache-service'

// GET /api/cache/stats - Obter estatísticas do cache (Admin only)
export async function GET() {
  try {
    // Verificar se é admin
    const user = await requireAdminUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Acesso negado. Apenas administradores.' 
      }, { status: 403 })
    }

    // Obter estatísticas do cache geral
    const generalStats = await cache.stats()
    
    // Obter estatísticas do cache de queries
    const queryStats = await getCacheStats()

    return NextResponse.json({
      general: generalStats,
      queries: queryStats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro ao obter estatísticas do cache:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}

// DELETE /api/cache/stats - Limpar cache (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    // Verificar se é admin
    const user = await requireAdminUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Acesso negado. Apenas administradores.' 
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const tables = searchParams.get('tables')
    const type = searchParams.get('type') || 'all'

    if (type === 'queries') {
      // Limpar apenas cache de queries
      if (tables) {
        const tableList = tables.split(',').map(t => t.trim())
        await clearQueryCache(tableList)
      } else {
        await clearQueryCache()
      }
    } else if (type === 'general') {
      // Limpar cache geral
      if (tables) {
        await cache.clear(tables)
      } else {
        await cache.clear()
      }
    } else {
      // Limpar tudo
      await cache.clear()
      await clearQueryCache()
    }

    return NextResponse.json({
      message: 'Cache limpo com sucesso',
      type,
      tables: tables ? tables.split(',') : 'all',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro ao limpar cache:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}
