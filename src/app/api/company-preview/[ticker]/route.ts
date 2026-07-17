import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { cache } from '@/lib/cache-service';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';
import { AIReportsService } from '@/lib/ai-reports-service';

const CACHE_TTL = 1 * 60 * 60; // 1 hora em segundos

interface CompanyPreviewResponse {
  success: boolean;
  company: {
    ticker: string;
    name: string;
    sector: string | null;
    logoUrl: string | null;
  };
  reports: {
    monthly?: {
      id: string;
      conclusion: string | null;
      createdAt: Date;
    };
    priceVariation?: {
      id: string;
      conclusion: string | null;
      windowDays: number | null;
      createdAt: Date;
    };
  };
  flags: Array<{
    id: string;
    flagType: string;
    reason: string;
    reportId: string;
  }>;
  // Versão anônima: apenas Graham e Bazin com status, outras apenas nomes
  strategies: {
    graham?: { isEligible: boolean }; // Apenas status verde/vermelho
    barsi?: { isEligible: boolean }; // Apenas status verde/vermelho
    // Outras estratégias: apenas indicar que existem (sem scores)
    dividendYield?: boolean;
    lowPE?: boolean;
    magicFormula?: boolean;
    fcd?: boolean;
    gordon?: boolean;
    fundamentalist?: boolean;
  };
  // Campos com blur (não retornar valores reais)
  overallScore: null; // Sempre null para anônimo
  valuation: {
    status: 'green' | 'yellow' | 'red';
    label: string;
  };
  technical: {
    status: 'green' | 'yellow' | 'red';
    label: string;
  };
  sentiment: {
    status: 'green' | 'yellow' | 'red';
    label: string;
  };
  currentPrice: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const resolvedParams = await params;
    const ticker = resolvedParams.ticker.toUpperCase();

    // Cache key para preview (sempre anônimo para landing page)
    const cacheKey = `company-preview:v2:${ticker}`;

    // Verificar cache
    const cachedData = await cache.get<CompanyPreviewResponse>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Buscar empresa
    const company = await safeQueryWithParams(
      'company-preview-basic',
      () => prisma.company.findUnique({
        where: { ticker },
        select: {
          id: true,
          ticker: true,
          name: true,
          sector: true,
          logoUrl: true,
        },
      }),
      { ticker }
    ) as { id: number; ticker: string; name: string; sector: string | null; logoUrl: string | null } | null;

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // Função para formatar conclusão
    const formatConclusion = (conclusion: string | null): string | null => {
      if (!conclusion) return null;
      
      const trimmed = conclusion.trim();
      
      // Se já está formatado (contém emojis ou markdown), retornar como está
      if (trimmed.includes('✅') || trimmed.includes('⚠️') || trimmed.includes('📊') || trimmed.includes('**')) {
        return trimmed;
      }
      
      // Formatar valores raw com labels descritivos
      switch (trimmed) {
        case 'AJUSTE_DIVIDENDOS':
          return '✅ **Ajuste por Dividendos** - A variação de preço foi causada por ajuste de dividendos, não indicando perda de fundamento estrutural.';
        case 'AJUSTE_BONIFICACAO':
          return '✅ **Ajuste por Bonificação** - A variação de preço foi causada por ajuste após distribuição de ações gratuitas (bonificação), não indicando perda de fundamento estrutural.';
        case 'PERDA_DE_FUNDAMENTO':
          return '⚠️ **PERDA DE FUNDAMENTO DETECTADA** - A análise indica possível deterioração dos fundamentos da empresa.';
        case 'VOLATILIDADE_ESPERADA':
          return '📊 **Volatilidade Esperada** - A variação está dentro da volatilidade normal esperada para este ativo.';
        case 'MOVIMENTO_MERCADO':
          return '✅ **Movimento Normal de Mercado** - A variação reflete movimentos normais do mercado, sem indicação de problemas fundamentais.';
        case 'NOTICIA_ATIPICA':
          return '✅ **Reação a Notícia Atípica** - A variação foi causada por notícia específica, não indicando mudança estrutural nos fundamentos.';
        case 'AJUSTE_TECNICO':
          return '✅ **Ajuste Técnico** - A variação é um ajuste técnico normal, sem impacto nos fundamentos.';
        default:
          return trimmed;
      }
    };

    // Função para extrair conclusão do conteúdo
    const extractConclusionFromContent = (content: string): string | null => {
      // Buscar seção "## Conclusão do Analista" ou "## 6. Conclusão do Analista"
      // Pegar todo o conteúdo até o próximo título de nível 2 (##) ou fim do documento
      const conclusionMatch = content.match(/##\s*(?:6\.\s*)?Conclusão do Analista\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
      if (conclusionMatch && conclusionMatch[1]) {
        const conclusionText = conclusionMatch[1]
          .trim()
          // Remover markdown básico mas manter estrutura
          .replace(/\*\*([^*]+)\*\*/g, '**$1**') // Manter negrito
          .replace(/^#{1,6}\s+/gm, '') // Remover títulos internos
          .trim();
        
        if (conclusionText.length > 50) {
          return conclusionText;
        }
      }
      
      // Fallback: buscar "**Conclusão**:" em PRICE_VARIATION (pegar parágrafo completo)
      const analysisSectionMatch = content.match(/## Análise de Impacto Fundamental[\s\S]*?### Sobre a Queda de Preço[\s\S]*?\*\*Conclusão\*\*:\s*([^\n]+(?:\n[^\n]+)*)/i);
      if (analysisSectionMatch && analysisSectionMatch[1]) {
        const conclusionText = analysisSectionMatch[1].trim();
        // Se for um código, formatar; senão retornar como está
        if (/^[A-Z0-9_]+$/.test(conclusionText)) {
          return formatConclusion(conclusionText);
        }
        return conclusionText;
      }
      
      return null;
    };

    const displayCutoff = AIReportsService.getDisplayCutoffDate();

    // Buscar relatórios mais recentes (apenas últimos 6 meses) em paralelo
    const [monthlyReportRaw, priceVariationReportRaw, activeFlags] = await Promise.all([
      // Relatório mensal mais recente
      safeQueryWithParams(
        'ai-reports-monthly-latest',
        () => prisma.aIReport.findFirst({
          where: {
            companyId: company.id,
            type: 'MONTHLY_OVERVIEW',
            status: 'COMPLETED',
            createdAt: { gte: displayCutoff },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            conclusion: true,
            content: true,
            createdAt: true,
          },
        }),
        { companyId: company.id, type: 'MONTHLY_OVERVIEW', cutoff: displayCutoff.toISOString() }
      ) as unknown as { id: string; conclusion: string | null; content: string; createdAt: Date } | null,

      // Relatório de variação de preço mais recente
      safeQueryWithParams(
        'ai-reports-price-variation-latest',
        () => prisma.aIReport.findFirst({
          where: {
            companyId: company.id,
            type: 'PRICE_VARIATION',
            status: 'COMPLETED',
            createdAt: { gte: displayCutoff },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            conclusion: true,
            content: true,
            windowDays: true,
            createdAt: true,
          },
        }),
        { companyId: company.id, type: 'PRICE_VARIATION', cutoff: displayCutoff.toISOString() }
      ) as unknown as { id: string; conclusion: string | null; content: string; windowDays: number | null; createdAt: Date } | null,

      // Flags ativos com relatório para extrair texto amigável
      safeQueryWithParams(
        'company-flags-active-preview',
        () => prisma.companyFlag.findMany({
          where: {
            companyId: company.id,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            flagType: true,
            reason: true,
            reportId: true,
            report: {
              select: {
                id: true,
                content: true,
                type: true,
              },
            },
          },
        }),
        { companyId: company.id }
      ) as unknown as Array<{ 
        id: string; 
        flagType: string; 
        reason: string; 
        reportId: string;
        report: { id: string; content: string; type: string } | null;
      }>,
    ]);

    // Processar relatórios: extrair conclusão se não estiver disponível
    const monthlyReport = monthlyReportRaw ? {
      id: monthlyReportRaw.id,
      conclusion: monthlyReportRaw.conclusion 
        ? formatConclusion(monthlyReportRaw.conclusion)
        : extractConclusionFromContent(monthlyReportRaw.content),
      createdAt: monthlyReportRaw.createdAt,
    } : null;

    const priceVariationReport = priceVariationReportRaw ? {
      id: priceVariationReportRaw.id,
      conclusion: priceVariationReportRaw.conclusion 
        ? formatConclusion(priceVariationReportRaw.conclusion)
        : extractConclusionFromContent(priceVariationReportRaw.content),
      windowDays: priceVariationReportRaw.windowDays,
      createdAt: priceVariationReportRaw.createdAt,
    } : null;

    // Buscar análise da empresa para estratégias
    // Para preview anônimo, precisamos calcular Graham e Bazin mesmo sem login/premium
    // Usar isPremium=true temporariamente para calcular todas as estratégias, mas retornar apenas dados anônimos
    const analysisResult = await calculateCompanyOverallScore(ticker, {
      isPremium: true, // Temporariamente true para calcular todas as estratégias
      isLoggedIn: true, // Temporariamente true para calcular Graham
      includeStatements: false,
      includeStrategies: true,
    });

    const currentPrice = analysisResult?.currentPrice || 0;
    const overallScore = analysisResult?.overallScore?.score || null;

    // Extrair estratégias (versão anônima: apenas Graham e Bazin com status, outras apenas indicar existência)
    const strategies: CompanyPreviewResponse['strategies'] = {};
    if (analysisResult?.strategies) {
      const s = analysisResult.strategies;
      // Graham e Bazin: apenas status (verde/vermelho) - sempre retornar se calculado
      if (s.graham !== null && s.graham !== undefined) {
        strategies.graham = { isEligible: s.graham.isEligible };
      }
      if (s.barsi !== null && s.barsi !== undefined) {
        strategies.barsi = { isEligible: s.barsi.isEligible };
      }
      // Outras estratégias: apenas indicar que existem (sem scores) - sempre retornar se calculado
      if (s.dividendYield !== null && s.dividendYield !== undefined) {
        strategies.dividendYield = true;
      }
      if (s.lowPE !== null && s.lowPE !== undefined) {
        strategies.lowPE = true;
      }
      if (s.magicFormula !== null && s.magicFormula !== undefined) {
        strategies.magicFormula = true;
      }
      if (s.fcd !== null && s.fcd !== undefined) {
        strategies.fcd = true;
      }
      if (s.gordon !== null && s.gordon !== undefined) {
        strategies.gordon = true;
      }
      if (s.fundamentalist !== null && s.fundamentalist !== undefined) {
        strategies.fundamentalist = true;
      }
    }

    // Valores mockados para preview anônimo (não retornar valores reais)
    // Usar valores atrativos com cores apropriadas para gerar interesse
    const mockValuation = {
      status: 'green' as const,
      label: '+25.5%', // Mock: valor positivo atrativo
    };

    const mockTechnical = {
      status: 'green' as const,
      label: 'Compra', // Mock: status positivo
    };

    const mockSentiment = {
      status: 'green' as const,
      label: 'Positivo', // Mock: sentimento positivo
    };

    const response: CompanyPreviewResponse = {
      success: true,
      company: {
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        logoUrl: company.logoUrl,
      },
      reports: {
        ...(monthlyReport && monthlyReport.conclusion && {
          monthly: {
            id: monthlyReport.id,
            conclusion: monthlyReport.conclusion,
            createdAt: monthlyReport.createdAt,
          },
        }),
        ...(priceVariationReport && priceVariationReport.conclusion && {
          priceVariation: {
            id: priceVariationReport.id,
            conclusion: priceVariationReport.conclusion,
            windowDays: priceVariationReport.windowDays,
            createdAt: priceVariationReport.createdAt,
          },
        }),
      },
      flags: activeFlags.map(flag => {
        // Se o reason for um código (como "PERDA_DE_FUNDAMENTO"), tentar extrair texto amigável do relatório
        let friendlyReason = flag.reason;
        const isCodePattern = /^[A-Z0-9_]+$/.test(flag.reason);
        
        if (isCodePattern && flag.report?.content) {
          const reportContent = flag.report.content;
          
          // Para PRICE_VARIATION, buscar a seção "Raciocínio:" após "### Sobre a Queda de Preço"
          if (flag.report.type === 'PRICE_VARIATION') {
            const reasoningMatch = reportContent.match(/## Análise de Impacto Fundamental[\s\S]*?### Sobre a Queda de Preço[\s\S]*?\*\*Raciocínio\*\*:\s*([\s\S]*?)(?=\n##|\n###|$)/i);
            if (reasoningMatch && reasoningMatch[1]) {
              let reasoning = reasoningMatch[1].trim();
              // Limitar tamanho e remover markdown excessivo
              if (reasoning.length > 300) {
                reasoning = reasoning.substring(0, 297) + '...';
              }
              // Remover múltiplas quebras de linha
              reasoning = reasoning.replace(/\n{3,}/g, '\n\n');
              friendlyReason = reasoning;
            } else {
              // Fallback: buscar qualquer texto após a conclusão
              const conclusionMatch = reportContent.match(/## Análise de Impacto Fundamental[\s\S]*?\*\*Conclusão\*\*:[^\n]*\n([\s\S]{100,500})/i);
              if (conclusionMatch && conclusionMatch[1]) {
                let fallbackText = conclusionMatch[1].trim();
                if (fallbackText.length > 300) {
                  fallbackText = fallbackText.substring(0, 297) + '...';
                }
                friendlyReason = fallbackText.replace(/\n{3,}/g, '\n\n');
              } else {
                // Se não encontrar, usar mensagem genérica
                friendlyReason = 'Nossa inteligência artificial detectou uma situação crítica nesta empresa que requer atenção imediata.';
              }
            }
          } else {
            // Para outros tipos de relatório, buscar primeiro parágrafo significativo
            const firstParagraphMatch = reportContent.match(/\n\n([^\n]{50,300})/);
            if (firstParagraphMatch && firstParagraphMatch[1]) {
              friendlyReason = firstParagraphMatch[1].trim();
            } else {
              // Se não encontrar, usar mensagem genérica
              friendlyReason = 'Nossa inteligência artificial detectou uma situação crítica nesta empresa que requer atenção imediata.';
            }
          }
        }
        
        // Se ainda for um código, usar mensagem genérica
        if (/^[A-Z0-9_]+$/.test(friendlyReason)) {
          friendlyReason = 'Nossa inteligência artificial detectou uma situação crítica nesta empresa que requer atenção imediata.';
        }
        
        return {
          id: flag.id,
          flagType: 'Situação Crítica Detectada pela IA', // Título amigável
          reason: friendlyReason,
          reportId: flag.reportId,
        };
      }),
      strategies,
      overallScore: null, // Sempre null para anônimo (com blur no frontend)
      valuation: mockValuation, // Valores mockados para preview
      technical: mockTechnical, // Valores mockados para preview
      sentiment: mockSentiment, // Valores mockados para preview
      currentPrice,
    };

    // Salvar no cache
    await cache.set(cacheKey, response, { ttl: CACHE_TTL });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro ao buscar preview da empresa:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

