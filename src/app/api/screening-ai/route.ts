import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserPremium } from '@/lib/user-service';
import { getSectorsAndIndustries, generateScreeningParameters } from '@/lib/screening-ai-service';

interface ScreeningAIRequest {
  prompt?: string;
  availableSectors?: string[];
  availableIndustries?: string[];
}

const DEFAULT_PROMPT = "Buscar as empresas sólidas mais descontadas";

export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário é Premium
    const isPremium = await isCurrentUserPremium();
    if (!isPremium) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Recurso disponível apenas para usuários Premium',
          message: 'A configuração automática com IA é um recurso exclusivo Premium. Faça upgrade para acessar.'
        },
        { status: 403 }
      );
    }

    const body: ScreeningAIRequest = await request.json();
    const userPrompt = body.prompt?.trim() || DEFAULT_PROMPT;
    
    // Buscar setores e indústrias se não fornecidos
    let availableSectors = body.availableSectors || [];
    let availableIndustries = body.availableIndustries || [];
    
    if (availableSectors.length === 0 || availableIndustries.length === 0) {
      const { sectors, industries } = await getSectorsAndIndustries();
      availableSectors = sectors;
      availableIndustries = industries;
    }

    // Gerar parâmetros usando o serviço
    const parameters = await generateScreeningParameters(
      userPrompt,
      availableSectors,
      availableIndustries
    );

    return NextResponse.json({
      success: true,
      parameters,
      prompt: userPrompt,
      message: `Parâmetros configurados com base em: "${userPrompt}"`
    });

  } catch (error) {
    console.error('Erro ao processar com IA:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao processar solicitação com IA', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}
