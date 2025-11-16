/**
 * Ticker Validation API Route
 * POST /api/ticker/validate
 * 
 * Valida se um ticker existe no Yahoo Finance antes de permitir adicionar à carteira
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateTicker } from '@/lib/quote-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.ticker || typeof body.ticker !== 'string') {
      return NextResponse.json(
        { error: 'Ticker é obrigatório', valid: false },
        { status: 400 }
      );
    }

    const ticker = body.ticker.toUpperCase().trim();
    
    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker não pode estar vazio', valid: false },
        { status: 400 }
      );
    }

    // Validar ticker usando o serviço de validação
    try {
      await validateTicker(ticker);
      
      return NextResponse.json({
        valid: true,
        ticker,
        message: 'Ticker válido'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ticker inválido';
      
      return NextResponse.json({
        valid: false,
        ticker,
        error: errorMessage,
        message: `Ticker "${ticker}" não encontrado no Yahoo Finance. Verifique se o ticker está correto.`
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Erro ao validar ticker:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao validar ticker',
        valid: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

