import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmailBaseUrl, getEmailLogoUrl, sendEmail } from '@/lib/email-service'
import { isUserPremium } from '@/lib/user-service'
import { getMacroAssumptions } from '@/lib/finance/macro'
import { toFiniteNumber } from '@/lib/finance/utils'
import { simulateAllocation } from '@/lib/allocation/service'
import { generateAporteMensalEmailTemplate } from '@/lib/email-templates/aporte-mensal'

export const maxDuration = 300

/** Valor simulado quando a carteira não tem aporte mensal configurado. */
const DEFAULT_AMOUNT = 1000
const DEFAULT_BATCH = 25
const MAX_BATCH = 100

/**
 * Cron mensal "Seu aporte do mês" (ainda fora do vercel.json: o dono ativa).
 * Para assinantes Premium com carteira ativa e a preferência `reportPreferences.APORTE_MENSAL = true`, simula o aporte
 * mensal da carteira principal no "Onde aportar" e envia os 3 ativos de maior prioridade com os motivos.
 *
 * Autorização: `Authorization: Bearer <CRON_SECRET>`.
 * Parâmetros: `limit` (lote, padrão 25), `cursor` (id do último usuário do lote anterior),
 * `dryRun=1` (não envia nada: devolve o HTML renderizado) e, só com `dryRun`, `email=` para pré-visualizar um usuário
 * mesmo sem a preferência ativada.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const dryRun = params.get('dryRun') === '1'
  const previewEmail = dryRun ? params.get('email') : null
  const limit = Math.min(MAX_BATCH, Math.max(1, Number(params.get('limit')) || DEFAULT_BATCH))
  const cursor = params.get('cursor')

  const users = await prisma.user.findMany({
    where: {
      ...(previewEmail ? { email: previewEmail } : { reportPreferences: { path: ['APORTE_MENSAL'], equals: true } }),
      portfolioConfigs: { some: { isActive: true } },
    },
    select: {
      id: true,
      email: true,
      name: true,
      portfolioConfigs: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: {
          id: true,
          name: true,
          monthlyContribution: true,
          assets: { where: { isActive: true }, select: { targetAllocation: true } },
          metrics: { select: { currentValue: true, totalReturn: true, annualizedReturn: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const macro = await getMacroAssumptions()
  const baseUrl = getEmailBaseUrl()
  const logoUrl = getEmailLogoUrl()
  const report: { email: string; status: 'sent' | 'preview' | 'skipped' | 'error'; detail?: string; subject?: string; html?: string }[] = []

  for (const user of users) {
    const portfolio = user.portfolioConfigs[0]
    try {
      if (!portfolio) {
        report.push({ email: user.email, status: 'skipped', detail: 'sem carteira ativa' })
        continue
      }
      if (!(await isUserPremium(user.id))) {
        report.push({ email: user.email, status: 'skipped', detail: 'não é Premium' })
        continue
      }
      const amount = toFiniteNumber(portfolio.monthlyContribution) || DEFAULT_AMOUNT
      const followsTargets = portfolio.assets.some((a) => Number(a.targetAllocation) > 0)
      const simulation = await simulateAllocation(
        { amount, universe: { kind: 'portfolio', portfolioId: portfolio.id }, preset: followsTargets ? 'pesos' : 'equilibrio' },
        { userId: user.id, isPremium: true }
      )
      const items = simulation.result.allocations.slice(0, 3)
      if (items.length === 0) {
        report.push({ email: user.email, status: 'skipped', detail: 'nenhum ativo passou nos critérios' })
        continue
      }
      const template = generateAporteMensalEmailTemplate({
        userName: user.name,
        portfolioName: portfolio.name,
        amount,
        followsTargets,
        summary: {
          currentValue: toFiniteNumber(portfolio.metrics?.currentValue),
          totalReturn: toFiniteNumber(portfolio.metrics?.totalReturn),
          annualizedReturn: toFiniteNumber(portfolio.metrics?.annualizedReturn),
          cdi: macro.cdi,
        },
        items: items.map((row) => ({ ticker: row.ticker, qty: row.qty, price: row.price, value: row.value, reasons: row.reasons })),
        leftover: simulation.result.leftover,
        url: `${baseUrl}/onde-aportar?carteira=${portfolio.id}&valor=${amount}&calcular=1`,
        baseUrl,
        logoUrl,
      })
      if (dryRun) {
        report.push({ email: user.email, status: 'preview', subject: template.subject, html: template.html })
        continue
      }
      await sendEmail({ to: user.email, subject: template.subject, html: template.html, text: template.text })
      report.push({ email: user.email, status: 'sent' })
    } catch (error) {
      report.push({ email: user.email, status: 'error', detail: error instanceof Error ? error.message : String(error) })
    }
  }

  return NextResponse.json({
    dryRun,
    processed: users.length,
    nextCursor: users.length === limit ? users[users.length - 1].id : null,
    results: report,
  })
}
