/**
 * API: Detect Ticker Changes with Gemini AI
 * POST /api/admin/ticker-migration/detect
 * 
 * Detecta mudanças de tickers usando Gemini AI, excluindo migrações já realizadas
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/user-service';
import { GoogleGenAI } from '@google/genai';
import { TickerMigrationService } from '@/lib/ticker-migration-service';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação e admin
    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API key do Gemini não configurada' },
        { status: 500 }
      );
    }

    // Buscar migrações já realizadas
    const completedMigrations = await TickerMigrationService.getCompletedMigrations();
    const exclusionList =
      completedMigrations.length > 0
        ? completedMigrations
            .map((m) => `${m.oldTicker}->${m.newTicker}`)
            .join(', ')
        : 'Nenhuma migração realizada ainda.';

    // Criar sets para validação rápida
    const migratedOldTickers = new Set(
      completedMigrations.map((m) => m.oldTicker.toUpperCase())
    );
    const migratedNewTickers = new Set(
      completedMigrations.map((m) => m.newTicker.toUpperCase())
    );

    /**
     * Valida formato de ticker B3
     * Formato válido: 4 letras + 1-2 dígitos (ex: PETR4, VALE3, ITUB4)
     * Ou ETFs/FIIs/BDRs: 4 letras + 11 (ex: BOVA11, HGBS11)
     * Ou BDRs: 4 letras + 34/35 (ex: AAPL34, MSFT35)
     */
    const isValidTickerFormat = (ticker: string): boolean => {
      const normalized = ticker.toUpperCase().trim();
      // Padrão: 4 letras + 1-2 dígitos ou 11, 34, 35
      const b3Pattern = /^[A-Z]{4}\d{1,2}$/;
      return b3Pattern.test(normalized);
    };

    // Configurar Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const systemPrompt = `Você é um assistente especializado em Mercado Financeiro Brasileiro (B3) para a plataforma Preço Justo AI.
Sua tarefa é identificar empresas que mudaram seus códigos de negociação (tickers) nos últimos 12 meses ou anunciaram mudança iminente.

IMPORTANTE: Use a ferramenta de busca do Google (googleSearch) para pesquisar informações atualizadas sobre mudanças de tickers na B3. 
Busque por notícias recentes, comunicados da B3, e informações de empresas que realizaram rebranding, fusões ou reestruturações.

REGRA DE EXCLUSÃO:
Ignore as seguintes migrações que já foram realizadas na plataforma:
${exclusionList}
(Não sugira nenhum par listado acima).

Retorne APENAS um JSON array estrito com o seguinte schema, sem markdown:
[
  {
    "oldTicker": "STRING",
    "newTicker": "STRING",
    "reason": "STRING (Ex: Rebranding, Fusão, Reestruturação)",
    "confidence": "High" | "Medium" | "Low"
  }
]

Se não houver mudanças recentes para sugerir, retorne um array vazio: [].`;

    const model = 'gemini-2.5-flash-lite';
    const tools = [{ googleSearch: {} }];
    
    const config = {
      thinkingConfig: {
        thinkingBudget: 0,
      },
      tools,
    };

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
    ];

    const response = await ai.models.generateContentStream({
      model,
      contents,
      config,
    });

    let fullResponse = '';
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }

    if (!fullResponse.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    // Extrair JSON da resposta (pode vir com markdown)
    const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Não foi possível extrair JSON da resposta do Gemini' },
        { status: 500 }
      );
    }

    try {
      const suggestions = JSON.parse(jsonMatch[0]);

      // Validar estrutura
      if (!Array.isArray(suggestions)) {
        return NextResponse.json(
          { error: 'Resposta do Gemini não é um array' },
          { status: 500 }
        );
      }

      // Validar estrutura básica de cada sugestão
      const structurallyValidSuggestions = suggestions.filter(
        (s: any) =>
          s.oldTicker &&
          s.newTicker &&
          s.reason &&
          ['High', 'Medium', 'Low'].includes(s.confidence)
      );

      // Buscar empresas já migradas no banco (verificação adicional)
      const migratedCompaniesInDb = await prisma.company.findMany({
        where: {
          isActive: false,
          successorId: { not: null },
        },
        select: {
          ticker: true,
        },
      });
      const migratedTickersInDb = new Set(
        migratedCompaniesInDb.map((c) => c.ticker.toUpperCase())
      );

      // Filtrar tickers inválidos e já migrados
      const filteredSuggestions = structurallyValidSuggestions.filter(
        (s: any) => {
          const oldTicker = s.oldTicker.toUpperCase().trim();
          const newTicker = s.newTicker.toUpperCase().trim();

          // Validar formato dos tickers (formato B3: 4 letras + 1-2 dígitos)
          if (!isValidTickerFormat(oldTicker) || !isValidTickerFormat(newTicker)) {
            console.log(
              `⚠️ Sugestão filtrada - formato inválido: ${oldTicker} -> ${newTicker}`
            );
            return false;
          }

          // Verificar se oldTicker já foi migrado (no histórico ou no banco)
          if (
            migratedOldTickers.has(oldTicker) ||
            migratedTickersInDb.has(oldTicker)
          ) {
            console.log(
              `⚠️ Sugestão filtrada - ticker antigo já migrado: ${oldTicker}`
            );
            return false;
          }

          // Verificar se newTicker já foi migrado (como oldTicker de outra migração)
          if (
            migratedOldTickers.has(newTicker) ||
            migratedTickersInDb.has(newTicker)
          ) {
            console.log(
              `⚠️ Sugestão filtrada - ticker novo já foi migrado anteriormente: ${newTicker}`
            );
            return false;
          }

          return true;
        }
      );

      const filteredCount =
        structurallyValidSuggestions.length - filteredSuggestions.length;

      return NextResponse.json({
        suggestions: filteredSuggestions,
        exclusionList,
        totalExcluded: completedMigrations.length,
        filteredCount,
        totalReceived: suggestions.length,
      });
    } catch (parseError) {
      console.error('Erro ao parsear resposta do Gemini:', parseError);
      return NextResponse.json(
        {
          error: 'Erro ao processar resposta do Gemini',
          rawResponse: fullResponse.substring(0, 500),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao detectar mudanças de tickers:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao detectar mudanças de tickers',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

