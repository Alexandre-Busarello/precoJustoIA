# FEATURES.md - Documentação Completa de Features

## Visão Geral
Preço Justo AI é uma plataforma SaaS completa de análise fundamentalista de ações da B3 com inteligência artificial, oferecendo desde análises básicas gratuitas até recursos avançados premium.

---

## 🎯 MODELOS DE VALUATION (8 Modelos)

### 1. Fórmula de Graham (Gratuito)
- **Descrição**: Método clássico de Benjamin Graham
- **Fórmula**: Preço Justo = √(22.5 × LPA × VPA)
- **Filtros de Qualidade**: ROE ≥ 10%, Liquidez ≥ 1.0, Margem Líquida > 0%, Dívida/PL ≤ 150%
- **Disponível**: Plano Gratuito
- **Features**: Rankings até 10 empresas, análise básica

### 2. Anti-Dividend Trap (Premium)
- **Descrição**: Estratégia focada em renda passiva sustentável
- **Filtros Anti-Trap**: ROE ≥ 10%, LC ≥ 1.2, P/L entre 4-25, Margem Líquida ≥ 5%, Market Cap ≥ R$ 1B
- **Disponível**: Premium
- **Features**: Evita dividend traps, análise de sustentabilidade

### 3. Fórmula Mágica de Greenblatt (Premium)
- **Descrição**: Combina Earnings Yield + ROIC
- **Metodologia**: Ranking combinado de empresas baratas e de qualidade
- **Disponível**: Premium
- **Features**: Filtros extras de qualidade, rebalanceamento anual

### 4. Fundamentalista 3+1 (Premium)
- **Descrição**: Análise simplificada adaptativa
- **Metodologia Adaptativa**:
  - Empresas SEM Dívida: ROE + P/L vs Crescimento + Endividamento
  - Empresas COM Dívida: ROIC + EV/EBITDA + Endividamento
  - Bancos/Seguradoras: ROE + P/L (endividamento não aplicável)
- **Bônus**: Análise de dividendos
- **Disponível**: Premium

### 5. Fluxo de Caixa Descontado - FCD (Premium)
- **Descrição**: Método mais preciso de valuation
- **Features**: Projeção de fluxos (5-10 anos), WACC, valor terminal, análise de sensibilidade
- **Disponível**: Premium

### 6. Fórmula de Gordon - DDM (Premium)
- **Descrição**: Modelo de Desconto de Dividendos
- **Fórmula**: Valor = D₁ ÷ (r - g)
- **Features**: Ideal para empresas pagadoras de dividendos
- **Disponível**: Premium

### 7. Low P/E Strategy (Premium)
- **Descrição**: P/L baixo + qualidade operacional
- **Critérios**: P/L entre 3-15, ROE ≥ 15%, ROA ≥ 5%, Liquidez ≥ 1.0
- **Disponível**: Premium

### 8. Análise Preditiva com IA (Premium)
- **Descrição**: Google Gemini AI analisando todos os 7 modelos simultaneamente
- **Features**: 
  - Análise de demonstrações financeiras
  - Busca de notícias na internet
  - Contexto macroeconômico
  - Ranking preditivo personalizado
  - Insights qualitativos
- **Disponível**: Premium
- **Diferencial**: Único no mercado brasileiro

---

## 📊 FERRAMENTAS DE ANÁLISE

### Ranking Rápido (Quick Ranker)
- **Descrição**: Ferramenta interativa na homepage
- **Features**: 
  - Seleção de modelo de valuation
  - Configuração de parâmetros (sliders/inputs)
  - Geração instantânea de rankings
  - Visualização de até 10 empresas (gratuito) ou ilimitado (premium)
- **Disponível**: Gratuito (Graham) + Premium (todos os modelos)

### Rankings Avançados (/ranking)
- **Descrição**: Página completa de rankings
- **Features**:
  - Todos os 8 modelos disponíveis
  - Filtros avançados por setor, tamanho de empresa
  - Histórico de rankings salvos
  - Exportação de resultados
  - Comparação lado a lado
- **Disponível**: Gratuito (limitado) + Premium (completo)

### Screening de Ações (/screening-acoes)
- **Descrição**: Filtros customizáveis avançados
- **Features**:
  - Filtros por categoria:
    - Valuation (P/L, P/VP, EV/EBITDA, PSR)
    - Rentabilidade (ROE, ROIC, ROA)
    - Crescimento (CAGR Lucros/Receitas 5 anos)
    - Dividendos (DY, Payout)
    - Endividamento (Dívida Líquida/PL, Dívida/EBITDA)
    - Liquidez (Liquidez Corrente)
    - Market Cap
  - Filtro por tamanho de empresa (Small/Mid/Large Caps)
  - Assistente com IA para gerar filtros
  - Suporte para ações B3 e BDRs
  - Análise técnica opcional
- **Disponível**: Premium

### Comparador de Ações (/comparador)
- **Descrição**: Compare até 6 ações lado a lado
- **Features**:
  - +25 indicadores fundamentalistas
  - Indicadores Básicos (Gratuito):
    - P/L, P/VP, ROE, Dividend Yield, Valor de Mercado, Receita
  - Indicadores Premium:
    - Margem Líquida, ROIC, CAGR Lucros/Receitas
    - Médias históricas de 7 anos
    - Rankings com medalhas
  - Comparações populares pré-configuradas
  - Busca inteligente por ticker ou nome
- **Disponível**: Gratuito (básico) + Premium (completo)

### Análise Setorial (/analise-setorial)
- **Descrição**: Compare empresas por setor
- **Features**:
  - Análise de 25+ setores da B3
  - Melhores empresas de cada setor
  - Comparação lado a lado dentro do setor
  - Indicadores setoriais agregados
  - Identificação de líderes setoriais
- **Disponível**: Premium

### Radar de Oportunidades (/radar)
- **Descrição**: Visão consolidada e visual de oportunidades
- **Features**:
  - Visualização em grid/radar
  - Filtros por múltiplos critérios
  - Identificação rápida de oportunidades
- **Disponível**: Premium

### Radar de Dividendos (/radar-dividendos)
- **Descrição**: Projeções de dividendos com IA
- **Features**:
  - Projeções dos próximos 12 meses
  - Calendário completo de proventos
  - Empresas pagadoras de altos dividendos
  - Análise de sustentabilidade de dividendos
  - Histórico de pagamentos
- **Disponível**: Gratuito (básico) + Premium (completo)

### Análise Individual de Ação (/acao/[ticker])
- **Descrição**: Página completa de análise por empresa
- **Features**:
  - Todos os 8 modelos aplicados
  - Score geral ponderado
  - Indicadores fundamentalistas completos (65+)
  - Histórico de preços (5+ anos)
  - Análise com IA (premium)
  - Análise técnica (premium)
  - Relatórios em PDF (premium)
  - Comparação com setor
  - Gráficos interativos
- **Disponível**: Gratuito (limitado) + Premium (completo)

---

## 💼 GESTÃO DE CARTEIRAS

### Carteiras (/carteira)
- **Descrição**: Sistema completo de gestão de carteiras
- **Features**:
  - Múltiplas carteiras por usuário
  - Configuração de alocação de ativos (%)
  - Acompanhamento de transações:
    - Compra, Venda, Dividendos, JCP, Bonificação, Desdobramento, Grupamento
  - Métricas de performance:
    - Retorno total, Retorno percentual
    - Sharpe Ratio, Drawdown Máximo
    - Performance por ativo
    - Evolução temporal
  - Integração com Backtest:
    - Converter backtest → carteira
    - Gerar backtest ← carteira
  - Sugestões de transações com IA
  - Confirmação/rejeição de transações
  - Histórico completo de transações
- **Disponível**: Premium

---

## 📈 BACKTESTING

### Backtesting de Carteiras (/backtest)
- **Descrição**: Simulação de desempenho histórico
- **Features**:
  - Configuração de carteira inicial
  - Aportes mensais configuráveis
  - Rebalanceamento automático
  - Período histórico configurável
  - Métricas avançadas:
    - Sharpe Ratio
    - Drawdown Máximo
    - Volatilidade
    - Retorno anualizado
    - Comparação com benchmark (IBOV)
  - Visualização gráfica de performance
  - Exportação de resultados
  - Múltiplas configurações salvas
- **Disponível**: Premium

---

## 📚 CONTEÚDO E EDUCAÇÃO

### Blog (/blog)
- **Descrição**: Artigos educativos sobre análise fundamentalista
- **Features**:
  - Categorias: Educação, Estratégias, Renda Passiva, Tecnologia, Análise Setorial
  - Sistema de markdown completo
  - Busca e filtros por categoria
  - Posts em destaque
  - Tempo de leitura estimado
  - SEO otimizado
- **Disponível**: Público

### Metodologia (/metodologia)
- **Descrição**: Documentação completa das metodologias
- **Features**:
  - Explicação detalhada de cada modelo
  - Fórmulas matemáticas
  - Critérios e filtros
  - Exemplos práticos
  - Base científica e acadêmica
- **Disponível**: Público

### Calculadoras (/calculadoras/dividend-yield)
- **Descrição**: Ferramentas de cálculo
- **Features**:
  - Calculadora de Dividend Yield
  - Outras calculadoras financeiras
- **Disponível**: Público

---

## 📊 DADOS E INDICADORES

### Cobertura de Dados
- **Total de Empresas**: +350 empresas da B3
- **Indicadores por Empresa**: 65 indicadores fundamentalistas
- **Cobertura Típica**: 62/65 indicadores (95%)
- **Módulos da API**: summaryProfile, defaultKeyStatistics, financialData, balanceSheetHistory
- **Dividendos Históricos**: Até 63+ dividendos por empresa
- **Indicadores Calculados**: 8 indicadores proprietários (PSR, P/Ativos, ROIC, Dívida Líquida/PL, etc.)

### Frequência de Atualização
- **Cotações**: 3x ao dia (09:00, 13:00, 20:00)
- **Dados Fundamentalistas**: Trimestralmente após divulgação

### Fontes de Dados
- **BRAPI**: Dados oficiais da B3
- **Yahoo Finance**: Dados complementares
- **Demonstrações Financeiras**: Auditadas e consolidadas

---

## 🎨 INTERFACE E EXPERIÊNCIA

### Design System
- **Framework**: Next.js 15 + TypeScript
- **UI Components**: shadcn/ui
- **Estilização**: Tailwind CSS
- **Responsividade**: Mobile-first
- **Tema**: Dark mode suportado

### Navegação
- **Menu Desktop**: Header fixo com navegação completa
- **Menu Mobile**: Menu hambúrguer responsivo
- **Breadcrumbs**: Navegação contextual
- **Busca Global**: Busca inteligente de empresas

### Onboarding
- **Tutorial Interativo**: Para novos usuários
- **Dicas Contextuais**: Durante o uso
- **Guia de Primeiros Passos**: No dashboard

---

## 🔐 AUTENTICAÇÃO E SEGURANÇA

### Métodos de Autenticação
- **Email/Senha**: Credenciais com bcrypt
- **Google OAuth**: Login social
- **Verificação de Email**: Obrigatória
- **Recuperação de Senha**: Via email

### Segurança
- **HTTPS**: Forçado em produção
- **Rate Limiting**: Proteção contra abuso
- **Validação de Dados**: Server-side e client-side
- **LGPD**: Conformidade completa

---

## 💰 PLANOS E PREÇOS

### Plano Gratuito (Forever Free)
- **Preço**: R$ 0/mês
- **Features**:
  - Fórmula de Graham completa
  - Análise de 350+ empresas
  - Rankings básicos (até 10 empresas)
  - Dados fundamentalistas essenciais
  - Comparador básico (limitado)
  - Radar de Dividendos básico
  - Blog e conteúdo educativo
  - Histórico de rankings salvos

### Plano Premium Mensal
- **Preço**: R$ 19,90/mês
- **Features**:
  - Tudo do plano gratuito
  - 8 modelos de valuation completos
  - Análise com IA (Gemini)
  - Comparador ilimitado (até 6 empresas)
  - Rankings personalizáveis ilimitados
  - Análise individual completa
  - Screening de ações
  - Análise setorial
  - Radar de oportunidades
  - Radar de dividendos completo
  - Dados históricos de 5+ anos
  - Backtesting de carteiras
  - Gestão de carteiras
  - Análise técnica
  - Relatórios em PDF
  - Suporte prioritário
  - Sem anúncios

### Plano Premium Anual
- **Preço**: R$ 189,90/ano (20% desconto)
- **Features**:
  - Tudo do Premium Mensal
  - 20% de desconto
  - Acesso antecipado a novos recursos
  - Relatórios mensais personalizados por IA
  - Suporte VIP

---

## 🛠️ FERRAMENTAS ADMINISTRATIVAS

### Painel Admin (/admin)
- **Descrição**: Área administrativa completa
- **Features**:
  - Analytics de usuários
  - Gerenciamento de blog posts
  - Monitor de cache
  - Central de tickets de suporte
  - Estatísticas da plataforma
  - Gerenciamento de usuários

### Central de Tickets (/suporte)
- **Descrição**: Sistema de suporte premium
- **Features**:
  - Criação de tickets
  - Categorias: Geral, Técnico, Faturamento, Feature Request, Bug Report, Conta
  - Prioridades: Baixa, Média, Alta, Urgente
  - Histórico de conversas
  - Status tracking
  - Limite de 5 tickets abertos simultaneamente (Premium)
- **Disponível**: Premium

---

## 📱 INTEGRAÇÕES E APIs

### APIs Internas
- **Rank Builder** (`/api/rank-builder`): Geração de rankings
- **Company Analysis** (`/api/company-analysis/[ticker]`): Análise individual
- **Portfolio APIs**: Gestão completa de carteiras
- **Backtest APIs**: Simulação de carteiras
- **Sector Analysis**: Análise setorial
- **Dividend Radar**: Projeções de dividendos

### Integrações Externas
- **BRAPI**: Dados de mercado
- **Google Gemini**: Análise com IA
- **Stripe**: Pagamentos
- **NextAuth**: Autenticação

---

## 🎯 FEATURES ESPECIAIS

### Análise Técnica
- **Descrição**: Complemento à análise fundamentalista
- **Features**: Gráficos, indicadores técnicos, suporte/resistência
- **Disponível**: Premium

### P/L Histórico da Bolsa (/pl-bolsa)
- **Descrição**: Evolução do P/L agregado da Bovespa
- **Features**: Gráficos históricos desde 2010, filtros avançados
- **Disponível**: Público

### Comparações Pré-configuradas
- **Descrição**: Comparações populares prontas
- **Exemplos**: Bancos (ITUB4, BBDC4, BBAS3), Petróleo (PETR4, PETR3, PRIO3), Varejo (MGLU3, LREN3, BHIA3)
- **Disponível**: Público

### Histórico de Rankings
- **Descrição**: Salvamento e histórico de análises
- **Features**: Rankings salvos, comparação temporal, evolução de empresas
- **Disponível**: Gratuito (limitado) + Premium (completo)

---

## 📈 MÉTRICAS E ANALYTICS

### Dashboard do Usuário (/dashboard)
- **Descrição**: Visão geral da conta e atividades
- **Features**:
  - Estatísticas de uso
  - Rankings recentes
  - Carteiras ativas
  - Backtests salvos
  - Atividade recente
  - Informações da conta
  - Links rápidos para ferramentas

### Analytics da Plataforma
- **Descrição**: Métricas agregadas
- **Features**: Total de análises, empresas analisadas, rankings gerados

---

## 🔄 FUNCIONALIDADES TÉCNICAS

### Cache Inteligente
- **Descrição**: Sistema de cache otimizado
- **Features**: Cache por tabela, invalidação inteligente, deduplicação de queries

### Performance
- **SSR**: Server-side rendering para SEO
- **ISR**: Incremental Static Regeneration
- **Otimização de Imagens**: Next.js Image
- **Code Splitting**: Automático

### SEO
- **Metadata**: Completo em todas as páginas
- **Structured Data**: Schema.org markup
- **Sitemap**: Automático e dinâmico
- **Robots.txt**: Configurado
- **Open Graph**: Tags completas
- **Twitter Cards**: Suportado

---

## 📝 DOCUMENTAÇÃO E SUPORTE

### Documentação Técnica
- **README.md**: Visão geral do projeto
- **docs/**: Documentação completa de features
- **Comentários no Código**: TypeScript com JSDoc

### Suporte ao Usuário
- **Central de Tickets**: Sistema completo
- **FAQ**: Perguntas frequentes
- **Blog Educativo**: Artigos e tutoriais
- **Contato**: Página de contato

---

## 🚀 ROADMAP E FEATURES FUTURAS

### Planejado
- **API Pública**: Para desenvolvedores
- **Relatórios Personalizados**: Em PDF avançados
- **White-label**: Opções para empresas
- **Múltiplos Usuários**: Até 5 usuários por conta
- **Integração com Planilhas**: Excel/Google Sheets
- **Alertas de Preço**: Notificações personalizadas
- **App Mobile**: iOS e Android

---

## 📊 RESUMO POR CATEGORIA

### Análise Fundamentalista
- ✅ 8 modelos de valuation
- ✅ +350 empresas analisadas
- ✅ 65 indicadores por empresa
- ✅ Análise com IA
- ✅ Rankings personalizáveis

### Ferramentas de Investimento
- ✅ Comparador de ações
- ✅ Screening avançado
- ✅ Análise setorial
- ✅ Radar de oportunidades
- ✅ Radar de dividendos

### Gestão de Portfólio
- ✅ Carteiras múltiplas
- ✅ Acompanhamento de transações
- ✅ Métricas de performance
- ✅ Backtesting histórico

### Educação e Conteúdo
- ✅ Blog educativo
- ✅ Metodologia documentada
- ✅ Calculadoras financeiras
- ✅ Tutoriais interativos

### Infraestrutura
- ✅ Autenticação segura
- ✅ Cache inteligente
- ✅ SEO otimizado
- ✅ Performance otimizada
- ✅ Responsivo mobile-first

---

**Última Atualização**: Dezembro 2024
**Versão da Plataforma**: 1.0
**Total de Features Documentadas**: 100+

