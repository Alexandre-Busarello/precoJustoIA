import nodemailer from 'nodemailer'

// Configuração do transporter
const createTransporter = () => {
  // Para desenvolvimento, usar Ethereal Email (teste)
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_HOST) {
    console.warn('⚠️ Usando configuração de email de desenvolvimento. Configure as variáveis de ambiente para produção.')
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

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    const transporter = createTransporter()
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Preço Justo AI'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      bcc: 'busamar@gmail.com', // Cópia oculta para monitoramento
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Remove HTML tags para versão texto
    }

    const info = await transporter.sendMail(mailOptions)
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email enviado:', info.messageId)
      console.log('🔗 Preview URL:', nodemailer.getTestMessageUrl(info))
    }
    
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }
  }
}

export function generatePasswordResetEmailTemplate(resetUrl: string, userName?: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://precojusto.ai'
  const logoUrl = `${baseUrl}/logo-preco-justo.png`
  
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
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
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
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
            opacity: 0.3;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 20px;
          }
          
          .logo {
            max-width: 200px;
            height: auto;
            filter: brightness(0) invert(1);
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
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
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
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 1px solid #f59e0b;
            border-radius: 12px;
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
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" />
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
                <a href="${resetUrl}" class="button">🔐 Redefinir Minha Senha</a>
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
                <a href="mailto:busamar@gmail.com" class="footer-link">busamar@gmail.com</a>
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

Precisa de ajuda? Entre em contato conosco em busamar@gmail.com

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
  const baseUrl = process.env.NEXTAUTH_URL || 'https://precojusto.ai'
  const logoUrl = `${baseUrl}/logo-preco-justo.png`
  
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
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
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
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
            opacity: 0.3;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 20px;
          }
          
          .logo {
            max-width: 200px;
            height: auto;
            filter: brightness(0) invert(1);
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
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
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
                <img src="${logoUrl}" alt="Preço Justo AI" class="logo" />
              </div>
              <h1 class="header-title">Problema com pagamento</h1>
              <p class="header-subtitle">Vamos resolver isso juntos</p>
            </div>
            
            <div class="content">
              <p class="greeting">
                ${userName ? `Olá, <strong>${userName}</strong>!` : 'Olá!'} 😊
              </p>
              
              <p class="main-text">
                Infelizmente, não conseguimos processar o pagamento da sua assinatura <strong>Early Adopter</strong> no <strong>Preço Justo AI</strong>. 
                Mas não se preocupe, isso é mais comum do que você imagina e tem solução fácil!
              </p>
              
              <div class="urgency-section" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 30px 0;">
                <div style="text-align: center; margin-bottom: 16px;">
                  <span style="font-size: 24px;">⏰</span>
                  <h3 style="color: #92400e; font-weight: 700; margin: 8px 0; font-size: 18px;">OFERTA LIMITADA - FASE ALFA</h3>
                </div>
                <div style="color: #92400e; font-size: 14px; line-height: 1.6; text-align: center;">
                  <p style="margin-bottom: 12px;"><strong>Você está perdendo:</strong></p>
                  <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="margin-bottom: 8px;">🔒 <strong>Preço congelado PARA SEMPRE</strong> (R$ 249/ano)</li>
                    <li style="margin-bottom: 8px;">💬 <strong>Canal exclusivo WhatsApp com CEO</strong></li>
                    <li style="margin-bottom: 8px;">🚀 <strong>Acesso antecipado</strong> a novos recursos</li>
                    <li style="margin-bottom: 8px;">👑 <strong>Badge especial Early Adopter</strong></li>
                    <li style="margin-bottom: 8px;">💰 <strong>Economia de R$ 248/ano</strong> (preço normal: R$ 497)</li>
                  </ul>
                  <p style="margin-top: 16px; font-weight: 600;">Esta oferta só existe durante a Fase Alfa e não voltará!</p>
                </div>
              </div>
              
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
                <a href="${retryUrl}" class="button">🔄 Tentar Novamente</a>
              </div>
              
              <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #0284c7; border-radius: 12px; padding: 24px; margin: 30px 0; text-align: center;">
                <h3 style="color: #0369a1; font-weight: 700; margin-bottom: 16px; font-size: 18px;">🎯 O que você terá acesso HOJE:</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; text-align: left;">
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #0369a1;">
                    <span>🤖</span> <strong>8 Modelos de Valuation Premium</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #0369a1;">
                    <span>🧠</span> <strong>Análise Preditiva com IA</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #0369a1;">
                    <span>📊</span> <strong>Rankings Ilimitados</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #0369a1;">
                    <span>🔍</span> <strong>Comparador Avançado</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #0369a1;">
                    <span>📈</span> <strong>Backtesting de Carteiras</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #0369a1;">
                    <span>📋</span> <strong>Relatórios Mensais por IA</strong>
                  </div>
                </div>
                <p style="color: #0369a1; font-weight: 600; margin: 0;">Tudo isso por apenas <span style="font-size: 20px; color: #dc2626;">R$ 249/ano</span> - preço congelado para sempre!</p>
              </div>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Se continuar com problemas, nossa equipe está aqui para ajudar!
              </p>
              <p class="footer-text">
                Entre em contato conosco em 
                <a href="mailto:busamar@gmail.com" class="footer-link">busamar@gmail.com</a>
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

Precisa de ajuda? Entre em contato conosco em busamar@gmail.com

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
  const baseUrl = process.env.NEXTAUTH_URL || 'https://precojusto.ai'
  const logoUrl = `${baseUrl}/logo-preco-justo.png`
  
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
            color: #1e293b;
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
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
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
            opacity: 0.3;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
            margin-bottom: 20px;
          }
          
          .logo {
            max-width: 200px;
            height: auto;
            filter: brightness(0) invert(1);
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
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
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
          
          .features-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
          }
          
          .feature-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
          }
          
          .feature-icon {
            font-size: 32px;
            margin-bottom: 12px;
            display: block;
          }
          
          .feature-title {
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
            font-size: 16px;
          }
          
          .feature-desc {
            color: #64748b;
            font-size: 14px;
            line-height: 1.5;
          }
          
          .cta-section {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 2px solid #0284c7;
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
            text-align: center;
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
            
            .features-grid {
              grid-template-columns: 1fr;
              gap: 16px;
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
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
                <h3 style="color: #92400e; font-weight: 700; margin-bottom: 12px; font-size: 18px;">👑 Parabéns, Early Adopter!</h3>
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                  Você garantiu o <strong>preço congelado para sempre</strong> e faz parte do grupo exclusivo que está moldando o futuro da plataforma!
                </p>
              </div>
              ` : ''}
              
              <div class="cta-section">
                <h3 style="color: #0369a1; font-weight: 700; margin-bottom: 16px; font-size: 18px;">🎯 Comece agora mesmo:</h3>
                <div class="button-container">
                  <a href="${baseUrl}/dashboard" class="button">🚀 Acessar Dashboard</a>
                </div>
              </div>
              
              <div class="features-grid">
                <div class="feature-card">
                  <span class="feature-icon">🤖</span>
                  <div class="feature-title">Análise com IA</div>
                  <div class="feature-desc">
                    Use nossa IA para análises preditivas avançadas
                    <br><a href="${baseUrl}/ranking" style="color: #3b82f6; text-decoration: none; font-weight: 500;">→ Criar Ranking</a>
                  </div>
                </div>
                
                <div class="feature-card">
                  <span class="feature-icon">📊</span>
                  <div class="feature-title">8 Modelos Premium</div>
                  <div class="feature-desc">
                    Graham, Fórmula Mágica, DCF e muito mais
                    <br><a href="${baseUrl}/ranking" style="color: #3b82f6; text-decoration: none; font-weight: 500;">→ Explorar Modelos</a>
                  </div>
                </div>
                
                <div class="feature-card">
                  <span class="feature-icon">🔍</span>
                  <div class="feature-title">Comparador Avançado</div>
                  <div class="feature-desc">
                    Compare até 10 ações lado a lado
                    <br><a href="${baseUrl}/compara-acoes" style="color: #3b82f6; text-decoration: none; font-weight: 500;">→ Comparar Ações</a>
                  </div>
                </div>
                
                <div class="feature-card">
                  <span class="feature-icon">📈</span>
                  <div class="feature-title">Backtesting</div>
                  <div class="feature-desc">
                    Teste suas estratégias com dados históricos
                    <br><a href="${baseUrl}/backtest" style="color: #3b82f6; text-decoration: none; font-weight: 500;">→ Fazer Backtest</a>
                  </div>
                </div>
                
                <div class="feature-card">
                  <span class="feature-icon">📋</span>
                  <div class="feature-title">Análise Individual</div>
                  <div class="feature-desc">
                    Análise completa de qualquer ação
                    <br><a href="${baseUrl}/" style="color: #3b82f6; text-decoration: none; font-weight: 500;">→ Analisar Ação</a>
                  </div>
                </div>
                
                <div class="feature-card">
                  <span class="feature-icon">🎯</span>
                  <div class="feature-title">Suporte VIP</div>
                  <div class="feature-desc">
                    Atendimento prioritário e especializado
                    <br><a href="${baseUrl}/suporte" style="color: #3b82f6; text-decoration: none; font-weight: 500;">→ Central de Suporte</a>
                  </div>
                </div>
              </div>
              
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 30px 0;">
                <h3 style="color: #1e293b; font-weight: 700; margin-bottom: 12px; font-size: 16px;">💡 Dicas para começar:</h3>
                <ul style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">Comece criando um <strong>ranking com IA</strong> para descobrir as melhores oportunidades</li>
                  <li style="margin-bottom: 8px;">Use o <strong>comparador</strong> para analisar suas ações favoritas lado a lado</li>
                  <li style="margin-bottom: 8px;">Teste suas estratégias com o <strong>backtesting</strong> antes de investir</li>
                  <li style="margin-bottom: 8px;">Explore os <strong>8 modelos de valuation</strong> para diferentes perfis de investimento</li>
                </ul>
              </div>
              
              ${isEarlyAdopter ? `
              <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); border: 2px solid #8b5cf6; border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
                <h3 style="color: #7c3aed; font-weight: 700; margin-bottom: 12px; font-size: 16px;">💬 Canal Exclusivo WhatsApp</h3>
                <p style="color: #7c3aed; font-size: 14px; margin-bottom: 16px;">
                  Como Early Adopter, você tem acesso direto ao CEO! Em breve você receberá o convite para o grupo exclusivo.
                </p>
                <p style="color: #7c3aed; font-size: 12px; margin: 0; font-style: italic;">
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
                <a href="mailto:busamar@gmail.com" class="footer-link">busamar@gmail.com</a>
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

${isEarlyAdopter ? '👑 Parabéns, Early Adopter! Você garantiu o preço congelado para sempre!' : ''}

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

Precisa de ajuda? Entre em contato conosco em busamar@gmail.com

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
