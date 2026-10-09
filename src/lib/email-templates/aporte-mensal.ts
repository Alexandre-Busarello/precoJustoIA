/**
 * E-mail "Seu aporte do mês": resumo da carteira e os 3 ativos de maior prioridade na distribuição simulada do
 * "Onde aportar", com os motivos. Puro (sem envio): o cron monta os dados e decide se envia ou só renderiza.
 */

import { formatBRL, formatDeltaPct, formatNumber, formatPct } from '@/lib/format'
import { ALLOCATION_DISCLAIMER } from '@/lib/allocation/constants'

export interface AporteMensalItem {
  ticker: string
  qty: number
  price: number
  value: number
  reasons: string[]
}

export interface AporteMensalEmailParams {
  userName?: string | null
  portfolioName: string
  amount: number
  /** A simulação seguiu os pesos-alvo da carteira. */
  followsTargets: boolean
  /** Patrimônio, retorno total e anualizado (frações) e CDI atual (fração a.a.), quando disponíveis. */
  summary: { currentValue: number | null; totalReturn: number | null; annualizedReturn: number | null; cdi: number | null }
  items: AporteMensalItem[]
  leftover: number
  /** Link para abrir a simulação completa. */
  url: string
  baseUrl: string
  logoUrl: string
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function summaryLines(summary: AporteMensalEmailParams['summary']): string[] {
  const lines: string[] = []
  if (summary.currentValue !== null) lines.push(`Patrimônio: ${formatBRL(summary.currentValue)}`)
  if (summary.totalReturn !== null) lines.push(`Retorno total: ${formatDeltaPct(summary.totalReturn)}`)
  if (summary.annualizedReturn !== null) {
    lines.push(
      `Retorno anualizado: ${formatDeltaPct(summary.annualizedReturn)}${summary.cdi !== null ? ` (CDI atual: ${formatPct(summary.cdi)} a.a.)` : ''}`
    )
  }
  return lines
}

export function generateAporteMensalEmailTemplate(params: AporteMensalEmailParams): { subject: string; html: string; text: string } {
  const { userName, portfolioName, amount, followsTargets, summary, items, leftover, url, baseUrl, logoUrl } = params
  const greeting = userName ? `Olá, ${userName.split(' ')[0]}` : 'Olá'
  const subject = `Seu aporte do mês: distribuição simulada de ${formatBRL(amount)}`
  const lines = summaryLines(summary)
  const manageUrl = `${baseUrl}/perfil`

  const rows = items
    .map(
      (item) => `
          <tr>
            <td style="padding: 12px 0; border-top: 1px solid #e5e7eb; vertical-align: top;">
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #111827;">${escapeHtml(item.ticker)}
                <span style="font-weight: 400; color: #6b7280;"> · ${formatNumber(item.qty)} × ${formatBRL(item.price)} = ${formatBRL(item.value)}</span>
              </p>
              <ul style="margin: 6px 0 0; padding-left: 18px; font-size: 13px; line-height: 20px; color: #4b5563;">
                ${item.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
              </ul>
            </td>
          </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 32px 16px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 24px 28px; border-bottom: 1px solid #e5e7eb;">
              <img src="${logoUrl}" alt="Preço Justo AI" style="height: 28px; width: auto; display: block;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 8px; font-size: 15px; color: #111827;">${escapeHtml(greeting)},</p>
              <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #111827;">Seu aporte do mês</h1>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 22px; color: #4b5563;">
                Distribuição simulada de ${formatBRL(amount)} na carteira ${escapeHtml(portfolioName)}, seguindo ${followsTargets ? 'os seus pesos-alvo e ' : ''}os modelos de valuation da plataforma.
              </p>
              ${
                lines.length > 0
                  ? `<p style="margin: 0 0 16px; font-size: 13px; line-height: 20px; color: #4b5563;">${lines.map(escapeHtml).join('<br>')}</p>`
                  : ''
              }
              <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #111827;">Maior prioridade na simulação</p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">${rows}
              </table>
              <p style="margin: 12px 0 24px; font-size: 13px; color: #6b7280;">Sobra da simulação: ${formatBRL(leftover)}</p>
              <a href="${url}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 20px; border-radius: 8px;">Ver a distribuição completa</a>
              <p style="margin: 24px 0 0; font-size: 12px; line-height: 18px; color: #6b7280;">${escapeHtml(ALLOCATION_DISCLAIMER)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 28px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
              Você recebe este e-mail porque ativou o resumo mensal de aporte. <a href="${manageUrl}" style="color: #1d4ed8;">Gerenciar e-mails</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `${greeting},`,
    '',
    `Seu aporte do mês: distribuição simulada de ${formatBRL(amount)} na carteira ${portfolioName}.`,
    ...lines,
    '',
    'Maior prioridade na simulação:',
    ...items.flatMap((item) => [
      `- ${item.ticker}: ${formatNumber(item.qty)} × ${formatBRL(item.price)} = ${formatBRL(item.value)}`,
      ...item.reasons.map((r) => `  · ${r}`),
    ]),
    `Sobra da simulação: ${formatBRL(leftover)}`,
    '',
    `Ver a distribuição completa: ${url}`,
    '',
    ALLOCATION_DISCLAIMER,
    `Gerenciar e-mails: ${manageUrl}`,
  ].join('\n')

  return { subject, html, text }
}
