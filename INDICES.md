# 📄 Projeto: Engine de Índices Preço Justo (IPJ)

## 1. Visão Geral (Executive Summary)

O objetivo deste projeto é implementar a funcionalidade de **Índices de Mercado Proprietários** (ex: IPJ-VALUE, IPJ-DIV) na plataforma Preço Justo AI.

Diferente de uma "Carteira Recomendada" (que atrai regulação rigorosa da CVM para analistas CNPI), o sistema funcionará como um **Provedor de Dados (Benchmark)**. Ele calcula o desempenho teórico de uma cesta de ativos selecionada estritamente por algoritmos quantitativos públicos, similar ao que empresas como S&P e MSCI fazem.

**Premissa Técnica:** O sistema adota a estratégia *"Start-from-Now"*. Os índices nascem com Base 100 no dia de sua criação e constroem histórico dia após dia, eliminando a necessidade de bases de dados históricos complexas no MVP.

---

## 2. O Produto: "Índices" vs "Recomendação"

### Mudança de Paradigma (Compliance CVM)

Para evitar riscos regulatórios (Resolução CVM 20), a feature adota a semântica de **Índices Teóricos**.

* **Não fazemos:** "Recomendação de Compra" (Subjetivo/Personalizado/Call de Ação).
* **Fazemos:** "Rastreamento de Estratégia Quantitativa" (Objetivo/Matemático/Dado Histórico).

### Regras de Negócio Gerais

1. **Transparência Total (White-Box):** A metodologia de seleção de cada índice deve ser pública e auditável.
2. **Automação:** Nenhuma troca de ativo é feita manualmente por humanos. A IA/Algoritmo decide estritamente com base na regra pré-definida.
3. **Base 100:** Todo índice começa valendo 100 pontos.

---

## 3. Definição do "Carro Chefe" (MVP)

**Nome:** **IPJ-VALUE (Índice Preço Justo Value)**
**Objetivo:** Simular uma carteira de *Deep Value Investing* com travas de segurança.

**Metodologia (Regras do Algoritmo):**

1. **Universo:** Ações listadas na B3.
2. **Liquidez:** Volume Médio Diário > R$ 2.000.000 (Garante liquidez real).
3. **Qualidade (Travas de Segurança):**
   * ROE > 10%
   * Margem Líquida > 5%
   * Dívida Líquida / EBITDA < 3x
4. **Seleção:** Top 10 ativos com maior *Upside* (Diferença entre Valor Justo calculado e Preço Atual).
5. **Pesos:** *Equal Weight* (Pesos Iguais - 10% para cada ativo).
6. **Rebalanceamento:** Monitoramento diário. A troca efetiva ocorre apenas se:
   * Um ativo deixar de atender aos critérios de Qualidade.
   * Um novo ativo surgir com *Upside* superior a 5% em relação ao 10º colocado (evita troca excessiva).

---

## 4. Lógica Matemática (Engine de Cálculo)

O sistema calcula o **NAV (Net Asset Value)** do índice diariamente baseado no modelo *Price Return* (apenas variação da cotação), simplificando a engenharia ao evitar cálculos complexos de reinvestimento de dividendos.

### A. Variação Diária ($R_t$)

A variação do índice é a soma ponderada da variação dos seus componentes.

$$
R_t = \sum_{i=1}^{n} (w_{i,t-1} \times r_{i,t})
$$

* $w_{i,t-1}$: Peso do ativo no fechamento do dia anterior.
* $r_{i,t}$: Variação percentual do preço do ativo hoje ($\frac{PreçoHoje}{PreçoOntem} - 1$).

### B. Atualização dos Pontos

$$
Pontos_{hoje} = Pontos_{ontem} \times (1 + R_t)
$$

### C. Rebalanceamento (Troca de Ativos)

Quando a IA decide trocar ativos:

1. O valor dos **Pontos** não muda no momento exato da troca.
2. A **Composição** muda (Sai Ativo A, Entra Ativo B).
3. Os **Pesos** são resetados para a meta (ex: 10% cada).
4. O cálculo do dia seguinte ($D+1$) já considera a nova cesta de ativos.

---

## 5. Arquitetura Técnica

### Stack Sugerida

* **Backend:** Node.js (Next.js API Routes ou Server Actions).
* **Database:** PostgreSQL + Prisma ORM.
* **Scheduler:** Cron Job (Vercel Cron ou BullMQ).

### Schema do Banco de Dados (Prisma)

```prisma
// Definição da Regra do Índice (A "Fórmula")
// Essa formula deve levar em conta todos os dados dos dados das tabela companies e suas associações (relações), ver schema.prisma
model IndexDefinition {
  id          String   @id @default(uuid())
  ticker      String   @unique // Ex: "IPJ-VALUE"
  name        String   // Ex: "Índice Preço Justo Value"
  description String
  color       String   // Hex code para gráficos
  methodology String   // Texto explicando a regra (Compliance)
  
  // Configuração JSON para a Engine criar novos índices facilmente
  // Ex: { "type": "VALUE", "min_liquidity": 2000000, "top_n": 10 }
  config      Json     
  
  history     IndexHistoryPoints[]
  composition IndexComposition[]
}

// A Carteira Atual (Snapshot do que compõe o índice HOJE)
model IndexComposition {
  id              String   @id @default(uuid())
  indexId         String
  assetTicker     String   // Ex: "BBAS3"
  
  // Peso Alvo (ex: 0.10). Usado para rebalanceamento.
  targetWeight    Float    
  
  // Dados estáticos de entrada para fins de histórico/comparação
  entryPrice      Float    
  entryDate       DateTime @default(now())
  
  definition      IndexDefinition @relation(fields: [indexId], references: [id])
}

// Série Temporal (Para plotar o gráfico de performance)
model IndexHistoryPoints {
  id          String   @id @default(uuid())
  indexId     String
  date        DateTime // Data do pregão
  points      Float    // Valor do índice (ex: 102.54)
  dailyChange Float    // Variação % do dia (ex: 1.2%)
  
  // Cache do Yield para exibir na UI sem recálculo
  currentYield Float?  // Média ponderada do DY da carteira neste dia

  definition  IndexDefinition @relation(fields: [indexId], references: [id])
  
  @@unique([indexId, date])
}

// Log de Auditoria e UX (Timeline de Mudanças)
model IndexRebalanceLog {
  id          String   @id @default(uuid())
  indexId     String
  date        DateTime @default(now())
  action      String   // "ENTRY", "EXIT", "REBALANCE"
  ticker      String
  reason      String   // Texto gerado pela IA: "Saiu pois ROE caiu para 8%"
}

Rotina do Cron Job (Diário - 19:00h)
Job 1: Mark-to-Market (Cálculo de Pontos)

Busca cotações de fechamento (API B3).
O JOB precisa ser tolerante a falha, caso ele não execute em um dia ou execue com erro, na sua próxima execução ele precisa pegar as lacunas e CALCULAR os dias faltantes.

Calcula variação ponderada (R 
t
​
 ) de cada índice ativo.

Calcula o DY Médio ponderado da carteira atual (para fins de exibição).

Salva novo registro em IndexHistoryPoints.

Job 2: Engine de Regras (A "IA")

Roda a query de screening baseada no config do índice. Essa config é a formula do indice que deve levar em conta todos os dados dos dados das tabela companies e suas associações (relações), ver schema.prisma, todos os dados existentes deve ser possível de configurar

Compara o resultado ideal com a IndexComposition atual.

Se necessário: Atualiza IndexComposition e cria log em IndexRebalanceLog.

6. UX/UI e Requisitos de Frontend
A interface deve compensar o fato do índice ser Price Return (não reinvestir dividendos) destacando a geração de renda.

Tela 1: Dashboard de Índices
Visual: Cards limpos.

Dados: Nome do Índice, Pontuação Atual, Rentabilidade Acumulada.

Micro-interação: Sparkline (mini gráfico) mostrando a tendência.

Tela 2: Detalhe do Índice (Página do Produto)
A. Cabeçalho de Performance (Card Principal)
Deve exibir a soma visual do retorno para educar o usuário:

Retorno Total Estimado: +18.5% <small>Valorização da Cota (+12.0%) + Dividend Yield Médio (+6.5%)</small>

B. Gráfico Comparativo (Obrigatório)
Linha Principal (Colorida): Performance do Índice (IPJ).

Linha Benchmark (Cinza/Pontilhada): IBOVESPA ou CDI.

Objetivo: Prova social imediata ("Estamos batendo o mercado").

Badge Flutuante: "Yield Médio da Carteira: 8.4% a.a." (Fixo no canto do gráfico).

C. Lista de Ativos (Constituintes)
Tabela com: Ticker, Peso Atual, Preço Entrada, DY Atual (Destaque).

Feature Pro: Borrar a lista de ativos para usuários Free, liberando apenas mediante assinatura.

D. Timeline de "Gestão" (Transparência)
Componente visual vertical mostrando as últimas trocas.

Exemplo: "🟢 02/12: Entrada de VALE3 (Substituindo PETR4 por critério de Margem de Segurança)".

7. Escalabilidade (Criação de Novos Índices)
Para criar um novo índice (ex: "Small Caps"), o admin deve apenas inserir um registro no banco via Painel Admin:

ticker: "IPJ-SMALL"

config: { "strategy": "SMALL_CAP", "max_market_cap": 5000000000 }

(ter algum lugar no ADMIN que indique todos os campos existentes para serem usados na config, ou fazer isso visualmete, os campso existentes são tudo que tem na tabela companies e suas relações)

O sistema deve reconhecer o novo registro, rodar o setup inicial (base 100) e incluí-lo automaticamente nos Jobs diários sem deploy de código novo.

8. Disclaimer Jurídico (Rodapé Obrigatório)
Inserir em fonte legível (tamanho 10px ou 12px) próximo aos gráficos e listas de ativos.

"Os índices da família Preço Justo (IPJ) são carteiras teóricas automatizadas, geradas estritamente por algoritmos matemáticos baseados em dados públicos. A inclusão de um ativo no índice não configura recomendação de investimento, compra ou venda, nem leva em consideração o perfil de risco do usuário. Rentabilidade passada não é garantia de resultados futuros."