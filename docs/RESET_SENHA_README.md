# 🔐 Sistema de Reset de Senha

Sistema completo de redefinição de senha com envio por email implementado no Preço Justo AI.

## 📋 Funcionalidades Implementadas

### ✅ Componentes Criados

1. **Modelo de Dados** (`PasswordResetToken`)
   - Tokens seguros com expiração
   - Controle de uso único
   - Indexação para performance

2. **Serviço de Email** (`email-service.ts`)
   - Configuração flexível (desenvolvimento/produção)
   - Template HTML responsivo
   - Fallback para modo texto

3. **API Endpoints**
   - `POST /api/auth/forgot-password` - Solicitar reset
   - `POST /api/auth/reset-password` - Confirmar reset
   - `GET /api/auth/reset-password` - Validar token

4. **Páginas de Interface**
   - `/esqueci-senha` - Solicitar reset
   - `/redefinir-senha` - Confirmar nova senha
   - Link integrado na página de login

## 🚀 Como Usar

### 1. Configurar Variáveis de Ambiente

Adicione as seguintes variáveis no seu arquivo `.env`:

```env
# Email Configuration (for password reset)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
EMAIL_FROM="your-email@gmail.com"
EMAIL_FROM_NAME="Preço Justo AI"
```

### 2. Configurar Gmail (Recomendado)

Para usar Gmail como provedor de email:

1. **Ativar 2FA** na sua conta Google
2. **Gerar App Password**:
   - Acesse [myaccount.google.com](https://myaccount.google.com)
   - Vá em "Segurança" > "Verificação em duas etapas"
   - Role até "Senhas de app"
   - Gere uma senha para "Email"
3. **Usar a App Password** na variável `EMAIL_PASS`

### 3. Outros Provedores de Email

#### Outlook/Hotmail
```env
EMAIL_HOST="smtp-mail.outlook.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
```

#### Yahoo
```env
EMAIL_HOST="smtp.mail.yahoo.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
```

#### SendGrid
```env
EMAIL_HOST="smtp.sendgrid.net"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="apikey"
EMAIL_PASS="your-sendgrid-api-key"
```

## 🔄 Fluxo de Funcionamento

### 1. Solicitação de Reset
1. Usuário acessa `/esqueci-senha`
2. Digita seu email e submete
3. Sistema verifica se email existe (sem revelar)
4. Gera token seguro com expiração de 1 hora
5. Envia email com link de reset
6. Mostra mensagem de sucesso (sempre)

### 2. Confirmação de Reset
1. Usuário clica no link do email
2. Sistema valida token (existência, expiração, uso)
3. Usuário define nova senha
4. Sistema atualiza senha e invalida token
5. Redireciona para login

## 🛡️ Recursos de Segurança

### Tokens Seguros
- **Geração**: `crypto.randomBytes(32)` (256 bits)
- **Expiração**: 1 hora após criação
- **Uso único**: Token invalidado após uso
- **Limpeza**: Tokens antigos invalidados automaticamente

### Proteções Implementadas
- **Rate limiting natural**: Tokens expiram rapidamente
- **Não revelação**: Sempre retorna sucesso (não revela emails válidos)
- **Validação robusta**: Múltiplas verificações de segurança
- **Hash seguro**: bcrypt com salt 12 para senhas

### Validações de Senha
- Mínimo 8 caracteres
- Pelo menos 1 letra minúscula
- Pelo menos 1 letra maiúscula
- Pelo menos 1 número

## 📧 Template de Email

### Características
- **Design moderno**: Alinhado com a identidade visual da landing page
- **Logo oficial**: Usa `/logo-preco-justo.png` com filtros apropriados
- **Gradientes consistentes**: Cores blue-to-violet matching o site
- **Tipografia profissional**: Sistema de fontes idêntico ao site
- **Design responsivo**: Funciona perfeitamente em todos os dispositivos
- **Micro-interações**: Botões com hover effects e shadows
- **Acessibilidade**: Alto contraste e estrutura semântica
- **Fallback texto**: Versão texto para clientes sem HTML

### Design System
- **Cores primárias**: `#3b82f6` (blue-500) e `#8b5cf6` (violet-500)
- **Gradientes**: `linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)`
- **Tipografia**: System fonts stack (-apple-system, BlinkMacSystemFont, etc.)
- **Border radius**: 12px-16px para consistência
- **Shadows**: Múltiplas camadas para profundidade
- **Grid pattern**: Background sutil no header

### Personalização
O template pode ser customizado editando a função `generatePasswordResetEmailTemplate()` em `email-service.ts`. 
Todas as cores e estilos estão centralizados no CSS inline para máxima compatibilidade.

## 🧪 Modo Desenvolvimento

Em desenvolvimento (sem configuração de email), o sistema:
- Usa Ethereal Email para testes
- Mostra URLs de preview no console
- Não envia emails reais
- Mantém toda funcionalidade

## 📊 Monitoramento

### Logs Implementados
- ✅ Solicitações de reset (com email mascarado)
- ✅ Emails enviados com sucesso
- ❌ Erros de envio de email
- ❌ Tentativas com tokens inválidos
- ✅ Senhas redefinidas com sucesso

### Métricas Sugeridas
- Taxa de abertura de emails
- Taxa de conclusão do reset
- Tentativas com tokens expirados
- Emails não encontrados

## 🔧 Manutenção

### Limpeza de Tokens
Considere implementar um job para limpar tokens expirados:

```sql
DELETE FROM password_reset_tokens 
WHERE expires < NOW() OR used = true;
```

### Backup de Segurança
- Tokens não contêm informações sensíveis
- Podem ser excluídos sem impacto
- Senhas são hasheadas com bcrypt

## 🚨 Troubleshooting

### Email não chega
1. Verificar configurações SMTP
2. Verificar pasta de spam
3. Verificar logs do servidor
4. Testar com Ethereal Email

### Token inválido
1. Verificar se não expirou (1 hora)
2. Verificar se não foi usado
3. Verificar URL completa
4. Solicitar novo reset

### Erro de senha
1. Verificar critérios de validação
2. Confirmar que senhas coincidem
3. Verificar caracteres especiais

## 📝 Próximos Passos

### Melhorias Sugeridas
- [ ] Rate limiting por IP
- [ ] Histórico de resets por usuário
- [ ] Notificação de mudança de senha
- [ ] Integração com auditoria de segurança
- [ ] Template de email customizável via admin

### Integrações Futuras
- [ ] SMS como alternativa ao email
- [ ] Integração com serviços de email transacional
- [ ] Métricas avançadas de segurança
- [ ] Alertas de tentativas suspeitas

---

## 📞 Suporte

Para dúvidas sobre implementação ou configuração:
- 📧 Email: suporte@precojusto.ai
- 📱 WhatsApp: Disponível na plataforma
- 🎫 Sistema de tickets: Integrado na aplicação

**Status**: ✅ Implementado e funcional
**Versão**: 1.0.0
**Data**: Janeiro 2025
