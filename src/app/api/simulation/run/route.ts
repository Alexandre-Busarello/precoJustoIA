/**
 * API de Execução de Simulação
 * 
 * POST /api/simulation/run
 * 
 * Executa simulação de arbitragem de dívida com validação de plano:
 * - Free: apenas FIXED_RATE permitido
 * - PRO: todas as estratégias disponíveis
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { getDebtById } from '@/lib/debt-service'
import { resolveRentability, StrategySource } from '@/lib/rentability-service'
import { runSimulation, SimulationParams } from '@/lib/simulation-engine'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    const isAuthenticated = !!user

    const body = await request.json()
    const {
      debtId,
      debtIds, // Para múltiplas dívidas
      monthlyBudget,
      investmentSplit,
      monthlyTR, // Taxa Referencial mensal (padrão: 0.001 = 0,1%)
      strategyType,
      manualRateFixed,
      portfolioId,
      rankingId,
      manualTickers,
      debtData // Para modo visitante
    } = body

    // Validações básicas
    if (!monthlyBudget || strategyType === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: monthlyBudget, strategyType' },
        { status: 400 }
      )
    }

    // Buscar dívida(s) ou usar dados inline (modo visitante)
    let debt
    if (debtIds && Array.isArray(debtIds) && debtIds.length > 0) {
      // Múltiplas dívidas: buscar todas e agregar
      if (!user) {
        return NextResponse.json(
          { error: 'Usuário não autenticado. Múltiplas dívidas requerem autenticação.' },
          { status: 401 }
        )
      }
      const debts = await Promise.all(
        debtIds.map((id: string) => getDebtById(id, user.id))
      )
      
      const validDebts = debts.filter(d => d !== null)
      if (validDebts.length === 0) {
        return NextResponse.json(
          { error: 'Nenhuma dívida válida encontrada' },
          { status: 404 }
        )
      }

      // Agregar dados: somar saldos e prestações, calcular taxa média ponderada
      const totalBalance = validDebts.reduce((sum, d) => sum + Number(d.balance), 0)
      const totalMonthlyPayment = validDebts.reduce((sum, d) => sum + Number(d.monthlyPayment), 0)
      
      // Taxa média ponderada pelo saldo
      const weightedRate = totalBalance > 0
        ? validDebts.reduce((sum, d) => {
            return sum + (Number(d.interestRateAnnual) * Number(d.balance))
          }, 0) / totalBalance
        : 0

      debt = {
        balance: totalBalance,
        monthlyPayment: totalMonthlyPayment,
        interestRateAnnual: weightedRate
      }
    } else if (debtId && debtId !== 'temp') {
      if (!user) {
        return NextResponse.json(
          { error: 'Usuário não autenticado. Dívida específica requer autenticação.' },
          { status: 401 }
        )
      }
      const debtRecord = await getDebtById(debtId, user.id)
      if (!debtRecord) {
        return NextResponse.json(
          { error: 'Dívida não encontrada' },
          { status: 404 }
        )
      }
      debt = {
        balance: debtRecord.balance,
        monthlyPayment: debtRecord.monthlyPayment,
        interestRateAnnual: debtRecord.interestRateAnnual,
        amortizationSystem: debtRecord.amortizationSystem || 'SAC',
        termMonths: debtRecord.termMonths || 0
      }
    } else if (debtData) {
      // Modo visitante: usar dados inline
      debt = {
        balance: debtData.balance,
        monthlyPayment: debtData.monthlyPayment,
        interestRateAnnual: debtData.interestRateAnnual,
        amortizationSystem: debtData.amortizationSystem || 'SAC',
        termMonths: debtData.termMonths || 0
      }
    } else {
      return NextResponse.json(
        { error: 'Dados da dívida são obrigatórios' },
        { status: 400 }
      )
    }

    // VALIDAÇÃO CRÍTICA: Free só pode usar FIXED_RATE
    if (isAuthenticated && !user.isPremium && strategyType !== 'FIXED_RATE') {
      return NextResponse.json(
        {
          error: 'Acesso restrito. Apenas usuários Premium podem usar estratégias avançadas (Carteira, Rankings, Tickers).',
          requiresPremium: true
        },
        { status: 403 }
      )
    }

    // Validar estratégia específica
    if (strategyType === 'FIXED_RATE') {
      if (!manualRateFixed || manualRateFixed <= 0) {
        return NextResponse.json(
          { error: 'Taxa manual deve ser maior que zero' },
          { status: 400 }
        )
      }
    } else if (strategyType === 'PORTFOLIO') {
      if (!portfolioId) {
        return NextResponse.json(
          { error: 'portfolioId é obrigatório para estratégia PORTFOLIO' },
          { status: 400 }
        )
      }
    } else if (strategyType === 'RANKING') {
      if (!rankingId) {
        return NextResponse.json(
          { error: 'rankingId é obrigatório para estratégia RANKING' },
          { status: 400 }
        )
      }
    } else if (strategyType === 'MANUAL_TICKERS') {
      if (!manualTickers || manualTickers.length === 0) {
        return NextResponse.json(
          { error: 'manualTickers é obrigatório para estratégia MANUAL_TICKERS' },
          { status: 400 }
        )
      }
    }

    // Resolver rentabilidade
    let rentability
    try {
      rentability = await resolveRentability({
        strategyType: strategyType as StrategySource,
        userId: user?.id,
        manualRate: manualRateFixed,
        portfolioId,
        rankingId,
        manualTickers
      })
    } catch (error: any) {
      return NextResponse.json(
        { error: `Erro ao calcular rentabilidade: ${error.message}` },
        { status: 400 }
      )
    }

    // Preparar parâmetros de simulação
    const simulationParams: SimulationParams = {
      initialDebtBalance: Number(debt.balance),
      monthlyPayment: Number(debt.monthlyPayment),
      debtAnnualRate: Number(debt.interestRateAnnual),
      amortizationSystem: debt.amortizationSystem || 'SAC',
      termMonths: debt.termMonths || 0,
      monthlyBudget: Number(monthlyBudget),
      strategy: 'HYBRID', // Será calculado ambas estratégias
      investmentSplit: investmentSplit ? Number(investmentSplit) : 0,
      investmentAnnualRate: rentability.annualRate,
      monthlyTR: monthlyTR ? Number(monthlyTR) : undefined, // TR mensal (padrão: 0.001 = 0,1%)
      maxMonths: 360 // 30 anos
    }

    // Executar simulação (ambas estratégias)
    const results = runSimulation(simulationParams)

    // Salvar configuração se usuário logado (Free ou Pro) e tiver debtId válido (apenas para uma dívida)
    // Não salvar quando há múltiplas dívidas selecionadas
    if (isAuthenticated && debtId && debtId !== 'temp' && !debtIds) {
      try {
        await prisma.userSimulationConfig.upsert({
          where: {
            debtId
          },
          create: {
            debtId,
            monthlyBudget: Number(monthlyBudget),
            investmentSplit: investmentSplit ? Number(investmentSplit) : 0,
            monthlyTR: monthlyTR ? Number(monthlyTR) : 0.001, // TR padrão 0,1%
            strategyType: strategyType as StrategySource,
            manualRateFixed: manualRateFixed ? Number(manualRateFixed) : null,
            rankingId: rankingId || null,
            manualTickers: manualTickers || []
          },
          update: {
            monthlyBudget: Number(monthlyBudget),
            investmentSplit: investmentSplit ? Number(investmentSplit) : 0,
            monthlyTR: monthlyTR ? Number(monthlyTR) : 0.001, // TR padrão 0,1%
            strategyType: strategyType as StrategySource,
            manualRateFixed: manualRateFixed ? Number(manualRateFixed) : null,
            rankingId: rankingId || null,
            manualTickers: manualTickers || []
          }
        })
      } catch (error) {
        console.error('Erro ao salvar configuração de simulação:', error)
        // Não falhar a requisição se não conseguir salvar
      }
    }

    // Formatar resposta para gráfico
    const sniperData = results.sniper.monthlySnapshots.map(s => ({
      month: s.month,
      debtBalance: s.debtBalance,
      investedBalance: s.investedBalance,
      netWorth: s.netWorth
    }))

    const hybridData = results.hybrid.monthlySnapshots.map(s => ({
      month: s.month,
      debtBalance: s.debtBalance,
      investedBalance: s.investedBalance,
      netWorth: s.netWorth
    }))
    
    // DEBUG: Log dos últimos snapshots para verificar dados
    console.log('\n=== DEBUG API - ÚLTIMOS SNAPSHOTS ===')
    console.log(`Total snapshots Sniper: ${sniperData.length}`)
    console.log(`Total snapshots Híbrido: ${hybridData.length}`)
    if (sniperData.length > 0) {
      const lastSniper = sniperData[sniperData.length - 1]
      console.log(`Último snapshot Sniper - Mês: ${lastSniper.month}, Investido: ${lastSniper.investedBalance.toFixed(2)}`)
    }
    if (hybridData.length > 0) {
      const lastHybrid = hybridData[hybridData.length - 1]
      console.log(`Último snapshot Híbrido - Mês: ${lastHybrid.month}, Investido: ${lastHybrid.investedBalance.toFixed(2)}`)
      console.log(`Últimos 3 snapshots Híbrido:`)
      hybridData.slice(-3).forEach((s, i) => {
        console.log(`  [${i + 1}] Mês ${s.month}: Investido=${s.investedBalance.toFixed(2)}, Dívida=${s.debtBalance.toFixed(2)}`)
      })
    }
    console.log(`=== FIM DEBUG API ===\n`)

    return NextResponse.json({
      success: true,
      rentability: {
        annualRate: rentability.annualRate,
        source: rentability.source,
        details: rentability.details
      },
      sniper: {
        breakEvenMonth: results.sniper.breakEvenMonth,
        finalDebtBalance: results.sniper.finalDebtBalance,
        finalInvestedBalance: results.sniper.finalInvestedBalance,
        finalNetWorth: results.sniper.finalNetWorth,
        totalInterestPaid: results.sniper.totalInterestPaid,
        totalInvestmentContribution: results.sniper.totalInvestmentContribution,
        totalInvestmentReturn: results.sniper.totalInvestmentReturn,
        monthlyData: sniperData
      },
      hybrid: {
        breakEvenMonth: results.hybrid.breakEvenMonth,
        finalDebtBalance: results.hybrid.finalDebtBalance,
        finalInvestedBalance: results.hybrid.finalInvestedBalance,
        finalNetWorth: results.hybrid.finalNetWorth,
        totalInterestPaid: results.hybrid.totalInterestPaid,
        totalInvestmentContribution: results.hybrid.totalInvestmentContribution,
        totalInvestmentReturn: results.hybrid.totalInvestmentReturn,
        monthlyData: hybridData
      }
    })
  } catch (error: any) {
    console.error('Erro ao executar simulação:', error)
    return NextResponse.json(
      { error: `Erro ao executar simulação: ${error.message}` },
      { status: 500 }
    )
  }
}

