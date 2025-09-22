# Central de Tickets - Sistema de Suporte Premium

## 📋 Visão Geral

Sistema completo de tickets de suporte integrado à plataforma Preço Justo AI, exclusivo para usuários Premium. Inclui interface para usuários e painel administrativo completo.

## 🚀 Funcionalidades

### Para Usuários Premium
- ✅ Central de Tickets acessível via `/suporte`
- ✅ Criação de tickets com categorias e prioridades
- ✅ Acompanhamento em tempo real do status
- ✅ Sistema de mensagens bidirecional
- ✅ Histórico completo de interações
- ✅ Interface responsiva e intuitiva

### Para Administradores
- ✅ Painel administrativo em `/admin/tickets`
- ✅ Visualização de todos os tickets
- ✅ Filtros avançados (status, prioridade, categoria, etc.)
- ✅ Sistema de atribuição de tickets
- ✅ Mensagens internas (apenas para admins)
- ✅ Controle completo de status e prioridades
- ✅ Estatísticas em tempo real

## 🔧 Configuração Inicial

### 1. Migração do Banco de Dados

```bash
# Aplicar as migrações do Prisma
npx prisma migrate dev
```

### 2. Criar Primeiro Administrador

```bash
# Tornar um usuário existente admin
node scripts/make-admin.js admin@precojusto.ai

# Listar administradores atuais
node scripts/make-admin.js --list
```

## 📁 Estrutura dos Arquivos

### Schema do Banco (Prisma)
```
prisma/schema.prisma
├── SupportTicket (modelo principal)
├── TicketMessage (mensagens)
└── User (campo isAdmin adicionado)
```

### API Endpoints
```
src/app/api/
├── tickets/
│   ├── route.ts (GET, POST)
│   └── [id]/
│       ├── route.ts (GET, PATCH)
│       └── messages/route.ts (GET, POST)
├── admin/
│   ├── tickets/route.ts (GET - todos os tickets)
│   ├── users/route.ts (GET - listar admins)
│   └── check/route.ts (GET - verificar se é admin)
```

### Componentes React
```
src/components/
├── support-center.tsx (Central principal)
├── create-ticket-dialog.tsx (Criação de tickets)
├── ticket-details-dialog.tsx (Detalhes para usuários)
├── admin-ticket-dashboard.tsx (Dashboard admin)
├── admin-ticket-details-dialog.tsx (Detalhes para admin)
└── admin-link.tsx (Link flutuante para admin)
```

### Páginas
```
src/app/
├── suporte/page.tsx (Central de Tickets)
└── admin/tickets/page.tsx (Painel Administrativo)
```

## 🔐 Controle de Acesso

### Usuários Premium
- Verificação automática via `hasValidPremiumAccess()`
- Redirecionamento para `/planos` se não for Premium
- Limite de 5 tickets abertos simultaneamente

### Administradores
- Campo `isAdmin` no modelo User
- Middleware protegendo rotas `/admin/*`
- Verificação dupla (middleware + API)
- Acesso completo a todos os tickets

## 🎯 Fluxo de Estados dos Tickets

```
OPEN → IN_PROGRESS → WAITING_USER ⟷ WAITING_ADMIN → RESOLVED → CLOSED
```

### Estados Disponíveis
- **OPEN**: Ticket recém-criado
- **IN_PROGRESS**: Admin trabalhando no ticket
- **WAITING_USER**: Aguardando resposta do usuário
- **WAITING_ADMIN**: Aguardando resposta do admin
- **RESOLVED**: Problema resolvido
- **CLOSED**: Ticket fechado definitivamente

## 📊 Categorias e Prioridades

### Categorias
- **GENERAL**: Dúvidas gerais
- **TECHNICAL**: Problemas técnicos
- **BILLING**: Questões de faturamento
- **FEATURE_REQUEST**: Solicitações de recursos
- **BUG_REPORT**: Relatórios de bugs
- **ACCOUNT**: Problemas de conta

### Prioridades
- **LOW**: Baixa prioridade
- **MEDIUM**: Prioridade média (padrão)
- **HIGH**: Alta prioridade
- **URGENT**: Urgente

## 🔄 Integração na Plataforma

### Navbar
- Link "Suporte" aparece apenas para usuários Premium
- Integração no header desktop e mobile

### Planos e Preços
- "Central de Suporte Premium" listada como benefício
- Ícone específico na tabela de comparação

### Layout Principal
- Componente `AdminLink` flutuante para administradores
- Aparece apenas quando o usuário é admin

## 🛠️ Comandos Úteis

```bash
# Verificar status de admin
node scripts/make-admin.js --list

# Tornar usuário admin
node scripts/make-admin.js usuario@email.com

# Verificar logs de desenvolvimento
npm run dev

# Aplicar migrações
npx prisma migrate dev

# Visualizar banco de dados
npx prisma studio
```

## 📱 Responsividade

- ✅ Interface totalmente responsiva
- ✅ Otimizada para mobile, tablet e desktop
- ✅ Navegação adaptativa
- ✅ Componentes fluidos

## 🔒 Segurança

### Validações
- Verificação de Premium em todas as rotas
- Validação de admin em endpoints administrativos
- Sanitização de inputs com Zod
- Limite de caracteres em mensagens

### Proteções
- Middleware protegendo rotas administrativas
- Verificação dupla de permissões
- Mensagens internas apenas para admins
- Logs de auditoria automáticos

## 📈 Monitoramento

### Métricas Disponíveis
- Total de tickets por status
- Tickets não atribuídos
- Tickets por prioridade
- Carga de trabalho por admin
- Tempo de resposta médio

### Estatísticas em Tempo Real
- Dashboard com contadores automáticos
- Filtros avançados para análise
- Exportação de dados (futuro)

## 🚨 Troubleshooting

### Problemas Comuns

1. **Usuário não consegue acessar suporte**
   - Verificar se tem assinatura Premium ativa
   - Checar `hasValidPremiumAccess()`

2. **Admin não consegue acessar painel**
   - Verificar campo `isAdmin` no banco
   - Usar script `make-admin.js`

3. **Tickets não aparecem**
   - Verificar conexão com banco
   - Checar logs da API

### Logs Importantes
```bash
# Logs de autenticação
console.log('Verificando acesso premium:', userId)

# Logs de admin
console.log('Usuário admin verificado:', isAdmin)

# Logs de tickets
console.log('Ticket criado:', ticketId)
```

## 🔮 Próximos Passos

### Melhorias Futuras
- [ ] Notificações por email
- [ ] Anexos em tickets
- [ ] Templates de resposta
- [ ] SLA e métricas avançadas
- [ ] Integração com chat
- [ ] API pública para integrações

### Otimizações
- [ ] Cache de consultas frequentes
- [ ] Paginação otimizada
- [ ] Busca full-text
- [ ] Exportação de relatórios

---

## 📞 Suporte

Para dúvidas sobre implementação ou uso do sistema, consulte:
- Documentação da API nos endpoints
- Comentários no código
- Logs de desenvolvimento
- Painel administrativo para monitoramento
