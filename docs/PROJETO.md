# Plano de Software: SaaS de Análise Fundamentalista de Ativos com IA

## 1. Visão Geral e Proposta de Valor

**Nome Provisório:** "Análise Fácil" ou "Investidor Inteligente"

**Elevator Pitch:** Uma plataforma SaaS que simplifica a análise fundamentalista de ações para investidores pessoa física. Utilizando modelos de valuation consagrados e o poder da IA (Gemini), o app oferece um ranking claro de empresas, explica o racional por trás das análises e permite a criação e teste de carteiras de investimento, tudo com uma experiência de usuário limpa e intuitiva.

**Proposta de Valor:**

* **Simplicidade:** Traduzir o complexo mundo do valuation em uma interface amigável e rankings fáceis de entender.
* **Inteligência Aumentada:** Usar o Gemini para enriquecer a análise, trazendo contexto de notícias e explicando os cálculos, agindo como um "copiloto" para o investidor.
* **Confiança:** Fornecer dados atualizados e permitir que o usuário teste suas teses de investimento através de backtests robustos.
* **Acessibilidade:** Modelo de negócio flexível (freemium + pagamento pontual via Pix) que remove a barreira de assinaturas caras e anuais.

## 2. Público-Alvo

* **Investidor Pessoa Física Iniciante a Intermediário:** Indivíduos que já entendem o básico de ações, mas se sentem perdidos com a quantidade de dados e a complexidade da análise fundamentalista. Buscam uma ferramenta que os guie e eduque.
* **Entusiastas do Mercado Financeiro:** Pessoas que gostam de estudar empresas, mas não têm tempo ou acesso a terminais de dados caros.

## 3. Arquitetura e Tecnologias Sugeridas

* **Frontend:**
    * **Framework:** Next.js (React) - Excelente para SEO, performance e estruturação de projetos modernos.
    * **Estilização:** Tailwind CSS - Para criar uma UI bonita e responsiva rapidamente.
    * **Componentes:** Shadcn/UI ou similar - Componentes de alta qualidade e acessíveis.
    * **Gráficos:** Recharts ou Chart.js - Para os gráficos de backtest e visualização de dados.
* **Backend:**
    * **Framework:** Node.js com Express.js ou NestJS - Ecossistema JavaScript/TypeScript robusto e popular.
    * **Autenticação:** NextAuth.js ou Clerk - Soluções completas para gerenciamento de usuários.
* **Banco de Dados:**
    * **Principal:** PostgreSQL (via Supabase ou Neon) - Robusto, relacional e ótimo para dados financeiros estruturados.
    * **Cache:** Redis (Opcional, для fases futuras) - Para armazenar em cache cotações e resultados de API, melhorando a performance.
* **APIs e Serviços Externos:**
    * **Dados de Mercado:**
        * **API:** [Brapi API](https://brapi.dev/) ou [Status Invest](https://statusinvest.com.br/) (verificar os termos de uso para aplicação comercial). Uma alternativa é buscar provedores de dados B2B como a [B3](https://www.b3.com.br/pt_br/market-data-e-indices/) para dados mais robustos no futuro.
        * **Atualização:** Criar um "worker" (processo em segundo plano) que consome a API de dados periodicamente (ex: a cada 1 hora para cotações, diariamente para fundamentos) e atualiza o seu banco de dados PostgreSQL.
    * **Inteligência Artificial:** API do Google Gemini.
    * **Pagamentos:** API do Mercado Pago, PagSeguro ou Asaas - Para geração de QR Code Pix e recebimento de webhooks de confirmação.

## 4. Estrutura de Dados (Modelo PostgreSQL)

### Modelo Expandido com Máxima Cobertura de Dados

* `users`:
    * `id` (UUID, PK)
    * `email` (TEXT, UNIQUE)
    * `subscription_tier` (ENUM: 'FREE', 'PREMIUM')
    * `premium_expires_at` (TIMESTAMP)

* `companies` _(EXPANDIDO - Dados Completos)_:
    * `id` (SERIAL, PK)
    * `ticker` (TEXT, UNIQUE)
    * `name` (TEXT)
    * `sector` (TEXT) -- Energy, Consumer Cyclical, etc.
    * `industry` (TEXT) -- Oil & Gas Integrated, etc.
    * `cnpj` (TEXT)
    * `description` (TEXT)
    * `website` (TEXT) -- Site oficial da empresa
    
    **Dados de Localização:**
    * `address` (TEXT) -- Endereço completo
    * `city` (TEXT) -- Cidade da sede
    * `state` (TEXT) -- Estado (RJ, SP, etc.)
    * `country` (TEXT) -- País
    
    **Dados Corporativos:**
    * `full_time_employees` (INTEGER) -- Número de funcionários
    * `logo_url` (TEXT) -- URL da logo da empresa
    * `updated_at` (TIMESTAMP) -- Última atualização

* `financial_data` _(EXPANDIDO - 65 Indicadores Financeiros)_:
    * `id` (SERIAL, PK)
    * `company_id` (FK to `companies`)
    * `report_date` (DATE) -- Data de referência dos dados
    
    **=== INDICADORES DE VALUATION (14 indicadores) ===**
    * `pl` (DECIMAL) -- P/L atual
    * `forward_pe` (DECIMAL) -- P/L projetado (Forward P/E)
    * `pvp` (DECIMAL) -- Preço/Valor Patrimonial
    * `dy` (DECIMAL) -- Dividend Yield percentual
    * `ev_ebitda` (DECIMAL) -- Enterprise Value/EBITDA
    * `ev_ebit` (DECIMAL) -- Enterprise Value/EBIT
    * `ev_revenue` (DECIMAL) -- Enterprise Value/Revenue
    * `psr` (DECIMAL) -- Price-to-Sales Ratio *(calculado)*
    * `p_ativos` (DECIMAL) -- Preço/Ativos *(calculado)*
    * `p_cap_giro` (DECIMAL) -- Preço/Capital de Giro *(calculado)*
    * `p_ebit` (DECIMAL) -- Preço/EBIT *(calculado)*
    * `lpa` (DECIMAL) -- Lucro por Ação
    * `trailing_eps` (DECIMAL) -- EPS trailing 12 meses
    * `vpa` (DECIMAL) -- Valor Patrimonial por Ação
    
    **=== DADOS DE MERCADO E AÇÕES (4 indicadores) ===**
    * `market_cap` (DECIMAL) -- Valor de Mercado (capitalização)
    * `enterprise_value` (DECIMAL) -- Enterprise Value
    * `shares_outstanding` (DECIMAL) -- Ações em Circulação
    * `total_assets` (DECIMAL) -- Ativos Totais
    
    **=== INDICADORES DE ENDIVIDAMENTO E LIQUIDEZ (6 indicadores) ===**
    * `divida_liquida_pl` (DECIMAL) -- Dívida Líquida/PL *(calculado)*
    * `divida_liquida_ebitda` (DECIMAL) -- Dívida Líquida/EBITDA *(calculado)*
    * `liquidez_corrente` (DECIMAL) -- Liquidez Corrente (Current Ratio)
    * `liquidez_rapida` (DECIMAL) -- Liquidez Rápida (Quick Ratio)
    * `passivo_ativos` (DECIMAL) -- Passivo/Ativos *(calculado)*
    * `debt_to_equity` (DECIMAL) -- Dívida/Patrimônio Líquido
    
    **=== INDICADORES DE RENTABILIDADE (7 indicadores) ===**
    * `roe` (DECIMAL) -- Return on Equity
    * `roic` (DECIMAL) -- Return on Invested Capital *(calculado)*
    * `roa` (DECIMAL) -- Return on Assets
    * `margem_bruta` (DECIMAL) -- Margem Bruta
    * `margem_ebitda` (DECIMAL) -- Margem EBITDA
    * `margem_liquida` (DECIMAL) -- Margem Líquida (Profit Margins)
    * `giro_ativos` (DECIMAL) -- Giro dos Ativos *(calculado)*
    
    **=== INDICADORES DE CRESCIMENTO (3 indicadores) ===**
    * `cagr_lucros_5a` (DECIMAL) -- CAGR Lucros 5 Anos (Earnings Annual Growth)
    * `crescimento_lucros` (DECIMAL) -- Crescimento de Lucros
    * `crescimento_receitas` (DECIMAL) -- Crescimento de Receitas
    _REMOVIDO: `cagr_receitas_5a` (requer dados históricos 5 anos)_
    _REMOVIDO: `crescimento_trimestral` (API retorna null)_
    
    **=== DADOS DE DIVIDENDOS (3 indicadores) ===**
    * `dividend_yield_12m` (DECIMAL) -- Dividend Yield 12 meses
    * `ultimo_dividendo` (DECIMAL) -- Valor do Último Dividendo
    * `data_ultimo_dividendo` (DATE) -- Data do Último Dividendo
    
    **=== PERFORMANCE E VARIAÇÕES (2 indicadores) ===**
    * `variacao_52_semanas` (DECIMAL) -- Variação 52 Semanas
    * `retorno_ano_atual` (DECIMAL) -- Retorno Year-to-Date (YTD)
    
    **=== DADOS FINANCEIROS OPERACIONAIS (9 indicadores) ===**
    * `ebitda` (DECIMAL) -- EBITDA valor absoluto
    * `receita_total` (DECIMAL) -- Total Revenue
    * `lucro_liquido` (DECIMAL) -- Net Income / Gross Profits
    * `fluxo_caixa_operacional` (DECIMAL) -- Operating Cashflow
    * `fluxo_caixa_livre` (DECIMAL) -- Free Cashflow
    * `total_caixa` (DECIMAL) -- Total Cash
    * `total_divida` (DECIMAL) -- Total Debt
    * `receita_por_acao` (DECIMAL) -- Revenue Per Share
    * `caixa_por_acao` (DECIMAL) -- Total Cash Per Share
    
    **=== DADOS DO BALANÇO PATRIMONIAL (12 indicadores) ===**
    * `ativo_circulante` (DECIMAL) -- Total Current Assets
    * `ativo_total` (DECIMAL) -- Total Assets
    * `passivo_circulante` (DECIMAL) -- Total Current Liabilities
    * `passivo_total` (DECIMAL) -- Total Liabilities
    * `patrimonio_liquido` (DECIMAL) -- Total Stockholder Equity
    * `caixa` (DECIMAL) -- Cash
    * `estoques` (DECIMAL) -- Inventory
    * `contas_receber` (DECIMAL) -- Net Receivables
    * `imobilizado` (DECIMAL) -- Property Plant Equipment
    * `intangivel` (DECIMAL) -- Intangible Assets
    * `divida_circulante` (DECIMAL) -- Short Term Debt
    * `divida_longo_prazo` (DECIMAL) -- Long Term Debt
    
    **=== DADOS DE DIVIDENDOS DETALHADOS (3 indicadores) ===**
    * `dividendo_mais_recente` (DECIMAL) -- Último dividendo pago
    * `data_dividendo_mais_recente` (DATE) -- Data do último dividendo
    * `historico_ultimos_dividendos` (TEXT/JSON) -- JSON com até 63+ dividendos históricos
    
    **=== METADADOS ===**
    * `updated_at` (TIMESTAMP) -- Última atualização
    * `data_source` (TEXT) -- Fonte dos dados (brapi)

* `daily_quotes`:
    * `id` (SERIAL, PK)
    * `company_id` (FK to `companies`)
    * `date` (DATE)
    * `price` (DECIMAL)

* `portfolios`:
    * `id` (SERIAL, PK)
    * `user_id` (FK to `users`)
    * `name` (TEXT)
    * `created_at` (TIMESTAMP)

* `portfolio_assets`:
    * `id` (SERIAL, PK)
    * `portfolio_id` (FK to `portfolios`)
    * `ticker` (TEXT)
    * `initial_quantity` (DECIMAL)
    * `initial_price` (DECIMAL)

### Cobertura de Dados Expandida

**Total de Indicadores Financeiros:** 65 campos (63 indicadores + 2 metadados)
**Cobertura Típica por Ação:** 62/65 indicadores (95% de cobertura)
**Módulos da API Brapi:** `summaryProfile`, `defaultKeyStatistics`, `financialData`, `balanceSheetHistory`
**Parâmetros Especiais:** `dividends=true` (até 63+ dividendos históricos)
**Indicadores Calculados:** 8 indicadores proprietários (PSR, P/Ativos, ROIC, Dívida Líquida/PL, etc.)
**Frequência de Atualização:** Diária (cotações) e dados fundamentalistas
**Compatibilidade:** Funciona no plano gratuito e pago da Brapi API

## 5. Funcionalidades Detalhadas

### Nível Gratuito

1.  **Autenticação de Usuário:** Cadastro e login simples (email/senha e/ou login com Google).
2.  **Dashboard Principal / Ferramenta de Ranking Rápido:** A página principal será uma ferramenta interativa.
    * O usuário constrói uma "regra" de forma visual. Exemplo de fluxo:
        * Título: "Encontrar as melhores empresas..."
        * **Passo 1:** Seleciona um critério: "usando o valuation de: **Fórmula de Graham** ▼". Outras opções: "com o maior **Dividend Yield** ▼", "com o menor **P/L** ▼".
        * **Passo 2 (Condicional):** Se escolheu Graham, um novo controle aparece: "com uma margem de segurança de no mínimo: **30%** -- (slider ou input)". Se escolheu DY, aparece: "com um rendimento mínimo de: **6%** -- (input)".
        * **Passo 3:** Um botão grande "Gerar Ranking".
    * Ao clicar, a seção de resultados é exibida abaixo, mostrando uma lista das 10 melhores empresas que atendem ao critério, ordenadas pelo potencial.
    * Cada item da lista mostra: Ticker, Nome, Preço Atual, Preço Justo (calculado), e o Potencial de Alta / Margem de Segurança.
    * Clicar em um item da lista leva para a página do ativo `/[ticker]`.
3.  **Página do Ativo (Limitada):**
    * Mostra informações básicas da empresa.
    * Gráfico de cotação simples.
    * Dados fundamentalistas básicos (P/L, P/VP, DY).
    * **Call-to-Action:** Um banner claro e atrativo "Desbloqueie a Análise Completa com IA" que leva ao fluxo de pagamento.

### Nível Premium (Pago)

1.  **Página do Ativo (Completa):**
    * **Múltiplos Valuations:** Uma seção com abas ou cards onde o usuário pode escolher o modelo de valuation:
        * Fórmula de Graham (Preço Justo = √(22.5 \* LPA \* VPA))
        * Modelo de Bazin (Preço Teto baseado em Dividendos)
        * Fórmula Mágica (Joel Greenblatt)
        * Outros...
    * **Comparativo de Preço:** Para cada valuation, mostrar de forma clara: `Preço Atual: R$ X` vs. `Preço Justo: R$ Y`, com um indicador de "potencial de alta/baixa" ou "margem de segurança".
    * **Análise com IA (Gemini):**
        * Um box de destaque com o título "Análise do Assistente IA".
        * **Input para o Gemini:** `Contexto: A empresa é a [Nome da Empresa] ([Ticker]), que atua no setor de [Setor]. Seus indicadores são: P/L [valor], ROE [valor], Dívida Líquida/EBITDA [valor]. A cotação atual é [preço]. O preço justo segundo a fórmula de Graham é [valor calculado]. Tarefa: 1. Busque notícias e o sentimento geral sobre a [Ticker] nas últimas semanas na internet. 2. Explique de forma simples e didática para um investidor iniciante como a fórmula de Graham funciona e como chegamos a esse preço justo. 3. Com base no sentimento online e na análise fundamentalista, forneça um resumo conciso sobre os possíveis pontos de atenção e os pontos fortes do ativo no momento.`
        * **Output:** Apresentar a resposta do Gemini de forma bem formatada.
2.  **Ranking Avançado:**
    * Permitir ranquear as empresas por todos os modelos de valuation disponíveis e por todos os indicadores listados.
    * Filtros por setor, liquidez, etc.
    * Visualização completa da lista de empresas.
3.  **Criação de Carteiras:**
    * Permitir que o usuário crie múltiplas carteiras.
    * Adicionar ativos à carteira com base nas análises.
4.  **Backtesting de Carteiras:**
    * Interface para configurar o backtest:
        * Seleção da carteira.
        * Período do teste (ex: últimos 1, 3, 5 anos).
        * Valor inicial do aporte.
        * **Configuração de Aportes Recorrentes:**
            * Valor do aporte (ex: R$ 500,00).
            * Frequência (Mensal, Trimestral).
    * **Resultado do Backtest:**
        * Gráfico comparativo da rentabilidade da carteira vs. um benchmark (ex: Ibovespa).
        * Métricas chave: Rentabilidade total, Rentabilidade anualizada (CAGR), Melhor e Pior mês.

## 6. Fluxo de Pagamento (PIX)

1.  O usuário clica no botão "Desbloquear Premium".
2.  Um modal aparece explicando os benefícios e o preço (ex: "R$ 19,90 por 1 mês de acesso total").
3.  Ao clicar em "Pagar com Pix", o frontend faz uma chamada para o backend.
4.  O backend gera uma cobrança Pix via API do gateway de pagamento (ex: Mercado Pago).
5.  A API de pagamento retorna um QR Code (imagem) e um "Copia e Cola".
6.  O frontend exibe o QR Code e o código para o usuário pagar no app do banco dele.
7.  O frontend começa a "ouvir" (via polling ou websocket) uma rota no backend para verificar a confirmação do pagamento.
8.  Enquanto isso, o gateway de pagamento, após a confirmação, envia um **webhook** para um endpoint específico no seu backend.
9.  O backend recebe o webhook, valida a informação, e atualiza o usuário no banco de dados: `subscription_tier = 'premium'` e `premium_expires_at = NOW() + '30 days'`.
10. Na próxima vez que o frontend verificar o status, ele verá que o usuário é premium e liberará o acesso, mostrando uma mensagem de sucesso.

## 7. Plano de Desenvolvimento (MVP e Fases)

### Fase 1: MVP (Produto Mínimo Viável) - Foco em validar a ideia e o fluxo de pagamento.

* Autenticação de usuários.
* Integração com a API de dados para buscar e armazenar informações de 50-100 empresas principais da B3.
* Página principal com a ferramenta de "Ranking Rápido" funcional para **UM** modelo (ex: Graham).
* Página do ativo com dados básicos e o cálculo de Graham.
* Integração com a API do Gemini para a análise de IA.
* **Fluxo de pagamento completo com Pix.**
* Página de conta do usuário onde ele pode ver o status da sua assinatura.
* **NÃO INCLUIR NO MVP:** Múltiplas carteiras, backtesting, filtros avançados, múltiplos modelos de valuation.

### Fase 2: Melhorias do Produto Principal

* Adicionar mais modelos de valuation (Bazin, Greenblatt, etc.) na home e na página do ativo.
* Implementar o sistema de criação de carteiras.
* Criar a página de Ranking Avançado (Screener) com múltiplos filtros.
* Expandir a base de dados para mais empresas.

### Fase 3: Funcionalidades Avançadas

* Implementar o sistema de backtesting completo, com aportes recorrentes.
* Adicionar outros tipos de ativos (FIIs, BDRs).
* Alertas de preço ou quando um ativo atinge a "margem de segurança".
* Área de notícias integrada.

## 8. Prompts Sequenciais para o Cursor

Esta seção contém uma lista de prompts para construir o aplicativo passo a passo, organizados por fase de desenvolvimento.

---

### **FASE 1: MVP (Produto Mínimo Viável)**

**1. Configuração Inicial do Projeto**
* **Objetivo:** Criar a estrutura base do projeto com as tecnologias definidas.
* **Prompt:**
    >   "Crie um novo projeto Next.js 14 com o App Router, utilizando TypeScript e Tailwind CSS. Configure o Prisma como ORM, conectando-o a uma base de dados PostgreSQL. Instale e configure o NextAuth.js para autenticação, com um provedor de 'credentials' (email/senha) e um provedor do Google."

**2. Schema do Banco de Dados**
* **Objetivo:** Definir todas as tabelas e relações no banco de dados.
* **Prompt:**
    >   "Com base no plano do projeto, gere o arquivo `schema.prisma` completo. Ele deve incluir os modelos: `User`, `Company`, `FinancialData`, `DailyQuote`, e as relações apropriadas. No modelo `User`, adicione os campos `subscriptionTier` (com um Enum 'FREE', 'PREMIUM') e `premiumExpiresAt` (DateTime opcional)."

**3. Autenticação e Layout Principal**
* **Objetivo:** Criar as páginas de login, registro e o layout visual principal do app.
* **Prompt:**
    >   "Crie as rotas e componentes para as páginas de login (`/login`) e registro (`/register`) usando formulários simples. No arquivo de layout principal (`/app/layout.tsx`), adicione um Header que mostre um botão de 'Login' se o usuário não estiver logado, e o email do usuário com um botão de 'Sair' se ele estiver logado. Use os hooks do NextAuth.js para gerenciar a sessão."

**4. Worker de Ingestão de Dados**
* **Objetivo:** Criar o script que busca dados de mercado e popula nosso banco de dados.
* **Prompt:**
    >   "Crie um script TypeScript (`/scripts/fetch-data.ts`) que não seja parte da aplicação Next.js. Este script deve:
    >
    >   1.  Ter uma lista de tickers (ex: \['PETR4', 'VALE3', 'ITUB4'\]).
    >   2.  Para cada ticker, fazer uma chamada à API da `Brapi` para buscar dados de cotação e fundamentos.
    >   3.  Usar o cliente Prisma para inserir ou atualizar os dados nas tabelas `Company`, `FinancialData` e `DailyQuote`.
    >       Crie um `package.json` script chamado 'fetch:data' para rodar este arquivo."

**5. Página Principal com Ferramenta de Ranking Rápido (Backend)**
* **Objetivo:** Criar a API que processa as regras de ranking criadas pelo usuário.
* **Prompt:**
    >   "Crie uma API Route em `/api/rank-builder`. Ela deve aceitar um método POST com um corpo contendo `model` (ex: 'graham', 'dividendYield') e `params` (ex: `{ marginOfSafety: 0.3 }` ou `{ minYield: 0.06 }`). A lógica deve:
    >
    >   1.  Conectar-se ao banco de dados com o Prisma.
    >   2.  Fazer uma query na tabela `FinancialData`, buscando os dados necessários para o modelo escolhido.
    >   3.  Filtrar as empresas com base nos `params` (ex: `WHERE (sqrt(22.5 * lpa * vpa) / currentPrice - 1) >= marginOfSafety`).
    >   4.  Ordenar os resultados pelo critério mais relevante (ex: maior margem de segurança).
    >   5.  Limitar a 10 resultados e retornar uma lista de empresas com `ticker`, `name`, `currentPrice`, e `fairValue`."

**6. Página Principal com Ferramenta de Ranking Rápido (Frontend)**
* **Objetivo:** Implementar a interface interativa na homepage para criar as regras.
* **Prompt:**
    >   "Na página principal (`/app/page.tsx`), crie um componente `QuickRanker`. Ele deve ser o elemento central da página. Este componente deve ter:
    >
    >   1.  Um estado para gerenciar a regra do usuário (`model` e `params`).
    >   2.  Componentes de UI (Select, Slider, Input da `shadcn/ui`) para o usuário construir a regra de forma interativa. Os parâmetros devem aparecer condicionalmente.
    >   3.  Um botão 'Gerar Ranking' que, ao ser clicado, faz uma requisição POST para a API `/api/rank-builder` com a regra atual.
    >   4.  Uma seção de resultados que exibe um estado de 'carregando' e depois renderiza a lista retornada pela API. Cada item da lista deve ser um link para a página `/[ticker]` correspondente."

**7. Página do Ativo (Estrutura e Dados)**
* **Objetivo:** Criar a página dinâmica que exibe as informações detalhadas de um ativo.
* **Prompt:**
    >   "Crie a página dinâmica `/[ticker]/page.tsx`. Esta página deve:
    >
    >   1.  Receber o `ticker` dos parâmetros da URL.
    >   2.  Buscar no banco de dados todas as informações da empresa e seus dados financeiros.
    >   3.  Exibir o nome, ticker e setor.
    >   4.  Mostrar os principais indicadores financeiros em cards bem organizados.
    >   5.  Implementar o cálculo do Preço Justo de Graham e exibir o resultado comparando com o preço atual."

**8. Integração com IA (Gemini)**
* **Objetivo:** Criar o componente que gera e exibe a análise da IA.
* **Prompt:**
    >   "Crie uma API Route em `/api/generate-analysis`. Ela deve receber dados do ativo (ticker, nome, setor, indicadores, preço justo de Graham). Dentro dela, construa um prompt para a API do Google Gemini, pedindo uma análise de sentimento e uma explicação do valuation. Na página `/[ticker]`, crie um componente `AIAnalysis`. Ele deve ter um botão 'Gerar Análise com IA'. Ao clicar, ele chama essa API Route, exibe um estado de 'carregando', e depois mostra a resposta formatada."

**9. Lógica de Pagamento (Backend)**
* **Objetivo:** Criar as rotas de API para gerar a cobrança Pix e receber a confirmação.
* **Prompt:**
    >   "Usando o SDK do Mercado Pago para Node.js, crie duas API Routes:
    >
    >   1.  `/api/payments/create-pix`: Recebe o ID do usuário, cria uma cobrança Pix de valor fixo e retorna o `qr_code_base64` e o `payload` (copia e cola).
    >   2.  `/api/payments/webhook`: Recebe uma notificação de webhook do Mercado Pago. Valide o evento e, se o pagamento for aprovado, atualize o registro do usuário no banco de dados, definindo `subscriptionTier` para 'PREMIUM' e `premiumExpiresAt` para 30 dias no futuro."

**10. Fluxo de Pagamento (Frontend)**
* **Objetivo:** Criar a interface para o usuário realizar o pagamento.
* **Prompt:**
    >   "Crie um componente `UpgradeButton`. Ele deve ser exibido na página do ativo para usuários gratuitos. Ao ser clicado, ele abre um modal que chama a rota `/api/payments/create-pix`. O modal deve exibir a imagem do QR Code e o código 'copia e cola'. O modal deve também fazer polling a cada 5 segundos para uma rota `/api/user/status` para verificar se a assinatura foi ativada. Ao confirmar, feche o modal e exiba uma mensagem de sucesso."

**11. Controle de Acesso e Página de Conta**
* **Objetivo:** Restringir conteúdo e permitir que o usuário veja seu status.
* **Prompt:**
    >   "Refatore o componente `AIAnalysis` e outras funcionalidades premium para que só sejam renderizados se a sessão do usuário indicar que ele é 'PREMIUM'. Crie uma página `/conta` onde o usuário logado pode ver seu email, seu plano de assinatura ('Gratuito' ou 'Premium') e a data de expiração do plano, se aplicável."

---

### **FASE 2: Melhorias do Produto Principal**

**12. Novos Modelos de Valuation (no Ranking Rápido e na Página do Ativo)**
* **Objetivo:** Adicionar mais opções de análise para o usuário.
* **Prompt:**
    >   "Expanda a funcionalidade da ferramenta `QuickRanker` e da página `/[ticker]`.
    >
    >   1.  No backend (`/api/rank-builder`), adicione a lógica para os modelos 'Décio Bazin' e 'Fórmula Mágica (Greenblatt)'.
    >   2.  No frontend, adicione essas opções no seletor do `QuickRanker` e seus respectivos inputs condicionais.
    >   3.  Na página `/[ticker]`, modifique a seção de valuation para uma estrutura de abas (Tabs), onde cada aba mostra a análise de um modelo diferente (Graham, Bazin, etc.)."

**13. Página de Ranking Completa**
* **Objetivo:** Criar uma ferramenta de "screener" completa para usuários mais avançados.
* **Prompt:**
    >   "Crie a página `/ranking`. Diferente do ranking rápido da home, esta página deve exibir uma tabela completa de todos os ativos. Utilize a `DataTable` da `shadcn/ui`. Adicione múltiplos filtros (Selects, Inputs) acima da tabela para que o usuário possa filtrar por setor, P/L (mín/máx), DY (mín/máx), ROE (mín/máx), etc. A tabela deve ser ordenável por qualquer coluna."

**14. Criação de Carteiras (Backend & Frontend)**
* **Objetivo:** Permitir que o usuário salve e gerencie suas próprias carteiras de ativos.
* **Prompt:**
    >   "Implemente o CRUD completo para carteiras. Crie as API Routes necessárias:
    >
    >   * `POST /api/portfolios`: Criar uma nova carteira.
    >   * `GET /api/portfolios`: Listar carteiras do usuário.
    >   * `POST /api/portfolios/[id]/assets`: Adicionar um ativo a uma carteira.
    >   * `DELETE /api/portfolios/[id]/assets/[assetId]`: Remover um ativo.
    >       Crie a página `/carteiras` que usa essas rotas para permitir que o usuário crie e gerencie suas carteiras."

---

### **FASE 3: Funcionalidades Avançadas**

**15. Lógica de Backtesting (Backend)**
* **Objetivo:** Construir o motor que simula a performance de uma carteira no passado.
* **Prompt:**
    >   "Crie uma API Route complexa em `/api/backtest`. Ela deve receber um `portfolioId`, `startDate`, `endDate`, `initialAmount` e `monthlyContribution`. A lógica deve:
    >
    >   1.  Buscar os ativos da carteira.
    >   2.  Para cada ativo, buscar todo o seu histórico de cotações (`DailyQuote`) no período.
    >   3.  Simular a compra inicial, distribuindo o valor igualmente entre os ativos.
    >   4.  Iterar mês a mês, adicionando o aporte mensal e comprando mais ativos.
    >   5.  Calcular o valor total da carteira em cada dia do período.
    >   6.  Retornar uma série de dados `[{date, portfolioValue}]`."

**16. Interface de Backtesting (Frontend)**
* **Objetivo:** Permitir que o usuário configure e visualize os resultados do backtest.
* **Prompt:**
    >   "Na página de uma carteira específica (`/carteiras/[id]`), crie a seção de backtest. Adicione um formulário para o usuário inserir o período, o aporte inicial e os aportes mensais. Ao submeter, chame a API `/api/backtest`. Use a biblioteca Recharts para renderizar um gráfico de linha com os dados retornados, mostrando a evolução do patrimônio ao longo do tempo. Adicione também cards com métricas finais: rentabilidade total e CAGR."

**17. Suporte a FIIs (Fundos Imobiliários)**
* **Objetivo:** Expandir o app para outros tipos de ativos.
* **Prompt:**
    >   "Modifique o `schema.prisma`. Na tabela `Company`, adicione um campo `type` (ENUM: 'STOCK', 'FII'). Na tabela `FinancialData`, adicione campos específicos de FIIs, como `dividend_yield_12m`, `valor_patrimonial_cota`, `p_vpa` e `liquidez_diaria`. Adapte o worker de ingestão de dados e a página `/[ticker]` para exibir os dados corretos com base no tipo do ativo."
