/**
 * EXEMPLO PRÁTICO: INTEGRAÇÃO DO MIDDLEWARE DE SEGURANÇA
 * 
 * Este arquivo mostra como refatorar APIs existentes para usar o novo
 * middleware de segurança, mantendo a funcionalidade atual.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireAdminUser } from '@/lib/user-service';
import { withSecurity, SecurityMiddleware } from '@/lib/security-middleware';
import { prisma } from '@/lib/prisma';

// =====================================================
// EXEMPLO 1: API DE DADOS DO USUÁRIO (ANTES E DEPOIS)
// =====================================================

// ❌ ANTES: Validação manual repetitiva
export async function GET_OLD(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Lógica da API...
    const userData = await prisma.user.findUnique({
      where: { id: currentUser.id }
    });

    return NextResponse.json(userData);

  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ✅ DEPOIS: Com middleware de segurança
export async function GET_NEW(request: NextRequest) {
  return withSecurity(request, 'USER_DATA_ACCESS', async ({ user }) => {
    // Usuário já validado pelo middleware
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        subscriptionTier: true,
        premiumExpiresAt: true
      }
    });

    return Response.json(userData);
  });
}

// =====================================================
// EXEMPLO 2: API PREMIUM (BACKTEST)
// =====================================================

// ❌ ANTES: Validação Premium manual
export async function POST_BACKTEST_OLD(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const currentUser = await getCurrentUser();
    
    if (!currentUser?.isPremium) {
      return NextResponse.json({ 
        error: 'Acesso exclusivo para usuários Premium',
        upgradeUrl: '/dashboard'
      }, { status: 403 });
    }

    // Lógica do backtest...
    const body = await request.json();
    const result = await createBacktest(currentUser.id, body);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro no backtest:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ✅ DEPOIS: Com middleware Premium
export async function POST_BACKTEST_NEW(request: NextRequest) {
  return withSecurity(request, 'PREMIUM_FEATURE', async ({ user }) => {
    // Usuário Premium já validado
    const body = await request.json();
    
    const result = await createBacktest(user.id, body);
    return Response.json(result);
  });
}

// =====================================================
// EXEMPLO 3: API ADMIN
// =====================================================

// ❌ ANTES: Validação Admin manual
export async function GET_ADMIN_OLD(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = await requireAdminUser();

    if (!user) {
      return NextResponse.json({ 
        error: 'Acesso negado. Apenas administradores.' 
      }, { status: 403 });
    }

    // Lógica admin...
    const adminData = await getAdminDashboardData();
    return NextResponse.json(adminData);

  } catch (error) {
    console.error('Erro admin:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ✅ DEPOIS: Com middleware Admin
export async function GET_ADMIN_NEW(request: NextRequest) {
  return withSecurity(request, 'ADMIN_OPERATION', async ({ user }) => {
    // Admin já validado
    const adminData = await getAdminDashboardData();
    return Response.json(adminData);
  });
}

// =====================================================
// EXEMPLO 4: VALIDAÇÃO MANUAL AVANÇADA
// =====================================================

// Para casos que precisam de validação customizada
export async function GET_CUSTOM_VALIDATION(request: NextRequest) {
  const validation = await SecurityMiddleware.validateOperation(
    request, 
    'USER_DATA_ACCESS',
    {
      userId: 'user-id-from-params',
      resourceId: 'resource-id',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    }
  );

  if (!validation.allowed) {
    // Log automático de atividade suspeita
    SecurityMiddleware.logSuspiciousActivity(
      'USER_DATA_ACCESS',
      validation.reason!,
      {
        userEmail: validation.user?.email,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined
      }
    );

    return new Response(
      JSON.stringify({ 
        error: 'Acesso negado',
        code: validation.reason 
      }),
      { 
        status: validation.reason === 'AUTHENTICATION_REQUIRED' ? 401 : 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Continuar com a lógica...
  const data = await getCustomData(validation.user.id);
  return Response.json(data);
}

// =====================================================
// EXEMPLO 5: MIGRAÇÃO COMPLETA DE API EXISTENTE
// =====================================================

// Refatoração da API /api/ranking/[id]/route.ts
export async function GET_RANKING_REFACTORED(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(request, 'USER_DATA_ACCESS', async ({ user }) => {
    const { id } = await params;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID do ranking é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Buscar ranking com validação de propriedade automática
    const ranking = await prisma.rankingHistory.findFirst({
      where: {
        id: id,
        userId: user.id // Garantir que pertence ao usuário
      },
      select: {
        id: true,
        model: true,
        params: true,
        results: true,
        resultCount: true,
        createdAt: true,
      }
    });

    if (!ranking) {
      return new Response(
        JSON.stringify({ error: 'Ranking não encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return Response.json({
      ...ranking,
      modelName: getModelFriendlyName(ranking.model)
    });
  });
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

async function createBacktest(userId: string, config: any) {
  // Implementação do backtest
  return { id: 'backtest-id', status: 'created' };
}

async function getAdminDashboardData() {
  // Implementação dos dados admin
  return { totalUsers: 100, premiumUsers: 25 };
}

async function getCustomData(userId: string) {
  // Implementação de dados customizados
  return { userId, data: 'custom-data' };
}

function getModelFriendlyName(model: string): string {
  const modelNames: Record<string, string> = {
    'graham': 'Benjamin Graham',
    'lynch': 'Peter Lynch',
    'buffett': 'Warren Buffett',
    'fundamentalist': 'Fundamentalista 3+1'
  };
  
  return modelNames[model] || model;
}

// =====================================================
// RESUMO DOS BENEFÍCIOS
// =====================================================

/*
✅ BENEFÍCIOS DA MIGRAÇÃO:

1. **CÓDIGO MAIS LIMPO**
   - Eliminação de validações repetitivas
   - Foco na lógica de negócio
   - Menos código boilerplate

2. **SEGURANÇA PADRONIZADA**
   - Validações consistentes em todas as APIs
   - Rate limiting automático
   - Logs de auditoria centralizados

3. **MANUTENÇÃO SIMPLIFICADA**
   - Mudanças de segurança em um local
   - Testes centralizados
   - Debugging facilitado

4. **PERFORMANCE**
   - Cache de validações
   - Menos queries duplicadas
   - Rate limiting eficiente

5. **CONFORMIDADE**
   - Logs automáticos para auditoria
   - Controle granular de acesso
   - Proteção contra ataques

MIGRAÇÃO RECOMENDADA:
- Começar pelas APIs mais críticas (dados de usuário, admin)
- Testar uma API por vez
- Manter logs detalhados durante a migração
- Monitorar performance após cada mudança
*/
