import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log('🔍 Session user ID from NextAuth:', session.user.id)
    console.log('📧 Session user email:', session.user.email)

    // Usar o serviço centralizado para resolver o usuário correto
    const user = await getCurrentUser();

    if (!user) {
      console.log('❌ Usuário não encontrado no banco de dados')
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    console.log('✅ Usuário encontrado no banco:', {
      id: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
      isPremium: user.isPremium
    })

    return NextResponse.json({
      message: 'Sessão atualizada com sucesso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        premiumExpiresAt: user.premiumExpiresAt?.toISOString(),
        isPremium: user.isPremium,
        isVip: user.isVip,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar sessão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
