import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { marked } from 'marked'

export type EmailProvider = 'RESEND' | 'GMAIL'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  provider?: EmailProvider // Provider de email a ser usado (padrão: RESEND)
}

// Configuração do transporter nodemailer (DESABILITADO - não usado mais como fallback)
// Mantido apenas para referência futura, mas não é mais chamado
// O fallback SMTP foi desabilitado - apenas Resend é usado
const createNodemailerTransporter = () => {
  // Para desenvolvimento, usar Ethereal Email (teste)
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_HOST) {
    console.warn('⚠️ [EMAIL] Usando configuração de email de desenvolvimento (Ethereal).')
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      }
    })
  }

  // Para produção, usar configurações do ambiente
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para outros
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

/**
 * Envia um e-mail usando Resend ou Gmail conforme o provider especificado
 * 
 * Fluxo:
 * 1. Se provider for GMAIL, usa nodemailer com configurações SMTP do Gmail
 * 2. Se provider for RESEND (ou não especificado), usa Resend API
 * 3. Se falhar, lança erro e email permanece como PENDING na fila
 * 
 * Configuração Resend:
 * - RESEND_API_KEY: Chave da API do Resend
 * - RESEND_FROM_EMAIL: Email remetente para Resend
 * 
 * Configuração Gmail:
 * - EMAIL_HOST: smtp.gmail.com
 * - EMAIL_PORT: 587
 * - EMAIL_SECURE: false
 * - EMAIL_USER: Seu email do Gmail
 * - EMAIL_PASS: App Password do Gmail
 * - EMAIL_FROM: Email remetente
 */
export async function sendEmail({ to, subject, html, text, provider = 'RESEND' }: SendEmailOptions) {
  const fromEmail = provider === 'GMAIL' 
    ? (process.env.EMAIL_FROM || process.env.EMAIL_USER || '')
    : (process.env.RESEND_FROM_EMAIL || 'Preço Justo AI <suporte@precojusto.ai>')
  const fromName = 'Preço Justo AI'
  const textContent = text || html.replace(/<[^>]*>/g, '') // Remove HTML tags para versão texto

  // ============================================
  // GMAIL (SMTP via nodemailer)
  // ============================================
  if (provider === 'GMAIL') {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      const errorMsg = 'Configuração Gmail incompleta. Configure EMAIL_HOST, EMAIL_USER e EMAIL_PASS.'
      console.error('❌ [EMAIL]', errorMsg)
      throw new Error(errorMsg)
    }

    try {
      const transporter = createNodemailerTransporter()
      
      const info = await transporter.sendMail({
        from: fromEmail.includes('<') ? fromEmail : `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: textContent,
      })

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ [EMAIL] E-mail enviado com sucesso via Gmail:', info.messageId)
      }
      
      return { success: true, messageId: info.messageId, method: 'gmail' }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido ao enviar via Gmail'
      console.error('❌ [EMAIL] Erro ao enviar via Gmail:', errorMsg)
      throw error
    }
  }

  // ============================================
  // RESEND (Método Padrão)
  // ============================================
  if (!process.env.RESEND_API_KEY) {
    const errorMsg = 'RESEND_API_KEY não configurada. Configure RESEND_API_KEY para enviar emails.'
    console.error('❌ [EMAIL]', errorMsg)
    throw new Error(errorMsg)
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    // Formatar o remetente: "Nome <email@dominio.com>"
    const from = fromEmail.includes('<') ? fromEmail : `"${fromName}" <${fromEmail}>`

    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: textContent,
    })

    if (error) {
      throw new Error(`Resend error: ${error.message}`)
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [EMAIL] E-mail enviado com sucesso via Resend:', data?.id)
    }
    
    return { success: true, messageId: data?.id, method: 'resend' }
  } catch (error: any) {
    // Se o Resend não estiver instalado, lança erro
    if (error.code === 'MODULE_NOT_FOUND') {
      const errorMsg = 'Resend não está instalado. Instale o pacote resend.'
      console.error('❌ [EMAIL]', errorMsg)
      throw new Error(errorMsg)
    } else {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido ao enviar via Resend'
      console.error('❌ [EMAIL] Erro ao enviar via Resend:', errorMsg)
      throw error
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Obtém a URL da logo para usar nos templates de email
 * 
 * Prioridade:
 * 1. EMAIL_LOGO_URL (URL completa configurada manualmente)
 * 2. EMAIL_LOGO_PATH (caminho relativo, será combinado com baseUrl)
 * 3. Padrão: /logo-preco-justo.png
 * 
 * Exemplos de configuração:
 * - EMAIL_LOGO_URL=https://cdn.exemplo.com/logo.png (URL completa)
 * - EMAIL_LOGO_PATH=/images/logo.png (caminho relativo)
 */
export function getEmailLogoUrl(): string {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://precojusto.ai'
  
  // Se tiver URL completa configurada, usar ela
  if (process.env.EMAIL_LOGO_URL) {
    return process.env.EMAIL_LOGO_URL
  }
  
  // Se tiver caminho relativo configurado, combinar com baseUrl
  if (process.env.EMAIL_LOGO_PATH) {
    return `${baseUrl}${process.env.EMAIL_LOGO_PATH}`
  }
  
  // Padrão: logo-preco-justo.png
  return `${baseUrl}/logo-preco-justo.png`
}

/**
 * Obtém a URL base para links nos emails
 */
export function getEmailBaseUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://precojusto.ai'
}

// ============================================
// TEMPLATES DE EMAIL
// ============================================

export function generatePasswordResetEmailTemplate(resetUrl: string, userName?: string) {
  const baseUrl = getEmailBaseUrl()
  const logoUrl = getEmailLogoUrl()
  
  return {
    subject: 'Redefinir sua senha - Preço Justo AI',
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redefinir Senha - Preço Justo AI</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
            min-height: 100vh;
          }
          
          .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
          }
          
          .header {
            background-color: #1e293b;
            padding: 40px 30px;
            text-align: center;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 20px;
            text-align: center;
            background-color: #ffffff;
            padding: 16px;
            border-radius: 12px;
            display: inline-block;
          }
          
          .logo {
            max-width: 200px;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          
          .header-title {
            color: #ffffff;
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .header-subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 18px;
            font-weight: 400;
            position: relative;
            z-index: 2;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .greeting {
            font-size: 18px;
            color: #475569;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .main-text {
            font-size: 16px;
            color: #64748b;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .button-container {
            text-align: center;
            margin: 40px 0;
          }
          
          .button {
            display: inline-block;
            background-color: #1e293b;
            color: #ffffff;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.05);
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
          }
          
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.4), 0 10px 10px -5px rgba(59, 130, 246, 0.1);
          }
          
          .link-section {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 30px 0;
          }
          
          .link-title {
            font-size: 14px;
            color: #475569;
            margin-bottom: 10px;
            font-weight: 500;
          }
          
          .link-url {
            word-break: break-all;
            background: #ffffff;
            padding: 12px 16px;
            border-radius: 8px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 13px;
            color: #3b82f6;
            border: 1px solid #e2e8f0;
            text-decoration: none;
          }
          
          .warning {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
          }
          
          .warning-icon {
            font-size: 24px;
            margin-bottom: 8px;
            display: block;
          }
          
          .warning-title {
            font-weight: 700;
            color: #92400e;
            margin-bottom: 12px;
            font-size: 16px;
          }
          
          .warning-list {
            color: #92400e;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .warning-list li {
            margin-bottom: 4px;
            list-style: none;
            position: relative;
            padding-left: 20px;
          }
          
          .warning-list li::before {
            content: '•';
            position: absolute;
            left: 0;
            color: #f59e0b;
            font-weight: bold;
          }
          
          .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 15px;
          }
          
          .footer-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
          }
          
          .footer-link:hover {
            text-decoration: underline;
          }
          
          .footer-brand {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-brand-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
          }
          
          .footer-tagline {
            color: #94a3b8;
            font-size: 13px;
            margin-top: 5px;
          }
          
          /* Responsividade */
          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .footer {
              padding: 25px 20px;
            }
            
            .header-title {
              font-size: 28px;
            }
            
            .header-subtitle {
              font-size: 16px;
            }
            
            .button {
              padding: 14px 24px;
              font-size: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" />
              </div>
              <h1 class="header-title">Redefinir sua senha</h1>
              <p class="header-subtitle">Segurança em primeiro lugar</p>
            </div>
            
            <div class="content">
              <p class="greeting">
                ${userName ? `Olá, <strong>${userName}</strong>!` : 'Olá!'} 👋
              </p>
              
              <p class="main-text">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Preço Justo AI</strong>. 
                Para sua segurança, você pode criar uma nova senha clicando no botão abaixo.
              </p>
              
              <div class="button-container">
                <a href="${resetUrl}" class="button" style="background-color: #1e293b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center; display: inline-block;">🔐 Redefinir Minha Senha</a>
              </div>
              
              <div class="link-section">
                <p class="link-title">Ou copie e cole este link no seu navegador:</p>
                <div class="link-url">${resetUrl}</div>
              </div>
              
              <div class="warning">
                <span class="warning-icon">⚠️</span>
                <div class="warning-title">Informações importantes:</div>
                <ul class="warning-list">
                  <li>Este link expira em <strong>1 hora</strong> por segurança</li>
                  <li>Se você não solicitou esta redefinição, <strong>ignore este email</strong></li>
                  <li>Sua senha atual permanecerá inalterada até que você complete o processo</li>
                  <li>Após redefinir, você precisará fazer login novamente em todos os dispositivos</li>
                </ul>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Se você não conseguir clicar no botão, copie e cole o link completo no seu navegador.
              </p>
              <p class="footer-text">
                Precisa de ajuda? Entre em contato conosco em 
                <a href="mailto:suporte@precojusto.ai" class="footer-link">suporte@precojusto.ai</a>
              </p>
              
              <div class="footer-brand">
                <a href="${baseUrl}" class="footer-brand-link">Preço Justo AI</a>
                <p class="footer-tagline">Análise fundamentalista inteligente para seus investimentos</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Redefinir sua senha - Preço Justo AI

${userName ? `Olá, ${userName}!` : 'Olá!'} Recebemos uma solicitação para redefinir sua senha.

Para redefinir sua senha, acesse o link abaixo:
${resetUrl}

IMPORTANTE:
- Este link expira em 1 hora por segurança
- Se você não solicitou esta redefinição, ignore este email
- Sua senha atual permanecerá inalterada até que você complete o processo

Precisa de ajuda? Entre em contato conosco em suporte@precojusto.ai

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, userName?: string) {
  const template = generatePasswordResetEmailTemplate(resetUrl, userName)
  
  return await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  })
}

export function generatePaymentFailureEmailTemplate(retryUrl: string, userName?: string, failureReason?: string) {
  const baseUrl = getEmailBaseUrl()
  const logoUrl = getEmailLogoUrl()
  
  return {
    subject: 'Problema com seu pagamento - Preço Justo AI',
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Problema com Pagamento - Preço Justo AI</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
            min-height: 100vh;
          }
          
          .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
          }
          
          .header {
            background-color: #1e293b;
            padding: 40px 30px;
            text-align: center;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 20px;
            text-align: center;
            background-color: #ffffff;
            padding: 16px;
            border-radius: 12px;
            display: inline-block;
          }
          
          .logo {
            max-width: 200px;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          
          .header-title {
            color: #ffffff;
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .header-subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 18px;
            font-weight: 400;
            position: relative;
            z-index: 2;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .greeting {
            font-size: 18px;
            color: #475569;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .main-text {
            font-size: 16px;
            color: #64748b;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .button-container {
            text-align: center;
            margin: 40px 0;
          }
          
          .button {
            display: inline-block;
            background-color: #1e293b;
            color: #ffffff;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.05);
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
          }
          
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.4), 0 10px 10px -5px rgba(59, 130, 246, 0.1);
          }
          
          .error-section {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 12px;
            padding: 20px;
            margin: 30px 0;
          }
          
          .error-icon {
            font-size: 24px;
            margin-bottom: 8px;
            display: block;
          }
          
          .error-title {
            font-weight: 700;
            color: #dc2626;
            margin-bottom: 12px;
            font-size: 16px;
          }
          
          .error-text {
            color: #dc2626;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .info-section {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 12px;
            padding: 20px;
            margin: 30px 0;
          }
          
          .info-title {
            font-weight: 700;
            color: #0369a1;
            margin-bottom: 12px;
            font-size: 16px;
          }
          
          .info-list {
            color: #0369a1;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .info-list li {
            margin-bottom: 4px;
            list-style: none;
            position: relative;
            padding-left: 20px;
          }
          
          .info-list li::before {
            content: '•';
            position: absolute;
            left: 0;
            color: #0284c7;
            font-weight: bold;
          }
          
          .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 15px;
          }
          
          .footer-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
          }
          
          .footer-link:hover {
            text-decoration: underline;
          }
          
          .footer-brand {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-brand-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
          }
          
          .footer-tagline {
            color: #94a3b8;
            font-size: 13px;
            margin-top: 5px;
          }
          
          /* Responsividade */
          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .footer {
              padding: 25px 20px;
            }
            
            .header-title {
              font-size: 28px;
            }
            
            .header-subtitle {
              font-size: 16px;
            }
            
            .button {
              padding: 14px 24px;
              font-size: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" />
              </div>
              <h1 class="header-title">⚡ Pagamento Não Processado</h1>
              <p class="header-subtitle">Sua assinatura está aguardando</p>
            </div>
            
            <div class="content">
              <p class="greeting">
                ${userName ? `Olá, <strong>${userName}</strong>!` : 'Olá!'} 😊
              </p>
              
              <p class="main-text">
                Infelizmente, não conseguimos processar o pagamento da sua assinatura no <strong>Preço Justo AI</strong>. 
                Mas não se preocupe, isso é mais comum do que você imagina e tem solução fácil!
              </p>
              
              ${failureReason ? `
              <div class="error-section">
                <span class="error-icon">⚠️</span>
                <div class="error-title">Motivo da falha:</div>
                <div class="error-text">${failureReason}</div>
              </div>
              ` : ''}
              
              <div class="info-section">
                <div class="info-title">💡 Como resolver:</div>
                <ul class="info-list">
                  <li>Verifique se há saldo suficiente no cartão</li>
                  <li>Confirme se os dados do cartão estão corretos</li>
                  <li>Verifique se o cartão não está bloqueado ou vencido</li>
                  <li>Entre em contato com seu banco se necessário</li>
                  <li>Tente usar outro cartão se disponível</li>
                </ul>
              </div>
              
              <div class="button-container">
                <a href="${retryUrl}" style="display: inline-block; background-color: #1e293b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center;">
                  Garantir Oferta Early Adopter
                </a>
              </div>
              
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 30px 0; text-align: center;">
                <div style="margin-bottom: 20px;">
                  <h3 style="color: #111827; font-weight: 600; margin-bottom: 8px; font-size: 20px;">Acesso Completo Hoje</h3>
                  <p style="color: #64748b; font-size: 15px; margin: 0;">Todos os recursos Premium + Early Adopter</p>
                </div>
                
                <div style="display: grid; gap: 12px; margin-bottom: 20px;">
                  <div style="background-color: #ffffff; border-radius: 6px; padding: 16px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 16px; text-align: left;">
                    <div style="width: 40px; height: 40px; background-color: #1e293b; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #ffffff;">🤖</div>
                    <div>
                      <h4 style="color: #111827; font-weight: 600; margin: 0 0 4px 0; font-size: 15px;">Análise Preditiva com IA</h4>
                      <p style="color: #64748b; margin: 0; font-size: 14px;">Google Gemini analisa 8 modelos + notícias</p>
                    </div>
                  </div>
                  
                  <div style="background-color: #ffffff; border-radius: 6px; padding: 16px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 16px; text-align: left;">
                    <div style="width: 40px; height: 40px; background-color: #1e293b; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #ffffff;">📊</div>
                    <div>
                      <h4 style="color: #111827; font-weight: 600; margin: 0 0 4px 0; font-size: 15px;">8 Modelos de Valuation</h4>
                      <p style="color: #64748b; margin: 0; font-size: 14px;">Graham, Fórmula Mágica, DCF e mais</p>
                    </div>
                  </div>
                  
                  <div style="background-color: #ffffff; border-radius: 6px; padding: 16px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 16px; text-align: left;">
                    <div style="width: 40px; height: 40px; background-color: #1e293b; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #ffffff;">📈</div>
                    <div>
                      <h4 style="color: #111827; font-weight: 600; margin: 0 0 4px 0; font-size: 15px;">Backtesting de Carteiras</h4>
                      <p style="color: #64748b; margin: 0; font-size: 14px;">Simule estratégias com dados históricos</p>
                    </div>
                  </div>
                </div>
                
                <div style="background-color: #fef3c7; border-radius: 6px; padding: 16px; border: 1px solid #f59e0b;">
                  <p style="color: #92400e; font-weight: 600; margin: 0; font-size: 16px;">
                    Tudo por apenas <span style="font-size: 20px; color: #dc2626;">R$ 249/ano</span>
                  </p>
                  <p style="color: #92400e; font-weight: 500; margin: 4px 0 0 0; font-size: 13px;">
                    Preço congelado para sempre!
                  </p>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Se continuar com problemas, nossa equipe está aqui para ajudar!
              </p>
              <p class="footer-text">
                Entre em contato conosco em 
                <a href="mailto:suporte@precojusto.ai" class="footer-link">suporte@precojusto.ai</a>
              </p>
              
              <div class="footer-brand">
                <a href="${baseUrl}" class="footer-brand-link">Preço Justo AI</a>
                <p class="footer-tagline">Análise fundamentalista inteligente para seus investimentos</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Problema com seu pagamento - Preço Justo AI

${userName ? `Olá, ${userName}!` : 'Olá!'} Infelizmente, não conseguimos processar o pagamento da sua assinatura Premium.

${failureReason ? `Motivo da falha: ${failureReason}` : ''}

Como resolver:
- Verifique se há saldo suficiente no cartão
- Confirme se os dados do cartão estão corretos
- Verifique se o cartão não está bloqueado ou vencido
- Entre em contato com seu banco se necessário
- Tente usar outro cartão se disponível

Para tentar novamente, acesse: ${retryUrl}

Não perca a oportunidade! Sua assinatura Premium te dará acesso a análises avançadas, estratégias exclusivas e ferramentas profissionais.

Precisa de ajuda? Entre em contato conosco em suporte@precojusto.ai

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  }
}

export async function sendPaymentFailureEmail(email: string, retryUrl: string, userName?: string, failureReason?: string) {
  const template = generatePaymentFailureEmailTemplate(retryUrl, userName, failureReason)
  
  return await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  })
}

export function generateWelcomeEmailTemplate(userName?: string, isEarlyAdopter: boolean = false) {
  const baseUrl = getEmailBaseUrl()
  const logoUrl = getEmailLogoUrl()
  
  const planName = isEarlyAdopter ? 'Early Adopter' : 'Premium'
  const planBadge = isEarlyAdopter ? '👑 Early Adopter' : '⭐ Premium'
  
  return {
    subject: `🎉 Bem-vindo ao Preço Justo AI ${planName}!`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao Preço Justo AI ${planName}!</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #0f172a;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            min-height: 100vh;
          }
          
          .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
          }
          
          .header {
            background-color: #1e293b;
            padding: 48px 32px;
            text-align: center;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 24px;
            text-align: center;
          }
          
          .logo {
            max-width: 180px;
            height: auto;
            filter: brightness(0) invert(1);
            display: block;
            margin: 0 auto;
          }
          
          .header-title {
            color: #ffffff;
            font-size: 36px;
            font-weight: 800;
            margin-bottom: 12px;
            position: relative;
            z-index: 2;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            letter-spacing: -0.5px;
          }
          
          .header-subtitle {
            color: #ffffff;
            font-size: 18px;
            font-weight: 500;
            position: relative;
            z-index: 2;
            opacity: 0.95;
          }
          
          .badge-premium {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 9999px;
            padding: 6px 16px;
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            margin-top: 8px;
          }
          
          .content {
            padding: 48px 32px;
            background-color: #ffffff;
          }
          
          .greeting {
            font-size: 22px;
            color: #0f172a;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 700;
          }
          
          .main-text {
            font-size: 16px;
            color: #475569;
            margin-bottom: 32px;
            text-align: center;
            line-height: 1.7;
          }
          
          .button-container {
            text-align: center;
            margin: 36px 0;
          }
          
          .button {
            display: inline-block;
            background-color: #1e293b;
            color: #ffffff !important;
            padding: 18px 40px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 17px;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(37, 99, 235, 0.05);
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
            letter-spacing: 0.3px;
          }
          
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.4), 0 10px 10px -5px rgba(37, 99, 235, 0.1);
          }
          
          .features-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin: 32px 0;
          }
          
          .feature-card {
            background: #ffffff;
            border: 0;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            transition: all 0.3s ease;
          }
          
          .feature-card:hover {
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            transform: translateY(-2px);
          }
          
          .feature-icon-wrapper {
            width: 64px;
            height: 64px;
            margin: 0 auto 16px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          
          .feature-icon-wrapper.blue {
            background-color: #1e293b;
          }
          
          .feature-icon-wrapper.green {
            background-color: #1e293b;
          }
          
          .feature-icon-wrapper.purple {
            background-color: #1e293b;
          }
          
          .feature-icon-wrapper.teal {
            background-color: #1e293b;
          }
          
          .feature-icon-wrapper.orange {
            background-color: #1e293b;
          }
          
          .feature-icon-wrapper.pink {
            background-color: #1e293b;
          }
          
          .feature-icon {
            font-size: 32px;
            display: block;
            line-height: 1;
          }
          
          .feature-title {
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 10px;
            font-size: 17px;
            line-height: 1.3;
          }
          
          .feature-desc {
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 8px;
          }
          
          .feature-link {
            color: #2563eb;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            display: inline-block;
            margin-top: 8px;
          }
          
          .feature-link:hover {
            text-decoration: underline;
          }
          
          .cta-section {
            background-color: #f9fafb;
            border: 0;
            border-radius: 12px;
            padding: 32px 24px;
            margin: 32px 0;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.1), 0 4px 6px -2px rgba(37, 99, 235, 0.05);
          }
          
          .cta-title {
            color: #1e40af;
            font-weight: 700;
            margin-bottom: 20px;
            font-size: 20px;
          }
          
          .footer {
            background: #f8fafc;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 15px;
            margin-bottom: 12px;
            line-height: 1.6;
          }
          
          .footer-link {
            color: #2563eb;
            text-decoration: none;
            font-weight: 600;
          }
          
          .footer-link:hover {
            text-decoration: underline;
          }
          
          .footer-brand {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-brand-link {
            color: #2563eb;
            text-decoration: none;
            font-weight: 700;
            font-size: 18px;
          }
          
          .footer-tagline {
            color: #94a3b8;
            font-size: 14px;
            margin-top: 6px;
          }
          
          .tips-box {
            background: #ffffff;
            border: 0;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          }
          
          .tips-title {
            color: #0f172a;
            font-weight: 700;
            margin-bottom: 16px;
            font-size: 18px;
          }
          
          .tips-list {
            color: #475569;
            font-size: 15px;
            line-height: 1.8;
            margin: 0;
            padding-left: 24px;
          }
          
          .tips-list li {
            margin-bottom: 10px;
          }
          
          .tips-list strong {
            color: #0f172a;
            font-weight: 600;
          }
          
          .early-adopter-box {
            background-color: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.2);
          }
          
          .early-adopter-title {
            color: #78350f;
            font-weight: 700;
            margin-bottom: 12px;
            font-size: 20px;
          }
          
          .early-adopter-text {
            color: #92400e;
            font-size: 15px;
            line-height: 1.6;
            margin: 0;
          }
          
          .whatsapp-box {
            background-color: #f9fafb;
            border: 2px solid #8b5cf6;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(139, 92, 246, 0.2);
          }
          
          .whatsapp-title {
            color: #6d28d9;
            font-weight: 700;
            margin-bottom: 12px;
            font-size: 18px;
          }
          
          .whatsapp-text {
            color: #6d28d9;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 16px;
          }
          
          .whatsapp-text-small {
            color: #7c3aed;
            font-size: 13px;
            margin: 0;
            font-style: italic;
          }
          
          /* Responsividade */
          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .footer {
              padding: 25px 20px;
            }
            
            .header-title {
              font-size: 28px;
            }
            
            .header-subtitle {
              font-size: 16px;
            }
            
            .button {
              padding: 14px 24px;
              font-size: 15px;
            }
            
            .features-grid {
              grid-template-columns: 1fr;
              gap: 16px;
            }
            
            .header-title {
              font-size: 30px;
            }
            
            .header-subtitle {
              font-size: 16px;
            }
            
            .greeting {
              font-size: 18px;
            }
            
            .main-text {
              font-size: 15px;
            }
            
            .cta-title {
              font-size: 18px;
            }
            
            .tips-title {
              font-size: 17px;
            }
            
            .feature-icon-wrapper {
              width: 56px;
              height: 56px;
            }
            
            .feature-icon {
              font-size: 28px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" />
              </div>
              <h1 class="header-title">🎉 Bem-vindo!</h1>
              <p class="header-subtitle">${planBadge} ativado com sucesso</p>
            </div>
            
            <div class="content">
              <p class="greeting">
                ${userName ? `Olá, <strong>${userName}</strong>!` : 'Olá!'} 🚀
              </p>
              
              <p class="main-text">
                Parabéns! Sua assinatura <strong>${planName}</strong> foi ativada com sucesso. 
                Agora você tem acesso completo a todas as ferramentas profissionais de análise fundamentalista.
              </p>
              
              ${isEarlyAdopter ? `
              <div class="early-adopter-box">
                <h3 class="early-adopter-title">👑 Parabéns, Early Adopter!</h3>
                <p class="early-adopter-text">
                  Você garantiu acesso por 3 anos, o <strong style="color: #78350f;">preço congelado para sempre</strong> e agora faz parte do grupo exclusivo que está moldando o futuro da plataforma!
                </p>
              </div>
              ` : ''}
              
              <div class="cta-section">
                <h3 class="cta-title">🎯 Comece agora mesmo:</h3>
                <div class="button-container">
                  <a href="${baseUrl}/dashboard" class="button" style="background-color: #1e293b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center; display: inline-block;">🚀 Acessar Dashboard</a>
                </div>
              </div>
              
              <div class="features-grid">
                <div class="feature-card">
                  <div class="feature-icon-wrapper purple">
                    <span class="feature-icon">🤖</span>
                  </div>
                  <div class="feature-title">Análise com IA</div>
                  <div class="feature-desc">
                    Use nossa IA para análises preditivas avançadas
                  </div>
                  <a href="${baseUrl}/ranking" class="feature-link">→ Criar Ranking</a>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon-wrapper blue">
                    <span class="feature-icon">📊</span>
                  </div>
                  <div class="feature-title">8 Modelos Premium</div>
                  <div class="feature-desc">
                    Graham, Fórmula Mágica, DCF e muito mais
                  </div>
                  <a href="${baseUrl}/ranking" class="feature-link">→ Explorar Modelos</a>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon-wrapper teal">
                    <span class="feature-icon">🔍</span>
                  </div>
                  <div class="feature-title">Comparador Avançado</div>
                  <div class="feature-desc">
                    Compare até 10 ações lado a lado
                  </div>
                  <a href="${baseUrl}/compara-acoes" class="feature-link">→ Comparar Ações</a>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon-wrapper green">
                    <span class="feature-icon">📈</span>
                  </div>
                  <div class="feature-title">Backtesting</div>
                  <div class="feature-desc">
                    Teste suas estratégias com dados históricos
                  </div>
                  <a href="${baseUrl}/backtest" class="feature-link">→ Fazer Backtest</a>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon-wrapper orange">
                    <span class="feature-icon">📋</span>
                  </div>
                  <div class="feature-title">Análise Individual</div>
                  <div class="feature-desc">
                    Análise completa de qualquer ação
                  </div>
                  <a href="${baseUrl}/" class="feature-link">→ Analisar Ação</a>
                </div>
                
                <div class="feature-card">
                  <div class="feature-icon-wrapper pink">
                    <span class="feature-icon">🎯</span>
                  </div>
                  <div class="feature-title">Suporte VIP</div>
                  <div class="feature-desc">
                    Atendimento prioritário e especializado
                  </div>
                  <a href="${baseUrl}/suporte" class="feature-link">→ Central de Suporte</a>
                </div>
              </div>
              
              <div class="tips-box">
                <h3 class="tips-title">💡 Dicas para começar:</h3>
                <ul class="tips-list">
                  <li>Comece criando um <strong>ranking com IA</strong> para descobrir as melhores oportunidades</li>
                  <li>Use o <strong>comparador</strong> para analisar suas ações favoritas lado a lado</li>
                  <li>Teste suas estratégias com o <strong>backtesting</strong> antes de investir</li>
                  <li>Explore os <strong>8 modelos de valuation</strong> para diferentes perfis de investimento</li>
                </ul>
              </div>
              
              ${isEarlyAdopter ? `
              <div class="whatsapp-box">
                <h3 class="whatsapp-title">💬 Canal Exclusivo WhatsApp</h3>
                <p class="whatsapp-text">
                  Como Early Adopter, você tem acesso direto ao CEO! Em breve você receberá o convite para o grupo exclusivo.
                </p>
                <p class="whatsapp-text-small">
                  Sua opinião ajuda a moldar o futuro da plataforma 🚀
                </p>
              </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Precisa de ajuda? Nossa equipe está sempre disponível!
              </p>
              <p class="footer-text">
                Entre em contato conosco em 
                <a href="mailto:suporte@precojusto.ai" class="footer-link">suporte@precojusto.ai</a>
              </p>
              
              <div class="footer-brand">
                <a href="${baseUrl}" class="footer-brand-link">Preço Justo AI</a>
                <p class="footer-tagline">Análise fundamentalista inteligente para seus investimentos</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
🎉 Bem-vindo ao Preço Justo AI ${planName}!

${userName ? `Olá, ${userName}!` : 'Olá!'} Parabéns! Sua assinatura ${planName} foi ativada com sucesso.


🎯 Comece agora mesmo:
• Dashboard: ${baseUrl}/dashboard
• Criar Ranking com IA: ${baseUrl}/ranking
• Comparar Ações: ${baseUrl}/compara-acoes
• Backtesting: ${baseUrl}/backtest
• Análise Individual: ${baseUrl}/
• Suporte VIP: ${baseUrl}/suporte

💡 Dicas para começar:
- Comece criando um ranking com IA para descobrir as melhores oportunidades
- Use o comparador para analisar suas ações favoritas lado a lado
- Teste suas estratégias com o backtesting antes de investir
- Explore os 8 modelos de valuation para diferentes perfis

${isEarlyAdopter ? '💬 Como Early Adopter, você receberá em breve o convite para o canal exclusivo WhatsApp com o CEO!' : ''}

Precisa de ajuda? Entre em contato conosco em suporte@precojusto.ai

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  }
}

export async function sendWelcomeEmail(email: string, userName?: string, isEarlyAdopter: boolean = false) {
  const template = generateWelcomeEmailTemplate(userName, isEarlyAdopter)
  
  return await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  })
}

export function generatePremiumExpirationEmailTemplate(userName?: string) {
  const baseUrl = getEmailBaseUrl()
  const logoUrl = getEmailLogoUrl()
  const plansUrl = 'https://precojusto.ai/planos'
  
  return {
    subject: 'Sua assinatura Premium expirou',
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sua assinatura Premium expirou</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #0f172a;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            min-height: 100vh;
          }
          
          .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
          }
          
          .header {
            background-color: #1e293b;
            padding: 48px 32px;
            text-align: center;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 24px;
            text-align: center;
          }
          
          .logo {
            max-width: 180px;
            height: auto;
            filter: brightness(0) invert(1);
            display: block;
            margin: 0 auto;
          }
          
          .header-title {
            color: #ffffff;
            font-size: 36px;
            font-weight: 800;
            margin-bottom: 12px;
            position: relative;
            z-index: 2;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            letter-spacing: -0.5px;
          }
          
          .header-subtitle {
            color: #ffffff;
            font-size: 18px;
            font-weight: 500;
            position: relative;
            z-index: 2;
            opacity: 0.95;
          }
          
          .content {
            padding: 48px 32px;
            background-color: #ffffff;
          }
          
          .greeting {
            font-size: 22px;
            color: #0f172a;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 700;
          }
          
          .main-text {
            font-size: 16px;
            color: #475569;
            margin-bottom: 32px;
            text-align: center;
            line-height: 1.7;
          }
          
          .expiration-notice {
            background-color: #fef2f2;
            border: 2px solid #fca5a5;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
          }
          
          .expiration-title {
            color: #991b1b;
            font-weight: 700;
            margin-bottom: 12px;
            font-size: 20px;
          }
          
          .expiration-text {
            color: #7f1d1d;
            font-size: 15px;
            line-height: 1.6;
            margin: 0;
          }
          
          .benefits-section {
            margin: 32px 0;
          }
          
          .benefits-title {
            color: #0f172a;
            font-weight: 700;
            margin-bottom: 20px;
            font-size: 20px;
            text-align: center;
          }
          
          .benefits-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          
          .benefit-item {
            display: flex;
            align-items: flex-start;
            padding: 16px;
            margin-bottom: 12px;
            background-color: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #1e293b;
          }
          
          .benefit-icon {
            font-size: 24px;
            margin-right: 16px;
            flex-shrink: 0;
          }
          
          .benefit-content {
            flex: 1;
          }
          
          .benefit-title {
            color: #0f172a;
            font-weight: 600;
            margin-bottom: 4px;
            font-size: 16px;
          }
          
          .benefit-desc {
            color: #64748b;
            font-size: 14px;
            line-height: 1.5;
          }
          
          .button-container {
            text-align: center;
            margin: 36px 0;
          }
          
          .button {
            display: inline-block;
            background-color: #1e293b;
            color: #ffffff !important;
            padding: 18px 40px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 17px;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(37, 99, 235, 0.05);
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
            letter-spacing: 0.3px;
          }
          
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.4), 0 10px 10px -5px rgba(37, 99, 235, 0.1);
          }
          
          .footer {
            background: #f8fafc;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 15px;
            margin-bottom: 12px;
            line-height: 1.6;
          }
          
          .footer-link {
            color: #2563eb;
            text-decoration: none;
            font-weight: 600;
          }
          
          .footer-link:hover {
            text-decoration: underline;
          }
          
          .footer-brand {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-brand-link {
            color: #2563eb;
            text-decoration: none;
            font-weight: 700;
            font-size: 18px;
          }
          
          .footer-tagline {
            color: #94a3b8;
            font-size: 14px;
            margin-top: 6px;
          }
          
          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .footer {
              padding: 25px 20px;
            }
            
            .header-title {
              font-size: 28px;
            }
            
            .header-subtitle {
              font-size: 16px;
            }
            
            .button {
              padding: 14px 24px;
              font-size: 15px;
            }
            
            .greeting {
              font-size: 18px;
            }
            
            .main-text {
              font-size: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" />
              </div>
              <h1 class="header-title">Sua assinatura expirou</h1>
              <p class="header-subtitle">Mas você pode renovar a qualquer momento</p>
            </div>
            
            <div class="content">
              <p class="greeting">
                ${userName ? `Olá, <strong>${userName}</strong>!` : 'Olá!'}
              </p>
              
              <p class="main-text">
                Informamos que sua assinatura <strong>Premium</strong> expirou. 
                Você ainda pode usar a plataforma com recursos gratuitos, mas alguns recursos exclusivos não estarão mais disponíveis.
              </p>
              
              <div class="expiration-notice">
                <h3 class="expiration-title">⚠️ Assinatura Expirada</h3>
                <p class="expiration-text">
                  Sua assinatura Premium expirou e você foi movido para o plano gratuito. 
                  Para continuar aproveitando todos os recursos Premium, considere renovar sua assinatura.
                </p>
              </div>
              
              <div class="benefits-section">
                <h3 class="benefits-title">O que você está perdendo:</h3>
                <ul class="benefits-list">
                  <li class="benefit-item">
                    <span class="benefit-icon">🤖</span>
                    <div class="benefit-content">
                      <div class="benefit-title">Acesso a todos os modelos de análise</div>
                      <div class="benefit-desc">8 modelos Premium incluindo Graham, Fórmula Mágica, DCF e mais</div>
                    </div>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">📊</span>
                    <div class="benefit-content">
                      <div class="benefit-title">Relatórios completos de IA</div>
                      <div class="benefit-desc">Análises detalhadas e insights inteligentes sobre seus investimentos</div>
                    </div>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">🔍</span>
                    <div class="benefit-content">
                      <div class="benefit-title">Monitoramento avançado de ativos</div>
                      <div class="benefit-desc">Alertas personalizados e acompanhamento de ativos</div>
                    </div>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">📈</span>
                    <div class="benefit-content">
                      <div class="benefit-title">Backtests e simulações</div>
                      <div class="benefit-desc">Teste suas estratégias com dados históricos reais</div>
                    </div>
                  </li>
                  <li class="benefit-item">
                    <span class="benefit-icon">🎯</span>
                    <div class="benefit-content">
                      <div class="benefit-title">Suporte VIP</div>
                      <div class="benefit-desc">Atendimento prioritário e especializado</div>
                    </div>
                  </li>
                </ul>
              </div>
              
              <div class="button-container">
                <a href="${plansUrl}" class="button">Renovar Assinatura</a>
              </div>
              
              <p class="main-text" style="margin-top: 24px; font-size: 14px; color: #64748b;">
                Não se preocupe, você pode renovar a qualquer momento e ter acesso imediato a todos os recursos Premium novamente.
              </p>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Precisa de ajuda? Nossa equipe está sempre disponível!
              </p>
              <p class="footer-text">
                Entre em contato conosco em 
                <a href="mailto:suporte@precojusto.ai" class="footer-link">suporte@precojusto.ai</a>
              </p>
              
              <div class="footer-brand">
                <a href="${baseUrl}" class="footer-brand-link">Preço Justo AI</a>
                <p class="footer-tagline">Análise fundamentalista inteligente para seus investimentos</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Sua assinatura Premium expirou

${userName ? `Olá, ${userName}!` : 'Olá!'}

Informamos que sua assinatura Premium expirou. Você ainda pode usar a plataforma com recursos gratuitos, mas alguns recursos exclusivos não estarão mais disponíveis.

⚠️ Assinatura Expirada
Sua assinatura Premium expirou e você foi movido para o plano gratuito. Para continuar aproveitando todos os recursos Premium, considere renovar sua assinatura.

O que você está perdendo:
• Acesso a todos os modelos de análise - 8 modelos Premium incluindo Graham, Fórmula Mágica, DCF e mais
• Relatórios completos de IA - Análises detalhadas e insights inteligentes sobre seus investimentos
• Monitoramento avançado de ativos - Alertas personalizados e acompanhamento de ativos
• Backtests e simulações - Teste suas estratégias com dados históricos reais
• Suporte VIP - Atendimento prioritário e especializado

Renovar Assinatura: ${plansUrl}

Não se preocupe, você pode renovar a qualquer momento e ter acesso imediato a todos os recursos Premium novamente.

Precisa de ajuda? Entre em contato conosco em suporte@precojusto.ai

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  }
}

export async function sendPremiumExpirationEmail(email: string, userName?: string) {
  const template = generatePremiumExpirationEmailTemplate(userName)
  
  return await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  })
}

// ===== FUNÇÃO AUXILIAR PARA CONVERSÃO DE IMAGENS =====

/**
 * Converte uma URL de imagem SVG para base64 data URI para uso em emails
 * Isso evita links externos suspeitos e permite usar imagens inline
 * 
 * @param url URL da imagem SVG
 * @returns Promise com data URI base64 ou null se falhar
 */
async function convertSvgToBase64DataUri(url: string): Promise<string | null> {
  try {
    // Fazer fetch do SVG
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PrecoJustoAI/1.0)',
      },
      // Timeout de 5 segundos
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`[EMAIL] Falha ao buscar SVG: ${url} - Status: ${response.status}`);
      return null;
    }

    const svgContent = await response.text();
    
    // Validar que é realmente SVG
    if (!svgContent.trim().startsWith('<svg') && !svgContent.trim().startsWith('<?xml')) {
      console.warn(`[EMAIL] Conteúdo não é SVG válido: ${url}`);
      return null;
    }

    // Converter para base64
    const base64 = Buffer.from(svgContent, 'utf-8').toString('base64');
    
    // Retornar como data URI SVG
    // Muitos clientes de email modernos (Gmail, Outlook, Apple Mail) suportam SVG em data URIs
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    console.warn(`[EMAIL] Erro ao converter SVG para base64: ${url}`, error);
    return null;
  }
}

// ===== TEMPLATES PARA MONITORAMENTO DE ATIVOS =====

export function generateAssetChangeEmailTemplate(params: {
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
  changeDirection: 'positive' | 'negative';
  previousScore: number;
  currentScore: number;
  reportSummary: string;
  reportUrl: string;
}) {
  const {
    userName,
    ticker,
    companyName,
    companyLogoUrl,
    changeDirection,
    previousScore,
    currentScore,
    reportSummary,
    reportUrl,
  } = params;

  const isPositive = changeDirection === 'positive';
  const badgeColor = isPositive ? '#10b981' : '#ef4444';
  const badgeText = isPositive ? 'Mudança Positiva' : 'Mudança Negativa';
  const scoreDelta = Math.abs(currentScore - previousScore).toFixed(1);
  const arrow = isPositive ? '↑' : '↓';
  const changeVerb = isPositive ? 'melhorou' : 'piorou';
  
  const baseUrl = getEmailBaseUrl();
  const logoUrl = getEmailLogoUrl();
  const assetUrl = `${baseUrl}/acao/${ticker.toLowerCase()}`;
  const manageSubscriptionsUrl = `${baseUrl}/dashboard/subscriptions`;
  
  // Converter URLs SVG para formato compatível com email usando wsrv.nl
  const getEmailCompatibleImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    // Se for uma URL da brapi.dev (SVG), usar wsrv.nl para converter para PNG
    if (url.includes('icons.brapi.dev') && url.endsWith('.svg')) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=128&h=128&output=png&default=https://via.placeholder.com/128x128/667eea/ffffff?text=${ticker}`;
    }
    
    // Se for URL relativa, adicionar base URL
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    
    // Se já for URL absoluta e não for SVG problemático, retornar como está
    return url;
  };
  
  const emailCompatibleLogoUrl = getEmailCompatibleImageUrl(companyLogoUrl);

  // Suavizar assunto para evitar gatilhos de phishing (palavras como "piorou" geram medo/urgência)
  // Assunto neutro ajuda a evitar marcação como spam enquanto o domínio ganha reputação
  const subject = isPositive 
    ? `Atualização de ${ticker}: Score melhorou para ${currentScore.toFixed(1)}`
    : `Atualização de ${ticker}: Novos dados disponíveis`;
  
  return {
    subject,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atualização: ${ticker}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #1e293b; padding: 40px 30px; text-align: center;">
              <table role="presentation" style="width: 100%; margin: 0 auto;">
                <tr>
                  <td style="text-align: center;">
                    <div style="background-color: #ffffff; padding: 12px; border-radius: 8px; display: inline-block;">
                      <img src="${logoUrl}" alt="Preço Justo AI" style="height: 32px; width: auto; display: block; margin: 0 auto;" />
                    </div>
                  </td>
                </tr>
              </table>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                Atualização de Monitoramento
              </h1>
            </td>
          </tr>

          <!-- Company Header with Logo -->
          <tr>
            <td style="padding: 40px 30px 30px; text-align: center; background-color: #ffffff;">
              ${emailCompatibleLogoUrl ? `
              <table role="presentation" style="margin: 0 auto 20px;">
                <tr>
                  <td style="text-align: center;">
                    <img src="${emailCompatibleLogoUrl}" 
                         alt="${companyName}" 
                         style="width: 64px; height: 64px; border-radius: 8px; object-fit: contain; display: block; margin: 0 auto;" 
                         width="64" 
                         height="64" />
                  </td>
                </tr>
              </table>
              ` : ''}
              <h2 style="color: #111827; margin: 0 0 6px 0; font-size: 24px; font-weight: 600;">
                ${companyName}
              </h2>
              <div style="color: #6b7280; font-size: 16px; font-weight: 500; margin-bottom: 16px;">
                ${ticker}
              </div>
              <div style="text-align: center;">
                <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                  ${badgeText}
                </span>
              </div>
            </td>
          </tr>

          <!-- Saudação -->
          <tr>
            <td style="padding: 30px 30px 20px;">
              <p style="color: #374151; font-size: 17px; line-height: 1.6; margin: 0;">
                Olá <strong>${userName}</strong>, 👋
              </p>
            </td>
          </tr>

          <!-- Informação Principal -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Detectamos uma mudança relevante nos fundamentos de <strong>${companyName} (${ticker})</strong>, uma empresa que você está monitorando.
              </p>

              <!-- Score Comparison Box -->
              <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
                <tr>
                  <td style="padding: 32px 20px; text-align: center;">
                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Score Geral
                    </div>
                    <div style="font-size: 32px; font-weight: 700; color: #111827; margin: 16px 0;">
                      <span style="color: #9ca3af; font-size: 28px;">${previousScore.toFixed(1)}</span>
                      <span style="margin: 0 12px; color: ${badgeColor}; font-size: 24px;">${arrow}</span>
                      <span style="color: ${badgeColor}; font-size: 36px;">${currentScore.toFixed(1)}</span>
                    </div>
                    <div style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; padding: 6px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; margin-top: 8px;">
                      ${isPositive ? '+' : ''}${scoreDelta} pontos
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Resumo do Relatório -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <div style="background-color: #f9fafb; border-left: 3px solid ${badgeColor}; padding: 20px 24px; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 600;">
                  Principais Mudanças Identificadas
                </h3>
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  ${reportSummary}
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 40px; text-align: center;">
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 6px; background-color: #1e293b;">
                    <a href="${reportUrl}" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 600; font-size: 16px;">
                      Ver Relatório Completo
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Secondary CTA -->
          <tr>
            <td style="padding: 0 30px 40px; text-align: center;">
              <a href="${assetUrl}" style="color: #1e293b; text-decoration: none; font-size: 15px; font-weight: 500;">
                Ver página completa de ${ticker}
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 30px;">
              <div style="border-top: 1px solid #e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer Info -->
          <tr>
            <td style="padding: 32px 30px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                Você está recebendo este email porque se inscreveu para receber atualizações sobre <strong>${ticker}</strong>
              </p>
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 12px;">
                    <a href="${manageSubscriptionsUrl}" style="color: #1e293b; text-decoration: none; font-size: 14px; font-weight: 500;">
                      Gerenciar inscrições
                    </a>
                  </td>
                  <td style="padding: 0 12px; color: #d1d5db;">|</td>
                  <td style="padding: 0 12px;">
                    <a href="${baseUrl}/contato" style="color: #1e293b; text-decoration: none; font-size: 14px; font-weight: 500;">
                      Suporte
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Branding -->
          <tr>
            <td style="background-color: #1e293b; padding: 24px; text-align: center;">
              <p style="color: #e2e8f0; font-size: 13px; margin: 0 0 8px 0; font-weight: 500;">
                © ${new Date().getFullYear()} Preço Justo AI
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                Análise fundamentalista inteligente • ${baseUrl}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
${ticker}: Score Geral ${changeVerb}

Olá ${userName},

Detectamos uma mudança relevante nos fundamentos de ${companyName} (${ticker}), uma empresa que você está monitorando.

Score Geral: ${previousScore.toFixed(1)} → ${currentScore.toFixed(1)} (variação de ${scoreDelta} pontos)

Principais Mudanças:
${reportSummary}

Ver relatório completo: ${reportUrl}

Ver página da empresa: ${assetUrl}

Você está recebendo este email porque se inscreveu para receber atualizações sobre ${ticker}.
Gerenciar inscrições: ${manageSubscriptionsUrl}

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  };
}

export async function sendAssetChangeEmail(params: {
  email: string;
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
  changeDirection: 'positive' | 'negative';
  previousScore: number;
  currentScore: number;
  reportSummary: string;
  reportUrl: string;
}) {
  const template = generateAssetChangeEmailTemplate(params);
  
  return await sendEmail({
    to: params.email,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}

// ===== TEMPLATE PARA USUÁRIOS GRATUITOS (CONVERSÃO) =====

export async function generateFreeUserAssetChangeEmailTemplate(params: {
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
}) {
  const {
    userName,
    ticker,
    companyName,
    companyLogoUrl,
  } = params;

  const baseUrl = getEmailBaseUrl();
  const logoUrl = getEmailLogoUrl();
  const assetUrl = `${baseUrl}/acao/${ticker.toLowerCase()}`;
  const upgradeUrl = `${baseUrl}/planos`;
  const manageSubscriptionsUrl = `${baseUrl}/dashboard/subscriptions`;
  
  // Converter URLs SVG para formato compatível com email usando wsrv.nl (PNG)
  // wsrv.nl é mais confiável e compatível com clientes de email do que SVG base64
  const getEmailCompatibleImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    // Se for uma URL da brapi.dev (SVG), usar wsrv.nl para converter para PNG
    if (url.includes('icons.brapi.dev') && url.endsWith('.svg')) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=128&h=128&output=png&default=https://via.placeholder.com/128x128/8b5cf6/ffffff?text=${ticker}`;
    }
    
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    
    return url;
  };
  
  const emailCompatibleLogoUrl = getEmailCompatibleImageUrl(companyLogoUrl);

  return {
    subject: `Mudança detectada em ${ticker} - Veja os detalhes completos`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atualização: ${ticker}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); overflow: hidden;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #1e293b; padding: 40px 30px; text-align: center;">
              <table role="presentation" style="width: 100%; margin: 0 auto;">
                <tr>
                  <td style="text-align: center;">
                    <div style="background-color: #ffffff; padding: 12px; border-radius: 8px; display: inline-block;">
                      <img src="${logoUrl}" alt="Preço Justo AI" style="height: 32px; width: auto; display: block; margin: 0 auto;" />
                    </div>
                  </td>
                </tr>
              </table>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                Mudança Detectada
              </h1>
            </td>
          </tr>

          <!-- Company Header with Logo -->
          <tr>
            <td style="padding: 40px 30px 30px; text-align: center; background-color: #ffffff;">
              ${emailCompatibleLogoUrl ? `
              <table role="presentation" style="margin: 0 auto 20px;">
                <tr>
                  <td style="text-align: center;">
                    <img src="${emailCompatibleLogoUrl}" 
                         alt="${companyName}" 
                         style="width: 64px; height: 64px; border-radius: 8px; object-fit: contain; display: block; margin: 0 auto;" 
                         width="64" 
                         height="64" />
                  </td>
                </tr>
              </table>
              ` : ''}
              <h2 style="color: #111827; margin: 0 0 6px 0; font-size: 24px; font-weight: 600;">
                ${companyName}
              </h2>
              <div style="color: #6b7280; font-size: 16px; font-weight: 500; margin-bottom: 16px;">
                ${ticker}
              </div>
            </td>
          </tr>

          <!-- Saudação -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <p style="color: #374151; font-size: 17px; line-height: 1.6; margin: 0;">
                Olá <strong>${userName}</strong>, 👋
              </p>
            </td>
          </tr>

          <!-- Informação Principal -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                Detectamos uma <strong>mudança relevante</strong> nos fundamentos de <strong>${companyName} (${ticker})</strong>, uma empresa que você está monitorando.
              </p>

              <!-- Highlight Box -->
              <table role="presentation" style="width: 100%; background-color: #fef3c7; border-radius: 8px; border: 1px solid #f59e0b; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <div style="font-size: 13px; color: #92400e; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Notificação Limitada
                    </div>
                    <div style="font-size: 16px; font-weight: 600; color: #78350f; line-height: 1.5;">
                      Faça upgrade para Premium e receba relatórios completos com análise detalhada da mudança
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Principal -->
          <tr>
            <td style="padding: 0 30px 40px; text-align: center;">
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 6px; background-color: #1e293b;">
                    <a href="${upgradeUrl}" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 600; font-size: 16px;">
                      Fazer Upgrade para Premium
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Benefícios Premium -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; border: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 600; text-align: center;">
                  O que você recebe como Premium:
                </h3>
                
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; vertical-align: top;">
                      <div style="display: inline-block; width: 32px; height: 32px; background-color: #1e293b; border-radius: 6px; text-align: center; line-height: 32px; font-size: 16px; margin-right: 12px; vertical-align: middle; color: #ffffff;">
                        🤖
                      </div>
                      <div style="display: inline-block; vertical-align: middle; width: calc(100% - 50px);">
                        <h4 style="margin: 0 0 4px 0; color: #111827; font-weight: 600; font-size: 15px;">Relatórios com IA</h4>
                        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">Análise completa gerada por Google Gemini AI explicando as mudanças</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; vertical-align: top;">
                      <div style="display: inline-block; width: 32px; height: 32px; background-color: #1e293b; border-radius: 6px; text-align: center; line-height: 32px; font-size: 16px; margin-right: 12px; vertical-align: middle; color: #ffffff;">
                        📊
                      </div>
                      <div style="display: inline-block; vertical-align: middle; width: calc(100% - 50px);">
                        <h4 style="margin: 0 0 4px 0; color: #111827; font-weight: 600; font-size: 15px;">Scores Detalhados</h4>
                        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">Veja exatamente como o score mudou e o que causou a variação</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; vertical-align: top;">
                      <div style="display: inline-block; width: 32px; height: 32px; background-color: #1e293b; border-radius: 6px; text-align: center; line-height: 32px; font-size: 16px; margin-right: 12px; vertical-align: middle; color: #ffffff;">
                        📈
                      </div>
                      <div style="display: inline-block; vertical-align: middle; width: calc(100% - 50px);">
                        <h4 style="margin: 0 0 4px 0; color: #111827; font-weight: 600; font-size: 15px;">Análises Completas</h4>
                        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">Acesso a todos os modelos de valuation e análises fundamentais</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; vertical-align: top;">
                      <div style="display: inline-block; width: 32px; height: 32px; background-color: #1e293b; border-radius: 6px; text-align: center; line-height: 32px; font-size: 16px; margin-right: 12px; vertical-align: middle; color: #ffffff;">
                        🔔
                      </div>
                      <div style="display: inline-block; vertical-align: middle; width: calc(100% - 50px);">
                        <h4 style="margin: 0 0 4px 0; color: #111827; font-weight: 600; font-size: 15px;">Notificações Detalhadas</h4>
                        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">Receba emails completos sempre que houver mudanças significativas</p>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Secondary CTA -->
          <tr>
            <td style="padding: 0 30px 40px; text-align: center;">
              <a href="${assetUrl}" style="color: #1e293b; text-decoration: none; font-size: 15px; font-weight: 500;">
                Ver página de ${ticker}
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 30px;">
              <div style="border-top: 1px solid #e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer Info -->
          <tr>
            <td style="padding: 32px 30px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                Você está recebendo este email porque se inscreveu para receber atualizações sobre <strong>${ticker}</strong>
              </p>
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 12px;">
                    <a href="${manageSubscriptionsUrl}" style="color: #1e293b; text-decoration: none; font-size: 14px; font-weight: 500;">
                      Gerenciar inscrições
                    </a>
                  </td>
                  <td style="padding: 0 12px; color: #d1d5db;">|</td>
                  <td style="padding: 0 12px;">
                    <a href="${baseUrl}/contato" style="color: #1e293b; text-decoration: none; font-size: 14px; font-weight: 500;">
                      Suporte
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Branding -->
          <tr>
            <td style="background-color: #1e293b; padding: 24px; text-align: center;">
              <p style="color: #e2e8f0; font-size: 13px; margin: 0 0 8px 0; font-weight: 500;">
                © ${new Date().getFullYear()} Preço Justo AI
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                Análise fundamentalista inteligente • ${baseUrl}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
Mudança detectada em ${ticker} - Veja os detalhes completos

Olá ${userName},

Detectamos uma mudança relevante nos fundamentos de ${companyName} (${ticker}), uma empresa que você está monitorando.

Para ver detalhes completos e relatórios gerados por IA, faça upgrade para Premium.

O que você recebe como Premium:
- Relatórios com IA: Análise completa gerada por Google Gemini AI explicando as mudanças
- Scores Detalhados: Veja exatamente como o score mudou e o que causou a variação
- Análises Completas: Acesso a todos os modelos de valuation e análises fundamentais
- Notificações Detalhadas: Receba emails completos sempre que houver mudanças significativas

Fazer upgrade: ${upgradeUrl}

Ver página de ${ticker}: ${assetUrl}

Você está recebendo este email porque se inscreveu para receber atualizações sobre ${ticker}.
Gerenciar inscrições: ${manageSubscriptionsUrl}

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  };
}

export async function sendFreeUserAssetChangeEmail(params: {
  email: string;
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
}) {
  const template = await generateFreeUserAssetChangeEmailTemplate(params);
  
  return await sendEmail({
    to: params.email,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}

// ===== TEMPLATE PARA RELATÓRIOS MENSAIS =====

export function generateMonthlyReportEmailTemplate(params: {
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
  reportSummary: string;
  reportUrl: string;
}) {
  const {
    userName,
    ticker,
    companyName,
    companyLogoUrl,
    reportSummary,
    reportUrl,
  } = params;

  const baseUrl = getEmailBaseUrl();
  const logoUrl = getEmailLogoUrl();
  const assetUrl = `${baseUrl}/acao/${ticker.toLowerCase()}`;
  const manageSubscriptionsUrl = `${baseUrl}/dashboard/subscriptions`;
  
  // Converter URLs SVG para formato compatível com email usando wsrv.nl
  const getEmailCompatibleImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    // Se for uma URL da brapi.dev (SVG), usar wsrv.nl para converter para PNG
    if (url.includes('icons.brapi.dev') && url.endsWith('.svg')) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=128&h=128&output=png&default=https://via.placeholder.com/128x128/8b5cf6/ffffff?text=${ticker}`;
    }
    
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    
    return url;
  };
  
  const emailCompatibleLogoUrl = getEmailCompatibleImageUrl(companyLogoUrl);

  return {
    subject: `📊 Novo Relatório Mensal: ${ticker} - ${companyName}`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Mensal: ${ticker}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); overflow: hidden;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #1e293b; padding: 40px 30px; text-align: center;">
              <table role="presentation" style="width: 100%; margin: 0 auto;">
                <tr>
                  <td style="text-align: center;">
                    <div style="background-color: #ffffff; padding: 12px; border-radius: 8px; display: inline-block;">
                      <img src="${logoUrl}" alt="Preço Justo AI" style="height: 32px; width: auto; display: block; margin: 0 auto;" />
                    </div>
                  </td>
                </tr>
              </table>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                Relatório Mensal
              </h1>
            </td>
          </tr>

          <!-- Company Header with Logo -->
          <tr>
            <td style="padding: 40px 30px 30px; text-align: center; background-color: #ffffff;">
              ${emailCompatibleLogoUrl ? `
              <table role="presentation" style="margin: 0 auto 20px;">
                <tr>
                  <td style="text-align: center;">
                    <img src="${emailCompatibleLogoUrl}" 
                         alt="${companyName}" 
                         style="width: 64px; height: 64px; border-radius: 8px; object-fit: contain; display: block; margin: 0 auto;" 
                         width="64" 
                         height="64" />
                  </td>
                </tr>
              </table>
              ` : ''}
              <h2 style="color: #111827; margin: 0 0 6px 0; font-size: 24px; font-weight: 600;">
                ${companyName}
              </h2>
              <div style="color: #6b7280; font-size: 16px; font-weight: 500; margin-bottom: 16px;">
                ${ticker}
              </div>
            </td>
          </tr>

          <!-- Saudação -->
          <tr>
            <td style="padding: 30px 30px 20px;">
              <p style="color: #374151; font-size: 17px; line-height: 1.6; margin: 0;">
                Olá <strong>${userName}</strong>, 👋
              </p>
            </td>
          </tr>

          <!-- Informação Principal -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                Um novo <strong>relatório mensal</strong> foi gerado para <strong>${companyName} (${ticker})</strong>, uma empresa que você está monitorando. 
                Nossa Inteligência Artificial analisou os dados mais recentes e preparou uma análise completa para você.
              </p>

              <!-- Highlight Box -->
              <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Análise Mensal Completa
                    </div>
                    <div style="font-size: 16px; font-weight: 600; color: #111827; line-height: 1.5;">
                      Análise fundamentalista completa gerada por nossa IA
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Resumo do Relatório -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <div style="background-color: #f9fafb; border-left: 3px solid #1e293b; padding: 20px 24px; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 600;">
                  Resumo Executivo
                </h3>
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  ${reportSummary}
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 40px; text-align: center;">
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 6px; background-color: #1e293b;">
                    <a href="${reportUrl}" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 600; font-size: 16px;">
                      Ver Relatório Completo
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Secondary CTA -->
          <tr>
            <td style="padding: 0 30px 40px; text-align: center;">
              <a href="${assetUrl}" style="color: #1e293b; text-decoration: none; font-size: 15px; font-weight: 500;">
                Ver página completa de ${ticker}
              </a>
            </td>
          </tr>

          <!-- Info Box -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                <div style="display: flex; align-items: start; gap: 12px;">
                  <span style="font-size: 20px; flex-shrink: 0;">💡</span>
                  <div>
                    <h4 style="margin: 0 0 8px 0; color: #111827; font-size: 15px; font-weight: 600;">
                      Sobre os Relatórios Mensais
                    </h4>
                    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                      Nossos relatórios mensais são gerados automaticamente usando Inteligência Artificial e incluem análise completa dos fundamentos, 
                      múltiplos modelos de valuation e insights estratégicos para ajudar você a tomar decisões de investimento mais informadas.
                    </p>
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 30px;">
              <div style="border-top: 1px solid #e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer Info -->
          <tr>
            <td style="padding: 32px 30px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                Você está recebendo este email porque se inscreveu para receber atualizações sobre <strong>${ticker}</strong>
              </p>
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 12px;">
                    <a href="${manageSubscriptionsUrl}" style="color: #1e293b; text-decoration: none; font-size: 14px; font-weight: 500;">
                      Gerenciar inscrições
                    </a>
                  </td>
                  <td style="padding: 0 12px; color: #d1d5db;">|</td>
                  <td style="padding: 0 12px;">
                    <a href="${baseUrl}/contato" style="color: #1e293b; text-decoration: none; font-size: 14px; font-weight: 500;">
                      Suporte
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Branding -->
          <tr>
            <td style="background-color: #1e293b; padding: 24px; text-align: center;">
              <p style="color: #e2e8f0; font-size: 13px; margin: 0 0 8px 0; font-weight: 500;">
                © ${new Date().getFullYear()} Preço Justo AI
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                Análise fundamentalista inteligente • ${baseUrl}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
Novo Relatório Mensal: ${ticker} - ${companyName}

Olá ${userName},

Um novo relatório mensal foi gerado para ${companyName} (${ticker}), uma empresa que você está monitorando. 
Nossa Inteligência Artificial analisou os dados mais recentes e preparou uma análise completa para você.

Resumo Executivo:
${reportSummary}

Ver relatório completo: ${reportUrl}

Ver página da empresa: ${assetUrl}

Sobre os Relatórios Mensais:
Nossos relatórios mensais são gerados automaticamente usando Inteligência Artificial e incluem análise completa dos fundamentos, 
múltiplos modelos de valuation e insights estratégicos para ajudar você a tomar decisões de investimento mais informadas.

Você está recebendo este email porque se inscreveu para receber atualizações sobre ${ticker}.
Gerenciar inscrições: ${manageSubscriptionsUrl}

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  };
}

export async function sendMonthlyReportEmail(params: {
  email: string;
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
  reportSummary: string;
  reportUrl: string;
}) {
  const template = generateMonthlyReportEmailTemplate(params);
  
  return await sendEmail({
    to: params.email,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}

export function generateEmailVerificationTemplate(verificationUrl: string, userName?: string) {
  const baseUrl = getEmailBaseUrl()
  const logoUrl = getEmailLogoUrl()
  
  return {
    subject: 'Verifique seu email - Preço Justo AI',
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verificar Email - Preço Justo AI</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
            min-height: 100vh;
          }
          
          .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
          }
          
          .header {
            background-color: #1e293b;
            padding: 40px 30px;
            text-align: center;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 20px;
            text-align: center;
            background-color: #ffffff;
            padding: 16px;
            border-radius: 12px;
            display: inline-block;
          }
          
          .logo {
            max-width: 200px;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          
          .header-title {
            color: #ffffff;
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .header-subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 18px;
            font-weight: 400;
            position: relative;
            z-index: 2;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .greeting {
            font-size: 18px;
            color: #475569;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .main-text {
            font-size: 16px;
            color: #64748b;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .button-container {
            text-align: center;
            margin: 40px 0;
          }
          
          .button {
            display: inline-block;
            background-color: #1e293b;
            color: #ffffff;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.05);
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
          }
          
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.4), 0 10px 10px -5px rgba(59, 130, 246, 0.1);
          }
          
          .link-section {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 30px 0;
          }
          
          .link-title {
            font-size: 14px;
            color: #475569;
            margin-bottom: 10px;
            font-weight: 500;
          }
          
          .link-url {
            word-break: break-all;
            background: #ffffff;
            padding: 12px 16px;
            border-radius: 8px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 13px;
            color: #3b82f6;
            border: 1px solid #e2e8f0;
            text-decoration: none;
          }
          
          .info-box {
            background-color: #eff6ff;
            border: 1px solid #3b82f6;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
          }
          
          .info-icon {
            font-size: 24px;
            margin-bottom: 8px;
            display: block;
          }
          
          .info-title {
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 12px;
            font-size: 16px;
          }
          
          .info-text {
            color: #1e40af;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 15px;
          }
          
          .footer-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
          }
          
          .footer-link:hover {
            text-decoration: underline;
          }
          
          .footer-brand {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-brand-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
          }
          
          .footer-tagline {
            color: #94a3b8;
            font-size: 13px;
            margin-top: 5px;
          }
          
          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .footer {
              padding: 25px 20px;
            }
            
            .header-title {
              font-size: 28px;
            }
            
            .header-subtitle {
              font-size: 16px;
            }
            
            .button {
              padding: 14px 24px;
              font-size: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" />
              </div>
              <h1 class="header-title">Verifique seu email</h1>
              <p class="header-subtitle">Confirme sua conta para começar</p>
            </div>
            
            <div class="content">
              <p class="greeting">
                ${userName ? `Olá, <strong>${userName}</strong>!` : 'Olá!'} 👋
              </p>
              
              <p class="main-text">
                Obrigado por se cadastrar no <strong>Preço Justo AI</strong>! 
                Para ativar sua conta e começar a usar todas as funcionalidades, 
                precisamos confirmar que este email é realmente seu.
              </p>
              
              <div class="button-container">
                <a href="${verificationUrl}" class="button" style="background-color: #1e293b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; text-align: center; display: inline-block;">✅ Verificar Meu Email</a>
              </div>
              
              <div class="link-section">
                <p class="link-title">Ou copie e cole este link no seu navegador:</p>
                <div class="link-url">${verificationUrl}</div>
              </div>
              
              <div class="info-box">
                <span class="info-icon">ℹ️</span>
                <div class="info-title">Por que preciso verificar meu email?</div>
                <div class="info-text">
                  A verificação de email garante a segurança da sua conta e permite que você tenha acesso completo às funcionalidades Premium, incluindo o período de trial de 1 dia.
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Se você não conseguir clicar no botão, copie e cole o link completo no seu navegador.
              </p>
              <p class="footer-text">
                Este link expira em <strong>24 horas</strong>. Se você não solicitou este cadastro, pode ignorar este email.
              </p>
              <p class="footer-text">
                Precisa de ajuda? Entre em contato conosco em 
                <a href="mailto:suporte@precojusto.ai" class="footer-link">suporte@precojusto.ai</a>
              </p>
              
              <div class="footer-brand">
                <a href="${baseUrl}" class="footer-brand-link">Preço Justo AI</a>
                <p class="footer-tagline">Análise fundamentalista inteligente para seus investimentos</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Verifique seu email - Preço Justo AI

${userName ? `Olá, ${userName}!` : 'Olá!'} Obrigado por se cadastrar no Preço Justo AI!

Para ativar sua conta e começar a usar todas as funcionalidades, precisamos confirmar que este email é realmente seu.

Clique no link abaixo para verificar seu email:
${verificationUrl}

Por que preciso verificar meu email?
A verificação de email garante a segurança da sua conta e permite que você tenha acesso completo às funcionalidades Premium, incluindo o período de trial de 1 dia.

IMPORTANTE:
- Este link expira em 24 horas
- Se você não solicitou este cadastro, pode ignorar este email

Precisa de ajuda? Entre em contato conosco em suporte@precojusto.ai

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  }
}

/**
 * Converte markdown para HTML de forma segura para emails
 */
function convertMarkdownToHtml(markdown: string): string {
  try {
    // Converter markdown para HTML
    const html = marked(markdown, {
      breaks: true, // Quebras de linha viram <br>
      gfm: true, // GitHub Flavored Markdown
    }) as string
    
    // Remover quebras de linha extras e limpar HTML
    return html.trim()
  } catch (error) {
    console.error('Erro ao converter markdown para HTML:', error)
    // Fallback: converter quebras de linha para <br>
    return markdown.replace(/\n/g, '<br>')
  }
}

/**
 * Remove formatação markdown básica para texto plano
 */
function stripMarkdown(markdown: string): string {
  return markdown
    // Remover headers (# ## ###)
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    // Remover negrito (**texto** ou __texto__)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Remover itálico (*texto* ou _texto_)
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remover links [texto](url)
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Remover código `código`
    .replace(/`(.+?)`/g, '$1')
    // Remover listas (- ou *)
    .replace(/^[-*]\s+/gm, '')
    // Remover blockquotes (>)
    .replace(/^>\s+/gm, '')
    .trim()
}

export function generateNotificationEmailTemplate(
  title: string,
  message: string,
  link: string | null,
  userName?: string,
  ctaText?: string | null,
  illustrationUrl?: string | null
) {
  const baseUrl = getEmailBaseUrl()
  const logoUrl = getEmailLogoUrl()
  
  // Converter URLs SVG para formato compatível com email usando wsrv.nl
  const getEmailCompatibleImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null
    
    // Se for uma URL da brapi.dev (SVG), usar wsrv.nl para converter para PNG
    if (url.includes('icons.brapi.dev') && url.endsWith('.svg')) {
      // Extrair ticker da URL ou do título se possível
      const tickerMatch = url.match(/icons\/([A-Z0-9]+)\.svg/i) || title.match(/([A-Z0-9]{4,5})/i)
      const ticker = tickerMatch ? tickerMatch[1].toUpperCase() : 'LOGO'
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=128&h=128&output=png&default=https://via.placeholder.com/128x128/667eea/ffffff?text=${ticker}`
    }
    
    // Se for URL relativa, adicionar base URL
    if (url.startsWith('/')) {
      return baseUrl + url
    }
    
    // Se já for URL absoluta e não for SVG problemático, retornar como está
    return url
  }
  
  const emailCompatibleIllustrationUrl = getEmailCompatibleImageUrl(illustrationUrl)
  
  return {
    subject: title,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - Preço Justo AI</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          
          .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
          }
          
          .header {
            background-color: #1e293b;
            padding: 40px 30px;
            text-align: center;
          }
          
          .logo-container {
            margin-bottom: 20px;
            text-align: center;
            background-color: #ffffff;
            padding: 16px;
            border-radius: 12px;
            display: inline-block;
          }
          
          .logo {
            max-width: 180px;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          
          .header-title {
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            margin-top: 20px;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .greeting {
            font-size: 18px;
            color: #475569;
            margin-bottom: 20px;
          }
          
          .notification-title {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 15px;
          }
          
          .notification-message {
            font-size: 16px;
            color: #64748b;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          
          .notification-message h1,
          .notification-message h2,
          .notification-message h3,
          .notification-message h4 {
            color: #1e293b;
            font-weight: 700;
            margin-top: 20px;
            margin-bottom: 10px;
          }
          
          .notification-message h1 { font-size: 24px; }
          .notification-message h2 { font-size: 20px; }
          .notification-message h3 { font-size: 18px; }
          .notification-message h4 { font-size: 16px; }
          
          .notification-message p {
            margin-bottom: 12px;
          }
          
          .notification-message strong {
            font-weight: 700;
            color: #1e293b;
          }
          
          .notification-message em {
            font-style: italic;
          }
          
          .notification-message ul,
          .notification-message ol {
            margin-left: 20px;
            margin-bottom: 12px;
          }
          
          .notification-message li {
            margin-bottom: 6px;
          }
          
          .notification-message a {
            color: #3b82f6;
            text-decoration: underline;
          }
          
          .notification-message code {
            background-color: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
          }
          
          .notification-message blockquote {
            border-left: 4px solid #e2e8f0;
            padding-left: 16px;
            margin-left: 0;
            margin-bottom: 12px;
            color: #64748b;
            font-style: italic;
          }
          
          .illustration-container {
            text-align: center;
            margin: 30px 0;
          }
          
          .illustration {
            max-width: 100%;
            height: auto;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          
          .button {
            display: inline-block;
            background-color: #3b82f6;
            color: #ffffff !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 16px;
            line-height: 1.5;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            transition: all 0.2s ease;
            border: none;
            text-align: center;
            min-width: 200px;
          }
          
          .button:hover {
            background-color: #2563eb;
            box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
            transform: translateY(-1px);
          }
          
          .button:active {
            transform: translateY(0);
          }
          
          /* Garantir que o texto seja sempre branco */
          .button,
          .button * {
            color: #ffffff !important;
          }
          
          .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 15px;
          }
          
          .footer-link {
            color: #3b82f6;
            text-decoration: none;
          }
          
          .footer-brand {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-brand-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
          }
          
          .footer-tagline {
            color: #94a3b8;
            font-size: 13px;
            margin-top: 5px;
          }
          
          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .notification-title {
              font-size: 18px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" />
              </div>
              <h1 class="header-title">${stripMarkdown(title) || 'Nova Notificação'}</h1>
            </div>
            
            <div class="content">
              <p class="greeting">
                ${userName ? `Olá, <strong>${userName}</strong>!` : 'Olá!'} 👋
              </p>
              
              <h2 class="notification-title">${convertMarkdownToHtml(title)}</h2>
              
              ${emailCompatibleIllustrationUrl ? `
                <div class="illustration-container">
                  <img src="${emailCompatibleIllustrationUrl}" alt="${stripMarkdown(title) || 'Notificação'}" class="illustration" />
                </div>
              ` : ''}
              
              <div class="notification-message">
                ${convertMarkdownToHtml(message)}
              </div>
              
              ${link ? `
                <div class="button-container">
                  <a href="${link}" class="button" style="color: #ffffff !important; text-decoration: none;">
                    ${ctaText || 'Ver detalhes'}
                  </a>
                </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Esta é uma notificação automática do Preço Justo AI.
              </p>
              <p class="footer-text">
                Você pode gerenciar suas preferências de notificações em 
                <a href="${baseUrl}/perfil" class="footer-link">suas configurações</a>.
              </p>
              
              <div class="footer-brand">
                <a href="${baseUrl}" class="footer-brand-link">Preço Justo AI</a>
                <p class="footer-tagline">Análise fundamentalista inteligente para seus investimentos</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
${stripMarkdown(title)} - Preço Justo AI

${userName ? `Olá, ${userName}!` : 'Olá!'}

${stripMarkdown(title)}

${stripMarkdown(message)}

${link ? `\nAcesse: ${link}` : ''}

---
Esta é uma notificação automática do Preço Justo AI.
Você pode gerenciar suas preferências em ${baseUrl}/perfil

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  }
}

// ===== TEMPLATE PARA CONFIRMAÇÃO DE INSCRIÇÃO (LGPD) =====

export function generateSubscriptionConfirmationTemplate(params: {
  email: string;
  ticker: string;
  companyName: string;
  unsubscribeUrl: string;
  companyLogoUrl?: string | null;
}) {
  const {
    email,
    ticker,
    companyName,
    unsubscribeUrl,
    companyLogoUrl,
  } = params;

  const baseUrl = getEmailBaseUrl();
  const logoUrl = getEmailLogoUrl();
  const assetUrl = `${baseUrl}/acao/${ticker.toLowerCase()}`;
  
  // Converter URLs SVG para formato compatível com email usando wsrv.nl
  const getEmailCompatibleImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    // Se for uma URL da brapi.dev (SVG), usar wsrv.nl para converter para PNG
    if (url.includes('icons.brapi.dev') && url.endsWith('.svg')) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=128&h=128&output=png&default=https://via.placeholder.com/128x128/667eea/ffffff?text=${ticker}`;
    }
    
    // Se for URL relativa, adicionar base URL
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    
    // Se já for URL absoluta e não for SVG problemático, retornar como está
    return url;
  };
  
  const emailCompatibleLogoUrl = getEmailCompatibleImageUrl(companyLogoUrl);

  return {
    subject: `Confirmação de inscrição: ${ticker} - Preço Justo AI`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmação de Inscrição - Preço Justo AI</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
            min-height: 100vh;
          }
          
          .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 20px;
            text-align: center;
            background-color: #ffffff;
            padding: 16px;
            border-radius: 12px;
            display: inline-block;
          }
          
          .logo {
            max-width: 200px;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          
          .header-title {
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .header-subtitle {
            color: rgba(255, 255, 255, 0.95);
            font-size: 16px;
            font-weight: 400;
            position: relative;
            z-index: 2;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .success-icon {
            text-align: center;
            margin-bottom: 24px;
            width: 100%;
            display: block;
          }
          
          .success-icon-circle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            font-size: 32px;
            color: #ffffff;
            box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
            margin: 0 auto;
            text-align: center;
          }
          
          .greeting {
            font-size: 20px;
            color: #1e293b;
            margin-bottom: 16px;
            text-align: center;
            font-weight: 600;
          }
          
          .main-text {
            font-size: 16px;
            color: #475569;
            margin-bottom: 30px;
            text-align: center;
            line-height: 1.7;
          }
          
          .asset-info {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
            text-align: center;
          }
          
          .asset-ticker {
            font-size: 32px;
            font-weight: 800;
            color: #667eea;
            margin-bottom: 8px;
          }
          
          .asset-name {
            font-size: 18px;
            color: #64748b;
            margin-bottom: 16px;
          }
          
          ${emailCompatibleLogoUrl ? `
          .asset-logo {
            width: 80px;
            height: 80px;
            border-radius: 12px;
            margin: 0 auto 16px;
            object-fit: contain;
            background: #ffffff;
            padding: 8px;
            border: 2px solid #e2e8f0;
          }
          ` : ''}
          
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            box-shadow: 0 10px 15px -3px rgba(102, 126, 234, 0.3), 0 4px 6px -2px rgba(102, 126, 234, 0.05);
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
          }
          
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 25px -5px rgba(102, 126, 234, 0.4), 0 10px 10px -5px rgba(102, 126, 234, 0.1);
          }
          
          .info-box {
            background-color: #eff6ff;
            border: 1px solid #3b82f6;
            border-radius: 12px;
            padding: 20px;
            margin: 30px 0;
          }
          
          .info-title {
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 12px;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .info-text {
            color: #1e40af;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .info-list {
            margin-top: 12px;
            padding-left: 20px;
          }
          
          .info-list li {
            margin-bottom: 8px;
            color: #1e40af;
          }
          
          .footer {
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 13px;
            margin-bottom: 12px;
            line-height: 1.6;
          }
          
          .unsubscribe-link {
            color: #94a3b8;
            font-size: 11px;
            text-decoration: none;
            margin-top: 20px;
            display: inline-block;
          }
          
          .unsubscribe-link:hover {
            color: #64748b;
            text-decoration: underline;
          }
          
          .footer-brand {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-brand-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
          }
          
          .footer-tagline {
            color: #94a3b8;
            font-size: 13px;
            margin-top: 5px;
          }
          
          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .footer {
              padding: 25px 20px;
            }
            
            .header-title {
              font-size: 24px;
            }
            
            .header-subtitle {
              font-size: 14px;
            }
            
            .button {
              padding: 14px 24px;
              font-size: 15px;
            }
            
            .asset-ticker {
              font-size: 28px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" />
              </div>
              <h1 class="header-title">Inscrição Confirmada!</h1>
              <p class="header-subtitle">Você receberá notificações sobre ${ticker}</p>
            </div>
            
            <div class="content">
              <div class="success-icon">
                <div class="success-icon-circle">✓</div>
              </div>
              
              <p class="greeting">
                Olá!
              </p>
              
              <p class="main-text">
                Sua inscrição para receber notificações sobre <strong>${companyName} (${ticker})</strong> foi confirmada com sucesso!
              </p>
              
              <div class="asset-info">
                ${emailCompatibleLogoUrl ? `<img src="${emailCompatibleLogoUrl}" alt="${companyName}" class="asset-logo" />` : ''}
                <div class="asset-ticker">${ticker}</div>
                <div class="asset-name">${companyName}</div>
              </div>
              
              <div class="button-container">
                <a href="${assetUrl}" class="button">Ver Análise Completa</a>
              </div>
              
              <div class="info-box">
                <div class="info-title">
                  <span>📧</span>
                  <span>O que você receberá:</span>
                </div>
                <div class="info-text">
                  <ul class="info-list">
                    <li>Notificações quando houver mudanças significativas nos fundamentos de ${ticker}</li>
                    <li>Alertas sobre variações importantes no Score de Qualidade</li>
                    <li>Relatórios mensais com análise completa da empresa</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Você receberá emails apenas quando houver informações relevantes sobre ${ticker}.
              </p>
              <p class="footer-text">
                Precisa de ajuda? Entre em contato conosco em 
                <a href="mailto:suporte@precojusto.ai" style="color: #3b82f6; text-decoration: none;">suporte@precojusto.ai</a>
              </p>
              
              <a href="${unsubscribeUrl}" class="unsubscribe-link">
                Cancelar inscrição
              </a>
              
              <div class="footer-brand">
                <a href="${baseUrl}" class="footer-brand-link">Preço Justo AI</a>
                <p class="footer-tagline">Análise fundamentalista inteligente para seus investimentos</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Confirmação de inscrição: ${ticker} - Preço Justo AI

Olá!

Sua inscrição para receber notificações sobre ${companyName} (${ticker}) foi confirmada com sucesso!

O que você receberá:
- Notificações quando houver mudanças significativas nos fundamentos de ${ticker}
- Alertas sobre variações importantes no Score de Qualidade
- Relatórios mensais com análise completa da empresa

Ver análise completa: ${assetUrl}

Você receberá emails apenas quando houver informações relevantes sobre ${ticker}.

Precisa de ajuda? Entre em contato conosco em suporte@precojusto.ai

Cancelar inscrição: ${unsubscribeUrl}

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  };
}

export async function sendSubscriptionConfirmationEmail(params: {
  email: string;
  ticker: string;
  companyName: string;
  unsubscribeUrl: string;
  companyLogoUrl?: string | null;
}) {
  const template = generateSubscriptionConfirmationTemplate(params);
  
  return await sendEmail({
    to: params.email,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}

/**
 * Template para confirmação de múltiplos monitoramentos criados em massa
 */
export function generateBulkMonitoringConfirmationTemplate(params: {
  email: string;
  companies: Array<{
    ticker: string;
    companyName: string;
    unsubscribeUrl: string;
  }>;
}) {
  const { email, companies } = params;
  const baseUrl = getEmailBaseUrl();
  const logoUrl = getEmailLogoUrl();
  const count = companies.length;

  return {
    subject: `✅ ${count} ${count === 1 ? 'empresa monitorada' : 'empresas monitoradas'} com sucesso!`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monitoramentos Criados - Preço Justo AI</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          
          .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
          }
          
          .logo {
            max-width: 200px;
            height: auto;
            display: block;
            margin: 0 auto 20px;
          }
          
          .header-title {
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
          }
          
          .header-subtitle {
            color: rgba(255, 255, 255, 0.95);
            font-size: 16px;
            font-weight: 400;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .success-icon {
            text-align: center;
            margin-bottom: 24px;
          }
          
          .success-icon-circle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            font-size: 32px;
            color: #ffffff;
            box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
          }
          
          .greeting {
            font-size: 20px;
            color: #1e293b;
            margin-bottom: 16px;
            text-align: center;
            font-weight: 600;
          }
          
          .main-text {
            font-size: 16px;
            color: #475569;
            margin-bottom: 30px;
            text-align: center;
            line-height: 1.7;
          }
          
          .companies-list {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
          }
          
          .companies-title {
            font-size: 18px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 16px;
            text-align: center;
          }
          
          .company-item {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          
          .company-item:last-child {
            margin-bottom: 0;
          }
          
          .company-info {
            flex: 1;
          }
          
          .company-ticker {
            font-size: 20px;
            font-weight: 800;
            color: #667eea;
            margin-bottom: 4px;
          }
          
          .company-name {
            font-size: 14px;
            color: #64748b;
          }
          
          .company-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            padding: 8px 16px;
            border: 1px solid #667eea;
            border-radius: 6px;
            transition: all 0.2s;
          }
          
          .company-link:hover {
            background: #667eea;
            color: #ffffff;
          }
          
          .info-box {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
          }
          
          .info-title {
            font-size: 18px;
            font-weight: 700;
            color: #0369a1;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .info-list {
            color: #475569;
            font-size: 15px;
            line-height: 1.8;
            margin: 0;
            padding-left: 24px;
          }
          
          .info-list li {
            margin-bottom: 8px;
          }
          
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          
          .button {
            display: inline-block;
            background-color: #667eea;
            color: #ffffff !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 16px;
            box-shadow: 0 10px 15px -3px rgba(102, 126, 234, 0.3);
          }
          
          .footer {
            background: #f8fafc;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 12px;
            line-height: 1.6;
          }
          
          .footer-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
          }
          
          .footer-link:hover {
            text-decoration: underline;
          }
          
          .footer-brand {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-brand-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 700;
            font-size: 18px;
          }
          
          .footer-tagline {
            color: #94a3b8;
            font-size: 14px;
            margin-top: 6px;
          }
          
          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .company-item {
              flex-direction: column;
              align-items: flex-start;
              gap: 12px;
            }
            
            .company-link {
              width: 100%;
              text-align: center;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <img src="${logoUrl}" alt="Preço Justo AI" class="logo" />
              <h1 class="header-title">✅ Monitoramentos Criados!</h1>
              <p class="header-subtitle">Você está acompanhando ${count} ${count === 1 ? 'empresa' : 'empresas'}</p>
            </div>
            
            <div class="content">
              <div class="success-icon">
                <div class="success-icon-circle">✓</div>
              </div>
              
              <h2 class="greeting">Olá!</h2>
              
              <p class="main-text">
                Sua inscrição para receber notificações foi confirmada com sucesso!<br/>
                Você está agora monitorando <strong>${count} ${count === 1 ? 'empresa' : 'empresas'}</strong> na bolsa de valores.
              </p>
              
              <div class="companies-list">
                <h3 class="companies-title">📊 Empresas Monitoradas</h3>
                ${companies.map(company => `
                  <div class="company-item">
                    <div class="company-info">
                      <div class="company-ticker">${company.ticker}</div>
                      <div class="company-name">${company.companyName}</div>
                    </div>
                    <a href="${baseUrl}/acao/${company.ticker.toLowerCase()}" class="company-link">Ver Análise</a>
                  </div>
                `).join('')}
              </div>
              
              <div class="info-box">
                <div class="info-title">
                  <span>📧</span>
                  <span>O que você receberá:</span>
                </div>
                <ul class="info-list">
                  <li><strong>Relatórios Mensais:</strong> Análise completa de cada empresa monitorada</li>
                  <li><strong>Alertas de Mudanças:</strong> Notificações quando houver alterações significativas nos fundamentos</li>
                  <li><strong>Alertas de Variação de Preço:</strong> Avisos quando houver quedas significativas que podem indicar problemas</li>
                </ul>
              </div>
              
              <div class="button-container">
                <a href="${baseUrl}/acompanhar-acoes-bolsa-de-valores" class="button">Gerenciar Monitoramentos</a>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Você receberá emails apenas quando houver informações relevantes sobre as empresas monitoradas.
              </p>
              <p class="footer-text">
                Precisa de ajuda? Entre em contato conosco em 
                <a href="mailto:suporte@precojusto.ai" class="footer-link">suporte@precojusto.ai</a>
              </p>
              
              <div class="footer-brand">
                <a href="${baseUrl}" class="footer-brand-link">Preço Justo AI</a>
                <p class="footer-tagline">Análise fundamentalista inteligente para seus investimentos</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
✅ Monitoramentos Criados com Sucesso!

Olá!

Sua inscrição para receber notificações foi confirmada com sucesso!
Você está agora monitorando ${count} ${count === 1 ? 'empresa' : 'empresas'} na bolsa de valores.

Empresas Monitoradas:
${companies.map(c => `- ${c.ticker} - ${c.companyName}`).join('\n')}

O que você receberá:
- Relatórios Mensais: Análise completa de cada empresa monitorada
- Alertas de Mudanças: Notificações quando houver alterações significativas nos fundamentos
- Alertas de Variação de Preço: Avisos quando houver quedas significativas que podem indicar problemas

Gerenciar Monitoramentos: ${baseUrl}/acompanhar-acoes-bolsa-de-valores

Você receberá emails apenas quando houver informações relevantes sobre as empresas monitoradas.

Precisa de ajuda? Entre em contato conosco em suporte@precojusto.ai

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  };
}

export async function sendBulkMonitoringConfirmationEmail(params: {
  email: string;
  companies: Array<{
    ticker: string;
    companyName: string;
    unsubscribeUrl: string;
  }>;
}) {
  const template = generateBulkMonitoringConfirmationTemplate(params);
  
  return await sendEmail({
    to: params.email,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}

/**
 * Envia email de relatório de variação de preço
 * 
 * Lógica de templates baseada em isPremium e hasFlag:
 * 1. Não Premium + Flag = Email de situação crítica (conversão)
 * 2. Premium + Flag = Email destacando perda de fundamento + relatório completo
 * 3. Não Premium + Sem Flag = Email padrão não premium (conversão)
 * 4. Premium + Sem Flag = Email padrão premium com relatório completo
 */
export async function sendPriceVariationReportEmail(params: {
  email: string;
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
  reportUrl: string;
  reportSummary: string;
  isPremium?: boolean;
  hasFlag?: boolean; // Indica se há flag ativo para a empresa
}) {
  // Cenário 1: Não Premium + Flag = Email de situação crítica (conversão)
  if (!params.isPremium && params.hasFlag) {
    return await sendFlagAlertConversionEmail({
      email: params.email,
      userName: params.userName,
      ticker: params.ticker,
      companyName: params.companyName,
      companyLogoUrl: params.companyLogoUrl,
    });
  }

  // Cenário 2: Premium + Flag = Email destacando perda de fundamento + relatório completo
  if (params.isPremium && params.hasFlag) {
    const template = generateNotificationEmailTemplate(
      `🚨 Perda de Fundamentos Detectada: ${params.ticker}`,
      `Detectamos uma **perda de fundamentos** em ${params.companyName} (${params.ticker}).\n\nEsta é uma situação crítica que requer atenção imediata. O relatório completo analisa em detalhes o que aconteceu e o impacto dessa mudança.\n\n${params.reportSummary}`,
      params.reportUrl,
      params.userName,
      'Ver Relatório Completo',
      params.companyLogoUrl || undefined
    );
    
    return await sendEmail({
      to: params.email,
      subject: `🚨 Perda de Fundamentos: ${params.ticker} - Análise Completa`,
      html: template.html,
      text: template.text
    });
  }

  // Cenário 3: Não Premium + Sem Flag = Email padrão não premium (conversão)
  if (!params.isPremium) {
    return await sendPriceVariationConversionEmail({
      email: params.email,
      userName: params.userName,
      ticker: params.ticker,
      companyName: params.companyName,
      companyLogoUrl: params.companyLogoUrl,
    });
  }

  // Cenário 4: Premium + Sem Flag = Email padrão premium com relatório completo
  const template = generateNotificationEmailTemplate(
    `Relatório de Variação de Preço: ${params.ticker}`,
    `Um relatório de variação de preço foi gerado para ${params.companyName} (${params.ticker}).\n\n${params.reportSummary}`,
    params.reportUrl,
    params.userName,
    'Ver Relatório Completo',
    params.companyLogoUrl || undefined
  );
  
  return await sendEmail({
    to: params.email,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}

/**
 * Envia email de conversão para alerta de flag/perda de fundamentos (usuários não premium)
 * Não mostra detalhes do flag ou relatório, apenas incentiva upgrade
 */
export async function sendFlagAlertConversionEmail(params: {
  email: string;
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
}) {
  // Converter URLs SVG para formato compatível com email usando wsrv.nl (PNG)
  const getEmailCompatibleImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    const baseUrl = getEmailBaseUrl();
    
    // Se for uma URL da brapi.dev (SVG), usar wsrv.nl para converter para PNG
    if (url.includes('icons.brapi.dev') && url.endsWith('.svg')) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=128&h=128&output=png&default=https://via.placeholder.com/128x128/8b5cf6/ffffff?text=${params.ticker}`;
    }
    
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    
    return url;
  };
  
  const emailCompatibleLogoUrl = getEmailCompatibleImageUrl(params.companyLogoUrl);

  const template = await generateFreeUserAssetChangeEmailTemplate({
    userName: params.userName,
    ticker: params.ticker,
    companyName: params.companyName,
    companyLogoUrl: emailCompatibleLogoUrl,
  });

  // Ajustar assunto para alerta de flag
  const customSubject = `🚨 Situação Crítica Detectada: ${params.ticker} - Upgrade para Ver Detalhes`;
  
  return await sendEmail({
    to: params.email,
    subject: customSubject,
    html: template.html,
    text: template.text
  });
}

/**
 * Envia email de conversão para relatório de variação de preço (usuários não premium)
 * Não mostra detalhes do relatório, apenas incentiva upgrade
 */
export async function sendPriceVariationConversionEmail(params: {
  email: string;
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
}) {
  // Converter URLs SVG para formato compatível com email usando wsrv.nl (PNG)
  const getEmailCompatibleImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    const baseUrl = getEmailBaseUrl();
    
    // Se for uma URL da brapi.dev (SVG), usar wsrv.nl para converter para PNG
    if (url.includes('icons.brapi.dev') && url.endsWith('.svg')) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=128&h=128&output=png&default=https://via.placeholder.com/128x128/8b5cf6/ffffff?text=${params.ticker}`;
    }
    
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    
    return url;
  };
  
  const emailCompatibleLogoUrl = getEmailCompatibleImageUrl(params.companyLogoUrl);

  const template = await generateFreeUserAssetChangeEmailTemplate({
    userName: params.userName,
    ticker: params.ticker,
    companyName: params.companyName,
    companyLogoUrl: emailCompatibleLogoUrl,
  });

  // Ajustar assunto para price variation
  const subject = `Variação de Preço Detectada: ${params.ticker} - Veja os detalhes completos`;

  return await sendEmail({
    to: params.email,
    subject,
    html: template.html,
    text: template.text
  });
}

/**
 * Envia email de relatório de gatilho customizado
 * Para usuários não premium, envia email de conversão sem detalhes
 */
export async function sendCustomTriggerReportEmail(params: {
  email: string;
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
  reportUrl: string;
  reportSummary: string;
  isPremium?: boolean;
}) {
  // Se não for premium, enviar email de conversão sem detalhes
  if (!params.isPremium) {
    return await sendCustomTriggerConversionEmail({
      email: params.email,
      userName: params.userName,
      ticker: params.ticker,
      companyName: params.companyName,
      companyLogoUrl: params.companyLogoUrl,
    });
  }

  // Usuário premium: enviar relatório completo
  const template = generateNotificationEmailTemplate(
    `Gatilho Customizado Disparado: ${params.ticker}`,
    `Um gatilho customizado foi disparado para ${params.companyName} (${params.ticker}).\n\n${params.reportSummary}`,
    params.reportUrl,
    params.userName,
    'Ver Relatório Completo',
    params.companyLogoUrl || undefined
  );
  
  return await sendEmail({
    to: params.email,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
}

/**
 * Envia email de conversão para relatório de gatilho customizado (usuários não premium)
 * Não mostra detalhes do relatório, apenas incentiva upgrade
 */
export async function sendCustomTriggerConversionEmail(params: {
  email: string;
  userName: string;
  ticker: string;
  companyName: string;
  companyLogoUrl?: string | null;
}) {
  // Converter URLs SVG para formato compatível com email usando wsrv.nl (PNG)
  const getEmailCompatibleImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    const baseUrl = getEmailBaseUrl();
    
    // Se for uma URL da brapi.dev (SVG), usar wsrv.nl para converter para PNG
    if (url.includes('icons.brapi.dev') && url.endsWith('.svg')) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=128&h=128&output=png&default=https://via.placeholder.com/128x128/8b5cf6/ffffff?text=${params.ticker}`;
    }
    
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    
    return url;
  };
  
  const emailCompatibleLogoUrl = getEmailCompatibleImageUrl(params.companyLogoUrl);

  const template = await generateFreeUserAssetChangeEmailTemplate({
    userName: params.userName,
    ticker: params.ticker,
    companyName: params.companyName,
    companyLogoUrl: emailCompatibleLogoUrl,
  });

  // Ajustar assunto para custom trigger
  const subject = `Gatilho Customizado Disparado: ${params.ticker} - Veja os detalhes completos`;

  return await sendEmail({
    to: params.email,
    subject,
    html: template.html,
    text: template.text
  });
}

/**
 * Template de email de boas-vindas para usuários do Kiwify
 * Inclui link para configurar senha no primeiro acesso
 */
export function generateKiwifyWelcomeEmailTemplate(resetUrl: string, userName?: string) {
  const baseUrl = getEmailBaseUrl()
  const logoUrl = getEmailLogoUrl()
  
  return {
    subject: 'Bem-vindo ao Preço Justo AI Premium! Configure sua senha',
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao Preço Justo AI Premium</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
            min-height: 100vh;
          }
          
          .email-wrapper {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .container {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
          }
          
          .header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            padding: 40px 30px;
            text-align: center;
          }
          
          .logo-container {
            margin-bottom: 20px;
            text-align: center;
          }
          
          .logo {
            max-width: 180px;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          
          .header-title {
            color: #ffffff;
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 8px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .header-subtitle {
            color: rgba(255, 255, 255, 0.9);
            font-size: 18px;
            font-weight: 400;
          }
          
          .content {
            padding: 40px 30px;
          }
          
          .greeting {
            font-size: 20px;
            color: #0f172a;
            margin-bottom: 20px;
            font-weight: 600;
          }
          
          .main-text {
            font-size: 16px;
            color: #475569;
            margin-bottom: 30px;
            line-height: 1.8;
          }
          
          .premium-badge {
            display: inline-block;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: #ffffff;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 20px;
          }
          
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          
          .button {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: #ffffff;
            padding: 16px 40px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          }
          
          .info-box {
            background-color: #f8fafc;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin: 30px 0;
            border-radius: 8px;
          }
          
          .info-title {
            color: #1e40af;
            font-weight: 600;
            margin-bottom: 10px;
            font-size: 16px;
          }
          
          .info-text {
            color: #475569;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .features-list {
            list-style: none;
            margin: 20px 0;
            padding: 0;
          }
          
          .features-list li {
            padding: 12px 0;
            border-bottom: 1px solid #e2e8f0;
            color: #475569;
            font-size: 15px;
          }
          
          .features-list li:last-child {
            border-bottom: none;
          }
          
          .features-list li::before {
            content: "✓ ";
            color: #10b981;
            font-weight: bold;
            margin-right: 8px;
          }
          
          .footer {
            background-color: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 10px;
          }
          
          .footer-link {
            color: #3b82f6;
            text-decoration: none;
          }
          
          .footer-link:hover {
            text-decoration: underline;
          }
          
          @media only screen and (max-width: 600px) {
            .email-wrapper {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .header-title {
              font-size: 28px;
            }
            
            .button {
              padding: 14px 32px;
              font-size: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" />
              </div>
              <h1 class="header-title">🎉 Bem-vindo!</h1>
              <p class="header-subtitle">Sua assinatura Premium foi ativada</p>
            </div>
            
            <div class="content">
              <p class="greeting">
                ${userName ? `Olá, <strong>${userName}</strong>!` : 'Olá!'}
              </p>
              
              <div class="premium-badge">✨ Premium Ativo</div>
              
              <p class="main-text">
                Parabéns! Sua assinatura <strong>Premium</strong> foi ativada com sucesso. 
                Agora você tem acesso completo a todas as ferramentas profissionais de análise fundamentalista.
              </p>
              
              <div class="info-box">
                <div class="info-title">🔐 Primeiro acesso</div>
                <div class="info-text">
                  Para começar a usar a plataforma, você precisa configurar sua senha. 
                  Clique no botão abaixo para criar sua senha de acesso.
                </div>
              </div>
              
              <div class="button-container">
                <a href="${resetUrl}" class="button">Configurar Minha Senha</a>
              </div>
              
              <p class="main-text" style="margin-top: 30px;">
                <strong>O que você tem acesso agora:</strong>
              </p>
              
              <ul class="features-list">
                <li>8 Modelos de Valuation Premium (Graham, Fórmula Mágica, DCF, etc.)</li>
                <li>Análise com Inteligência Artificial</li>
                <li>Comparador Avançado (até 10 ações lado a lado)</li>
                <li>Backtesting de estratégias</li>
                <li>Relatórios mensais automatizados</li>
                <li>Suporte VIP prioritário</li>
              </ul>
              
              <div class="info-box" style="border-left-color: #10b981; margin-top: 30px;">
                <div class="info-title" style="color: #059669;">💡 Dica</div>
                <div class="info-text">
                  O link de configuração de senha expira em 7 dias. 
                  Se você não configurar agora, pode solicitar um novo link a qualquer momento.
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Precisa de ajuda? Nossa equipe está sempre disponível!
              </p>
              <p class="footer-text">
                Entre em contato conosco em 
                <a href="mailto:suporte@precojusto.ai" class="footer-link">suporte@precojusto.ai</a>
              </p>
              <p class="footer-text" style="margin-top: 20px;">
                <a href="${baseUrl}" class="footer-link">Preço Justo AI</a> - Análise fundamentalista inteligente
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
🎉 Bem-vindo ao Preço Justo AI Premium!

${userName ? `Olá, ${userName}!` : 'Olá!'}

Parabéns! Sua assinatura Premium foi ativada com sucesso. 
Agora você tem acesso completo a todas as ferramentas profissionais de análise fundamentalista.

🔐 PRIMEIRO ACESSO
Para começar a usar a plataforma, você precisa configurar sua senha. 
Acesse o link abaixo para criar sua senha de acesso:

${resetUrl}

O link expira em 7 dias. Se você não configurar agora, pode solicitar um novo link a qualquer momento.

✨ O QUE VOCÊ TEM ACESSO AGORA:
✓ 8 Modelos de Valuation Premium (Graham, Fórmula Mágica, DCF, etc.)
✓ Análise com Inteligência Artificial
✓ Comparador Avançado (até 10 ações lado a lado)
✓ Backtesting de estratégias
✓ Relatórios mensais automatizados
✓ Suporte VIP prioritário

Precisa de ajuda? Entre em contato conosco em suporte@precojusto.ai

Preço Justo AI - Análise fundamentalista inteligente
${baseUrl}
    `
  }
}

/**
 * Envia email de boas-vindas para usuários do Kiwify
 */
export async function sendKiwifyWelcomeEmail(
  email: string,
  resetUrl: string,
  userName?: string
) {
  const template = generateKiwifyWelcomeEmailTemplate(resetUrl, userName)
  
  return await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  })
}
