/**
 * API de Gestão de Dívidas
 * 
 * Endpoints:
 * GET /api/debt - Lista todas as dívidas do usuário
 * POST /api/debt - Cria nova dívida
 * PUT /api/debt - Atualiza dívida existente
 * DELETE /api/debt - Deleta dívida
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import {
  createDebt,
  getUserDebts,
  getDebtById,
  updateDebt,
  deleteDebt,
  CreateDebtInput,
  UpdateDebtInput
} from '@/lib/debt-service'

/**
 * GET /api/debt
 * Lista todas as dívidas do usuário logado
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const debts = await getUserDebts(user.id)

    return NextResponse.json({ debts })
  } catch (error) {
    console.error('Erro ao buscar dívidas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dívidas' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/debt
 * Cria nova dívida
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      name,
      balance,
      interestRateAnnual,
      termMonths,
      monthlyPayment,
      amortizationSystem
    } = body

    // Validações
    if (!name || !balance || !interestRateAnnual || !termMonths || !monthlyPayment || !amortizationSystem) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, balance, interestRateAnnual, termMonths, monthlyPayment, amortizationSystem' },
        { status: 400 }
      )
    }

    if (balance <= 0 || interestRateAnnual < 0 || termMonths <= 0 || monthlyPayment <= 0) {
      return NextResponse.json(
        { error: 'Valores inválidos' },
        { status: 400 }
      )
    }

    const input: CreateDebtInput = {
      userId: user.id,
      name,
      balance: Number(balance),
      interestRateAnnual: Number(interestRateAnnual),
      termMonths: Number(termMonths),
      monthlyPayment: Number(monthlyPayment),
      amortizationSystem: amortizationSystem as 'SAC' | 'PRICE'
    }

    const debt = await createDebt(input)

    return NextResponse.json({ debt }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar dívida:', error)
    return NextResponse.json(
      { error: 'Erro ao criar dívida' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/debt
 * Atualiza dívida existente
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID da dívida é obrigatório' },
        { status: 400 }
      )
    }

    const input: UpdateDebtInput = {}
    
    if (updateData.name !== undefined) input.name = updateData.name
    if (updateData.balance !== undefined) input.balance = Number(updateData.balance)
    if (updateData.interestRateAnnual !== undefined) input.interestRateAnnual = Number(updateData.interestRateAnnual)
    if (updateData.termMonths !== undefined) input.termMonths = Number(updateData.termMonths)
    if (updateData.monthlyPayment !== undefined) input.monthlyPayment = Number(updateData.monthlyPayment)
    if (updateData.amortizationSystem !== undefined) input.amortizationSystem = updateData.amortizationSystem

    const debt = await updateDebt(id, user.id, input)

    return NextResponse.json({ debt })
  } catch (error: any) {
    console.error('Erro ao atualizar dívida:', error)
    
    if (error.message?.includes('não encontrada')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao atualizar dívida' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/debt
 * Deleta dívida
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID da dívida é obrigatório' },
        { status: 400 }
      )
    }

    await deleteDebt(id, user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao deletar dívida:', error)
    
    if (error.message?.includes('não encontrada')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao deletar dívida' },
      { status: 500 }
    )
  }
}

