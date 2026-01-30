# Ben - Assistente de Análise Fundamentalista

## 📋 Sobre o Ben

O **Ben** é um assistente de IA especializado em análise fundamentalista de ações, inspirado nos princípios de **Benjamin Graham**, o pai do value investing. Ele combina conhecimento técnico com uma abordagem didática para ajudar investidores a tomar decisões fundamentadas.

### Personalidade

- **Educado e técnico**: Apresenta análises precisas e fundamentadas
- **Didático**: Explica conceitos complexos de forma clara e acessível
- **Pragmático**: Foca em margem de segurança e análise objetiva
- **Conservador**: Não incentiva giro excessivo de carteira
- **Focado em longo prazo**: Prioriza investimentos conscientes e sustentáveis

---

## 🛠️ Ferramentas e Capacidades

### 1. Análise Fundamentalista (`getCompanyMetrics`)

O Ben pode analisar métricas fundamentais completas de qualquer empresa listada na B3:

**Métricas de Valuation:**
- P/L (Preço/Lucro)
- P/VP (Preço/Valor Patrimonial)
- EV/EBITDA
- Earnings Yield
- PSR (Preço/Receita)

**Métricas de Rentabilidade:**
- ROE (Return on Equity)
- ROIC (Return on Invested Capital)
- ROA (Return on Assets)
- Margem Líquida
- Margem EBITDA
- Margem Bruta

**Métricas de Endividamento:**
- Dívida Líquida/PL
- Dívida Líquida/EBITDA
- Liquidez Corrente
- Liquidez Rápida
- Passivo/Ativos

**Métricas de Crescimento:**
- Crescimento de Lucros
- Crescimento de Receitas
- CAGR de Lucros (5 anos)

**Score Geral:**
- Score consolidado da empresa (0-100)
- Análise de qualidade e atratividade

**Quando usar:** Pergunte sobre fundamentos, valorização, rentabilidade ou análise fundamentalista de uma ação específica.

**Exemplo:** "Quais são os fundamentos da PETR4?" ou "Analise a rentabilidade da VALE3"

---

### 2. Análise Técnica (`getTechnicalAnalysis`)

O Ben fornece análise técnica completa com indicadores avançados:

**Indicadores de Momentum:**
- RSI (Relative Strength Index)
- Stochastic (%K e %D)
- MACD (Moving Average Convergence Divergence)
- Histograma MACD

**Médias Móveis:**
- SMA 20, 50, 200 dias
- EMA 12, 26 dias

**Bollinger Bands:**
- Bandas superior, média e inferior
- Análise de volatilidade

**Níveis de Suporte e Resistência:**
- Suportes identificados
- Resistências identificadas
- Níveis psicológicos

**Análise de IA:**
- Preço mínimo estimado
- Preço máximo estimado
- Preço justo de entrada
- Análise de tendência
- Confiança da análise

**Sinais:**
- SOBRECOMPRA / SOBREVENDA / NEUTRO
- Sinais de compra/venda baseados em múltiplos indicadores

**Quando usar:** Pergunte sobre gráficos, indicadores técnicos, sinais de compra/venda ou análise técnica.

**Exemplo:** "Qual a análise técnica da ITUB4?" ou "RSI e MACD da PETR4"

---

### 3. Valor Justo e Valuation (`getFairValue`)

O Ben calcula o valor justo usando **múltiplas estratégias combinadas**:

**Modelos de Valuation:**

1. **Graham** (Fórmula Clássica)
   - Fórmula: √(22.5 × LPA × VPA)
   - Método conservador baseado em lucro e valor patrimonial

2. **FCD - Fluxo de Caixa Descontado**
   - Projeção de fluxos de caixa futuros (5-10 anos)
   - Desconto ao valor presente usando WACC
   - Inclui valor terminal
   - Método mais preciso para empresas com fluxos estáveis

3. **Gordon - Dividend Discount Model**
   - Modelo de desconto de dividendos
   - Ideal para empresas pagadoras de dividendos consistentes

4. **Barsi**
   - Método desenvolvido por Luiz Barsi
   - Foca em empresas com histórico sólido de dividendos e crescimento

5. **Análise Técnica (IA)**
   - Preço justo baseado em padrões técnicos identificados por IA
   - Análise de tendências e suporte/resistência

**Análise Integrada:**
- Combina todos os modelos disponíveis
- Relaciona valores justos com indicadores fundamentais (P/L, P/VP, ROE, ROIC)
- Fornece recomendação baseada na análise combinada
- Indica potencial de valorização (upside) ou sobrevalorização

**Quando usar:** Pergunte sobre valor justo, preço justo, valor intrínseco, fair value, valuation ou "quanto vale uma ação".

**Exemplo:** "Qual o valor justo da PETR4?" ou "Quanto deveria valer a VALE3?"

**Nota:** O Ben sempre menciona que o valor justo detalhado também está disponível na página oficial do ticker (`/acao/TICKER`) com visualização completa e gráficos.

---

### 4. Projeções de Dividendos (`getDividendProjections`)

O Ben fornece projeções de dividendos para os próximos 12 meses:

- Projeções mensais dos próximos 12 meses
- Histórico recente de pagamentos
- Análise de consistência
- Total projetado para o período

**Quando usar:** Pergunte sobre dividendos, renda passiva ou projeções de pagamentos.

**Exemplo:** "Quais as projeções de dividendos da TAEE11?" ou "Quanto a PETR4 deve pagar em dividendos?"

---

### 5. Radar de Investimentos (`getUserRadar`)

O Ben consulta o radar pessoal do usuário:

- Lista de tickers monitorados
- Score consolidado de cada ação
- Preço atual
- Análise técnica resumida
- Sentimento de mercado
- Status de valuation
- Status geral (verde/amarelo/vermelho)

**Quando usar:** Pergunte sobre seu radar, ações que está monitorando ou carteira.

**Exemplo:** "Quais ações estão no meu radar?" ou "Como estão minhas ações monitoradas?"

---

### 6. Sentimento de Mercado (`getMarketSentiment`)

O Ben analisa o sentimento geral do mercado brasileiro:

- Tendências recentes
- Análises consolidadas
- Contexto macroeconômico

**Quando usar:** Pergunte sobre o sentimento de mercado ou tendências gerais.

**Exemplo:** "Qual o sentimento do mercado?" ou "Como está o mercado hoje?"

---

### 7. Dados do IBOVESPA (`getIbovData`)

O Ben fornece dados atualizados do índice IBOVESPA:

- Valor atual
- Variação do dia
- Dados históricos
- Contexto do mercado

**Quando usar:** Pergunte sobre o IBOV ou o mercado em geral.

**Exemplo:** "Como está o IBOV?" ou "Qual a variação do IBOV hoje?"

---

### 8. Busca na Web (`webSearch`)

O Ben pode buscar informações atualizadas na internet:

- Notícias recentes
- Eventos do mercado
- Informações que não estão no banco de dados
- Dados atualizados em tempo real

**Quando usar:** Quando precisar de informações muito recentes ou que não estão no sistema.

**Exemplo:** "Busque notícias sobre a Petrobras" ou "O que está acontecendo com o setor de energia?"

---

### 9. Features da Plataforma (`getPlatformFeatures`)

O Ben conhece todas as funcionalidades da plataforma e pode orientar sobre:

- Simulador de Carteira / Backtest
- Rankings de ações
- Análises preditivas com IA
- Comparação de ações
- Screening avançado
- E muito mais...

**Quando usar:** Pergunte sobre funcionalidades, como usar ferramentas ou recursos disponíveis.

**Exemplo:** "Como simular uma carteira?" ou "Quais funcionalidades estão disponíveis?"

---

## 🧠 Sistema de Memória

O Ben possui um **sistema de memória inteligente** que aprende sobre você ao longo do tempo:

### O que o Ben Lembra

**Preferências de Investimento:**
- Perfil de risco (conservador, moderado, arrojado)
- Preferências de investimento

**Empresas de Interesse:**
- Tickers mencionados
- Empresas que você demonstrou interesse
- Contexto sobre cada empresa

**Objetivos:**
- Horizonte temporal (curto, médio, longo prazo)
- Metas de investimento

**Perfil:**
- Tolerância ao risco
- Perfil de investidor

**Aprendizados:**
- Insights importantes que você demonstrou compreender
- Conceitos aprendidos durante conversas

**Decisões e Intenções:**
- Decisões explícitas de investimento
- Intenções mencionadas

### Como Funciona

1. **Avaliação Automática**: Após cada conversa, o Ben avalia se há informações relevantes para memorizar
2. **Registro Inteligente**: Apenas informações realmente mencionadas são registradas (não inventa dados)
3. **Rastreabilidade**: Cada memória mantém registro das conversas de origem (`sourceConversationIds`)
4. **Decaimento Temporal**: Memórias antigas têm relevância reduzida automaticamente

### Decaimento de Relevância

O sistema calcula a relevância de cada memória usando:

**Fórmula:** `relevanceScore = baseImportance × temporalDecay × contextBoost`

**Decaimento Temporal:**
- **< 30 dias**: Sem decaimento (100% relevante)
- **30-90 dias**: 30% de redução (70% relevante)
- **> 90 dias**: 50% de redução (50% relevante)

**Boost Contextual:**
- **Match de ticker**: +20% de relevância
- **Match de setor**: +10% de relevância

**Ordenação:**
- Memórias são ordenadas por relevância
- Top 20 mais relevantes são incluídas no contexto do Ben

---

## 🎯 Contexto e Personalização

### Contexto da Página

O Ben entende em qual página você está e adapta suas respostas:

- Se você está na página de uma ação específica, ele já sabe qual empresa você está analisando
- Pode fornecer análises mais direcionadas ao contexto atual
- Cria links automáticos para páginas relacionadas

### Detecção de Tickers

O Ben detecta automaticamente quando você menciona tickers:

- Normaliza tickers automaticamente
- Entende referências por nome da empresa
- Sugere análises quando detecta empresas mencionadas

---

## 💡 Diretrizes de Resposta

### O que o Ben Faz

✅ **Usa ferramentas automaticamente** quando necessário para obter dados atualizados
✅ **Analisa dados** e apresenta respostas detalhadas e contextualizadas
✅ **Explica conceitos** de forma didática quando necessário
✅ **Menciona margem de segurança** ao recomendar investimentos
✅ **Cria links** para páginas de empresas quando menciona tickers
✅ **Combina análises** de múltiplas fontes para respostas completas

### O que o Ben NÃO Faz

❌ **Não menciona** que está usando ferramentas (usa silenciosamente)
❌ **Não incentiva** trades de curto prazo ou giro excessivo
❌ **Não inventa** informações que não tem certeza
❌ **Não deixa** o usuário sem resposta após obter dados

---

## 🔗 Integrações

### Fontes de Dados

- **Banco de Dados Próprio**: Fonte principal de dados financeiros
- **Yahoo Finance**: Fallback para dados atualizados quando necessário
- **Google Gemini**: IA para análises e geração de conteúdo
- **Google Search**: Busca na web para informações atualizadas

### APIs e Serviços

- **Prisma ORM**: Acesso ao banco de dados
- **Google GenAI**: Processamento de linguagem natural
- **Serviços Internos**: Análise técnica, cálculo de scores, projeções

---

## 📊 Exemplos de Uso

### Análise Completa de Empresa

```
Usuário: "Analise a PETR4 para mim"

Ben: [Usa getCompanyMetrics + getTechnicalAnalysis + getFairValue]
     - Apresenta fundamentos completos
     - Análise técnica com indicadores
     - Valor justo usando múltiplos modelos
     - Recomendação consolidada
```

### Consulta de Valor Justo

```
Usuário: "Qual o valor justo da VALE3?"

Ben: [Usa getFairValue]
     - Calcula usando Graham, FCD, Gordon, Barsi e Análise Técnica
     - Combina resultados com indicadores fundamentais
     - Fornece análise integrada
     - Menciona página oficial com detalhes
```

### Análise Técnica

```
Usuário: "RSI e MACD da ITUB4"

Ben: [Usa getTechnicalAnalysis]
     - Mostra valores de RSI e MACD
     - Interpreta os sinais
     - Fornece recomendação técnica
```

### Consulta de Memória

```
Usuário: "Lembra quando falei sobre investir em tech?"

Ben: [Usa memória do usuário]
     - Recupera empresas mencionadas anteriormente
     - Contextualiza com informações atuais
     - Fornece análise atualizada
```

---

## 🚀 Tecnologias Utilizadas

- **Google Gemini 2.5 Flash Lite**: Modelo de IA para processamento de linguagem
- **Function Calling**: Sistema de ferramentas integradas
- **Streaming**: Respostas em tempo real via SSE
- **Prisma ORM**: Gerenciamento de banco de dados
- **TypeScript**: Linguagem de programação

---

## 📝 Notas Importantes

1. **Dados em Tempo Real**: O Ben sempre busca dados atualizados antes de responder
2. **Análise Combinada**: Combina múltiplas fontes e modelos para análises completas
3. **Memória Persistente**: Aprende sobre você ao longo do tempo
4. **Contexto Inteligente**: Adapta respostas ao contexto da página atual
5. **Links Automáticos**: Cria links para páginas relacionadas automaticamente

---

## 🎓 Princípios Fundamentais

O Ben segue os princípios de **Benjamin Graham**:

- **Margem de Segurança**: Sempre considera o risco
- **Análise Fundamentalista**: Foca em fundamentos sólidos
- **Longo Prazo**: Investimentos conscientes e sustentáveis
- **Educação**: Ensina enquanto analisa
- **Conservadorismo**: Não incentiva especulação

---

**Última atualização:** Janeiro 2026

