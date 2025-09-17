export interface BlogPost {
  id: number
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  readTime: string
  publishDate: string
  author: string
  featured?: boolean
  tags: string[]
  seoTitle?: string
  seoDescription?: string
}

const initialBlogPosts: BlogPost[] = [
  {
    id: 1,
    slug: "guia-completo-analise-fundamentalista-iniciantes",
    title: "Guia Completo da Análise Fundamentalista para Iniciantes",
    excerpt: "Aprenda passo a passo como analisar empresas usando os fundamentos financeiros. Do básico ao avançado, com exemplos práticos da B3.",
    category: "Educação",
    readTime: "15 min",
    publishDate: "2024-12-15",
    author: "Equipe Preço Justo AI",
    featured: true,
    tags: ["análise fundamentalista", "iniciantes", "investimentos", "B3", "tutorial"],
    seoTitle: "Guia Completo da Análise Fundamentalista para Iniciantes | Preço Justo AI",
    seoDescription: "Aprenda análise fundamentalista do zero. Guia completo com exemplos práticos da B3, indicadores essenciais e estratégias para encontrar ações subvalorizadas.",
    content: `
# Guia Completo da Análise Fundamentalista para Iniciantes

A análise fundamentalista é a base de todo investimento inteligente em ações. Se você quer aprender a avaliar empresas como um profissional e encontrar oportunidades reais na bolsa brasileira, este guia foi feito para você.

## O que é Análise Fundamentalista?

A análise fundamentalista é o método de avaliação de empresas baseado em seus **fundamentos financeiros**. Em vez de olhar apenas para o preço da ação, analisamos:

- **Demonstrações financeiras** (DRE, Balanço Patrimonial, DFC)
- **Indicadores de rentabilidade** (ROE, ROA, Margem Líquida)
- **Indicadores de valuation** (P/L, P/VPA, EV/EBITDA)
- **Qualidade da gestão** e governança corporativa
- **Posição competitiva** no mercado

## Por que a Análise Fundamentalista Funciona?

### 1. Foco no Longo Prazo
Enquanto o mercado pode ser irracional no curto prazo, no longo prazo ele sempre reflete o valor real das empresas.

### 2. Margem de Segurança
Benjamin Graham ensinou que devemos comprar ações por menos do que valem, criando uma margem de segurança.

### 3. Compounding
Investir em empresas de qualidade permite que você se beneficie do crescimento composto dos lucros.

## Os 5 Pilares da Análise Fundamentalista

### 1. Análise da Empresa
- **Modelo de negócio**: Como a empresa ganha dinheiro?
- **Vantagens competitivas**: O que a diferencia dos concorrentes?
- **Gestão**: A administração é competente e alinhada com acionistas?

### 2. Análise do Setor
- **Crescimento do setor**: Está em expansão ou declínio?
- **Competição**: Quantos players existem?
- **Regulamentação**: Há riscos regulatórios?

### 3. Análise Financeira
- **Rentabilidade**: A empresa é lucrativa?
- **Crescimento**: Os lucros estão crescendo?
- **Endividamento**: A dívida está controlada?

### 4. Análise de Valuation
- **P/L (Preço/Lucro)**: A ação está cara ou barata?
- **P/VPA (Preço/Valor Patrimonial)**: Qual o desconto sobre o patrimônio?
- **Dividend Yield**: Qual o retorno em dividendos?

### 5. Análise Macroeconômica
- **Cenário econômico**: Como afeta a empresa?
- **Taxa de juros**: Impacto no custo de capital
- **Câmbio**: Para empresas exportadoras/importadoras

## Principais Indicadores Fundamentalistas

### Indicadores de Rentabilidade

#### ROE (Return on Equity)
**Fórmula**: Lucro Líquido ÷ Patrimônio Líquido

O ROE mede a capacidade da empresa de gerar lucro com o capital dos acionistas.
- **Excelente**: > 20%
- **Bom**: 15-20%
- **Razoável**: 10-15%
- **Ruim**: < 10%

#### ROA (Return on Assets)
**Fórmula**: Lucro Líquido ÷ Ativo Total

Mede a eficiência da empresa em usar seus ativos para gerar lucro.

#### Margem Líquida
**Fórmula**: Lucro Líquido ÷ Receita Líquida

Indica quanto da receita se converte em lucro.

### Indicadores de Valuation

#### P/L (Preço/Lucro)
**Fórmula**: Preço da Ação ÷ Lucro por Ação

Indica quantos anos você levaria para recuperar o investimento se a empresa mantivesse o lucro atual.

#### P/VPA (Preço/Valor Patrimonial)
**Fórmula**: Preço da Ação ÷ Valor Patrimonial por Ação

Mostra se você está pagando mais ou menos que o valor contábil da empresa.

#### EV/EBITDA
**Fórmula**: Enterprise Value ÷ EBITDA

Múltiplo que considera a dívida da empresa, útil para comparar empresas com estruturas de capital diferentes.

## Como Aplicar na Prática

### Passo 1: Screening Inicial
Use filtros básicos para encontrar empresas interessantes:
- ROE > 15%
- P/L entre 5 e 20
- Dívida Líquida/EBITDA < 3
- Crescimento de receita positivo

### Passo 2: Análise Qualitativa
- Leia os relatórios anuais
- Entenda o modelo de negócio
- Avalie a gestão e governança
- Analise a posição competitiva

### Passo 3: Análise Quantitativa
- Calcule os indicadores principais
- Compare com concorrentes
- Analise a evolução histórica
- Faça projeções conservadoras

### Passo 4: Valuation
Use diferentes métodos:
- **Múltiplos**: P/L, P/VPA, EV/EBITDA
- **Fluxo de Caixa Descontado**: Para empresas estáveis
- **Dividend Discount Model**: Para pagadoras de dividendos

### Passo 5: Decisão de Investimento
- Compare o preço atual com seu valor estimado
- Considere a margem de segurança (mínimo 20%)
- Avalie o risco vs. retorno
- Defina sua posição na carteira

## Erros Comuns de Iniciantes

### 1. Focar Apenas no P/L
O P/L isolado não diz nada. Uma empresa com P/L 5 pode estar cara se estiver em declínio.

### 2. Ignorar a Qualidade
Não adianta comprar uma empresa barata se ela tem problemas estruturais.

### 3. Não Diversificar
Concentrar tudo em uma ação ou setor é receita para o desastre.

### 4. Seguir Dicas
Análise fundamentalista exige estudo próprio. Não siga dicas cegas.

### 5. Impaciência
Resultados da análise fundamentalista aparecem no médio/longo prazo.

## Ferramentas Essenciais

### Sites Gratuitos
- **CVM**: Demonstrações oficiais
- **B3**: Dados das empresas listadas
- **Fundamentus**: Indicadores básicos

### Plataformas Profissionais
- **Bloomberg**: Para análises avançadas
- **Economática**: Dados históricos
- **Preço Justo AI**: Análise automatizada com IA

## Setores para Iniciantes

### Bancos
- **Vantagens**: Indicadores padronizados, dividendos
- **Desafios**: Regulamentação, risco de crédito
- **Indicadores-chave**: ROE, Índice de Basileia, Inadimplência

### Utilities (Energia, Saneamento)
- **Vantagens**: Fluxo de caixa previsível, dividendos
- **Desafios**: Regulamentação, capex intensivo
- **Indicadores-chave**: EBITDA, Dívida/EBITDA, Concessões

### Consumo
- **Vantagens**: Fácil de entender, crescimento com economia
- **Desafios**: Competição, sazonalidade
- **Indicadores-chave**: Margem, Market Share, Same Store Sales

## Construindo sua Primeira Carteira

### Diversificação por Setor
- **Bancos**: 20-25%
- **Consumo**: 15-20%
- **Utilities**: 15-20%
- **Commodities**: 10-15%
- **Tecnologia**: 10-15%
- **Outros**: 15-20%

### Critérios de Seleção
1. **ROE consistente** > 15%
2. **P/L razoável** (5-20)
3. **Dívida controlada**
4. **Crescimento sustentável**
5. **Dividendos regulares**

## Acompanhamento da Carteira

### Revisão Trimestral
- Analise os resultados trimestrais
- Compare com suas projeções
- Reavalie a tese de investimento

### Rebalanceamento Anual
- Ajuste os pesos por setor
- Considere novas oportunidades
- Elimine posições que não fazem mais sentido

## Próximos Passos

Agora que você entende os fundamentos, é hora de praticar:

1. **Escolha 3 empresas** de setores diferentes
2. **Faça a análise completa** seguindo este guia
3. **Compare os resultados** com nossos rankings
4. **Monitore por 6 meses** para ver como suas análises se comportam

## Conclusão

A análise fundamentalista não é um método infalível, mas é a base mais sólida para investimentos de longo prazo. Com dedicação e prática, você desenvolverá a habilidade de identificar empresas de qualidade negociadas a preços atrativos.

Lembre-se: **tempo no mercado é mais importante que timing do mercado**. Comece hoje mesmo sua jornada como investidor fundamentalista!

---

*Quer acelerar seu aprendizado? Nossa plataforma automatiza grande parte da análise fundamentalista, permitindo que você foque no que realmente importa: a decisão de investimento.*
`
  },
  {
    id: 2,
    slug: "formula-benjamin-graham-acoes-baratas",
    title: "Fórmula de Benjamin Graham: Como Encontrar Ações Baratas",
    excerpt: "Entenda os critérios do pai do value investing e como aplicá-los para encontrar empresas subvalorizadas na bolsa brasileira.",
    category: "Estratégias",
    readTime: "12 min",
    publishDate: "2025-01-03",
    author: "Equipe Preço Justo AI",
    tags: ["Benjamin Graham", "value investing", "fórmula de Graham", "ações baratas", "estratégias"],
    seoTitle: "Fórmula de Benjamin Graham: Encontre Ações Baratas na B3 | Preço Justo AI",
    seoDescription: "Aprenda a fórmula original de Benjamin Graham para encontrar ações subvalorizadas. Critérios práticos, exemplos da B3 e como aplicar o value investing.",
    content: `
# Fórmula de Benjamin Graham: Como Encontrar Ações Baratas

Benjamin Graham, conhecido como o "pai do value investing", desenvolveu critérios objetivos para identificar ações subvalorizadas. Sua metodologia influenciou gerações de investidores, incluindo Warren Buffett.

## Quem Foi Benjamin Graham?

Benjamin Graham (1894-1976) foi um economista e investidor americano que revolucionou a análise de investimentos. Suas principais contribuições:

- **"Security Analysis" (1934)**: Livro fundamental sobre análise de investimentos
- **"The Intelligent Investor" (1949)**: Guia clássico para investidores individuais
- **Professor de Warren Buffett** na Columbia University
- **Criador do conceito de "Margem de Segurança"**

## Os Princípios Fundamentais de Graham

### 1. Margem de Segurança
Compre ações por significativamente menos que seu valor intrínseco para se proteger contra erros de análise.

### 2. Mr. Market
O mercado é como uma pessoa bipolar que ora oferece preços muito altos, ora muito baixos. Aproveite sua irracionalidade.

### 3. Análise Quantitativa
Use critérios objetivos e mensuráveis, não opiniões ou sentimentos.

### 4. Diversificação
Distribua o risco entre várias ações que atendam aos critérios.

## A Fórmula Original de Graham

Graham desenvolveu uma fórmula matemática para calcular o valor intrínseco de uma ação:

### Fórmula Básica
**Valor Intrínseco = √(22.5 × LPA × VPA)**

Onde:
- **LPA** = Lucro por Ação dos últimos 12 meses
- **VPA** = Valor Patrimonial por Ação
- **22.5** = Constante (15 × 1.5, representando P/L máximo de 15 e P/VPA máximo de 1.5)

### Interpretação
- Se o **preço atual < valor intrínseco**: Ação potencialmente subvalorizada
- Se o **preço atual > valor intrínseco**: Ação potencialmente sobrevalorizada

## Os 7 Critérios Clássicos de Graham

### 1. Tamanho Adequado da Empresa
- **Receita anual > $100 milhões** (ajustado para inflação: ~R$ 2 bilhões hoje)
- **Objetivo**: Evitar empresas muito pequenas e voláteis

### 2. Posição Financeira Forte
- **Ativo Circulante ≥ 2 × Passivo Circulante**
- **Dívida de Longo Prazo ≤ Ativo Circulante**
- **Objetivo**: Garantir solidez financeira

### 3. Estabilidade dos Lucros
- **Lucro positivo nos últimos 10 anos**
- **Objetivo**: Evitar empresas cíclicas ou em dificuldades

### 4. Histórico de Dividendos
- **Dividendos pagos nos últimos 20 anos**
- **Objetivo**: Evidência de geração consistente de caixa

### 5. Crescimento dos Lucros
- **Crescimento mínimo de 33% nos últimos 10 anos** (3% ao ano)
- **Objetivo**: Empresas em crescimento sustentável

### 6. P/L Moderado
- **P/L ≤ 15**
- **Objetivo**: Não pagar caro demais pelos lucros

### 7. P/VPA Razoável
- **P/VPA ≤ 1.5**
- **Preferencialmente P/L × P/VPA ≤ 22.5**
- **Objetivo**: Não pagar muito acima do valor contábil

## Adaptação para o Mercado Brasileiro

### Ajustes Necessários

#### 1. Tamanho da Empresa
- **Receita > R$ 1 bilhão** (mercado menor que o americano)
- **Market Cap > R$ 500 milhões**

#### 2. Histórico Mais Curto
- **Lucros positivos nos últimos 5 anos** (mercado mais jovem)
- **Dividendos nos últimos 5 anos**

#### 3. Múltiplos Ajustados
- **P/L ≤ 20** (prêmio de risco país)
- **P/VPA ≤ 2.0** (inflação histórica)

## Aplicação Prática na B3

### Passo 1: Screening Inicial

Filtros Básicos:
- Market Cap > R$ 500 milhões
- P/L entre 3 e 20
- P/VPA < 2.0
- ROE > 10%
- Liquidez > R$ 1 milhão/dia

### Passo 2: Análise Financeira
Para cada empresa filtrada, verifique:

#### Solidez Financeira
- **Liquidez Corrente > 1.5**
- **Dívida Líquida/EBITDA < 3**
- **Margem Líquida > 5%**

#### Qualidade dos Lucros
- **ROE consistente > 15%**
- **Crescimento de receita > 5% ao ano**
- **Payout ratio entre 20-60%**

### Passo 3: Cálculo do Valor Intrínseco

#### Exemplo Prático: Itaú (ITUB4)
\`\`\`
Dados hipotéticos:
- **LPA**: R$ 3.50
- **VPA**: R$ 25.00
- **Preço Atual**: R$ 28.00
\`\`\`

**Valor Intrínseco = √(22.5 × 3.50 × 25.00) = √1.968,75 = R$ 44.37**

**Análise**: Com preço de R$ 28.00 vs. valor intrínseco de R$ 44.37, a ação estaria **37% subvalorizada**.

## Limitações da Fórmula de Graham

### 1. Mercados Eficientes
Hoje é mais difícil encontrar ações obviamente baratas.

### 2. Empresas de Crescimento
A fórmula penaliza empresas de alto crescimento que reinvestem lucros.

### 3. Ativos Intangíveis
Não considera adequadamente marcas, patentes e outros intangíveis.

### 4. Setores Específicos
Não funciona bem para bancos, seguradoras e empresas de tecnologia.

## Evolução: Graham Moderno

### Critérios Adicionais
- **Qualidade da gestão**
- **Vantagens competitivas (moats)**
- **Crescimento sustentável**
- **Governança corporativa**

### Múltiplos Alternativos
- **EV/EBITDA** para empresas endividadas
- **P/FCF** (Preço/Fluxo de Caixa Livre)
- **PEG Ratio** para empresas em crescimento

## Estratégia de Implementação

### Carteira Graham Clássica

#### Composição
- **15-30 ações** que atendem aos critérios
- **Diversificação por setor**
- **Rebalanceamento anual**

#### Critérios de Entrada
1. **Passa em todos os 7 critérios clássicos**
2. **Valor intrínseco > 1.3 × preço atual** (margem de segurança de 30%)
3. **Setor não representa > 25% da carteira**

#### Critérios de Saída
1. **Preço > valor intrínseco**
2. **Deterioração dos fundamentos**
3. **Melhor oportunidade disponível**

## Resultados Históricos

### Performance da Estratégia Graham
- **Retorno médio**: 15-20% ao ano (estudos americanos)
- **Volatilidade**: Menor que o mercado
- **Drawdown máximo**: Limitado pela diversificação

### Casos de Sucesso no Brasil
- **Bancos em 2016**: Após crise, múltiplos comprimidos
- **Utilities em 2018**: Após mudanças regulatórias
- **Consumo em 2020**: Durante pandemia

## Ferramentas para Aplicar Graham

### Screening Automático
Nossa plataforma aplica os critérios de Graham automaticamente:
- **Filtros pré-configurados**
- **Cálculo do valor intrínseco**
- **Ranking por margem de segurança**
- **Alertas de oportunidades**

### Planilhas Manuais
Para quem prefere fazer na mão:
- **Lista dos critérios**
- **Fórmulas do Excel**
- **Fontes de dados confiáveis**

## Erros Comuns ao Aplicar Graham

### 1. Aplicar Cegamente
Os critérios são um ponto de partida, não uma receita infalível.

### 2. Ignorar o Contexto
Uma empresa pode atender aos critérios mas estar em declínio estrutural.

### 3. Não Diversificar
Concentrar em poucas ações aumenta o risco desnecessariamente.

### 4. Impaciência
A estratégia funciona no longo prazo, não em meses.

## Graham vs. Buffett: A Evolução

### Graham (Value Clássico)
- **Foco**: Preço baixo
- **Critério**: Múltiplos baratos
- **Horizonte**: 2-3 anos
- **Diversificação**: Alta (20-30 ações)

### Buffett (Quality Value)
- **Foco**: Qualidade + preço razoável
- **Critério**: Vantagens competitivas
- **Horizonte**: 10+ anos
- **Concentração**: Baixa (5-10 ações)

## Conclusão

A fórmula de Benjamin Graham continua relevante como ponto de partida para encontrar ações subvalorizadas. Embora o mercado tenha evoluído, os princípios fundamentais permanecem válidos:

1. **Compre com margem de segurança**
2. **Foque em empresas sólidas**
3. **Diversifique adequadamente**
4. **Seja paciente**

A chave é adaptar os critérios ao contexto atual, combinando a disciplina quantitativa de Graham com análises qualitativas modernas.

---

*Nossa plataforma automatiza a aplicação dos critérios de Graham, permitindo que você encontre rapidamente as melhores oportunidades do mercado brasileiro.*
`
  },
  {
    id: 3,
    slug: "dividend-yield-renda-passiva-sustentavel",
    title: "Dividend Yield: Construindo Renda Passiva com Ações",
    excerpt: "Aprenda a identificar empresas que pagam bons dividendos de forma sustentável e evite as temidas dividend traps.",
    category: "Renda Passiva",
    readTime: "10 min",
    publishDate: "2025-01-15",
    author: "Equipe Preço Justo AI",
    tags: ["dividend yield", "dividendos", "renda passiva", "dividend trap", "investimentos"],
    seoTitle: "Dividend Yield: Como Construir Renda Passiva Sustentável | Preço Justo AI",
    seoDescription: "Guia completo sobre dividend yield: como identificar boas pagadoras de dividendos, evitar dividend traps e construir renda passiva sustentável na B3.",
    content: `
# Dividend Yield: Construindo Renda Passiva com Ações

Investir em ações que pagam dividendos é uma das estratégias mais eficazes para construir renda passiva. Mas cuidado: nem todo dividend yield alto é uma boa oportunidade. Aprenda a separar o joio do trigo.

## O que é Dividend Yield?

**Dividend Yield (DY)** é o percentual que os dividendos representam em relação ao preço da ação:

### Fórmula
**DY = (Dividendos por Ação ÷ Preço da Ação) × 100**

### Exemplo
- **Ação**: R$ 50,00
- **Dividendos anuais**: R$ 4,00
- **DY**: (4 ÷ 50) × 100 = **8%**

## Por que Investir em Dividendos?

### 1. Renda Passiva Regular
Receba dinheiro periodicamente sem precisar vender ações.

### 2. Proteção Contra Inflação
Empresas de qualidade tendem a aumentar dividendos acima da inflação.

### 3. Disciplina de Gestão
Empresas que pagam dividendos são forçadas a manter disciplina financeira.

### 4. Menor Volatilidade
Ações pagadoras de dividendos tendem a ser menos voláteis.

### 5. Reinvestimento Automático
Dividendos podem ser reinvestidos para acelerar o crescimento do patrimônio.

## O Perigo das Dividend Traps

### O que são Dividend Traps?
São empresas com **dividend yield artificialmente alto** devido à queda no preço da ação, geralmente causada por:

- **Deterioração dos fundamentos**
- **Corte iminente de dividendos**
- **Problemas estruturais do negócio**

### Exemplo de Dividend Trap
Uma empresa que pagava R$ 2,00 de dividendos com ação a R$ 25,00 (DY = 8%) vê sua ação cair para R$ 10,00. O DY aparente sobe para 20%, mas a empresa pode não conseguir manter os dividendos.

## Como Identificar Dividend Traps

### Sinais de Alerta

#### 1. DY Muito Alto (>12% no Brasil)
DY extremamente alto pode indicar que o mercado espera corte de dividendos.

#### 2. Payout Ratio Insustentável
**Payout Ratio = Dividendos ÷ Lucro Líquido**
- **Seguro**: < 60%
- **Atenção**: 60-80%
- **Perigoso**: > 80%

#### 3. Lucros em Declínio
Se os lucros estão caindo consistentemente, os dividendos podem ser cortados.

#### 4. Endividamento Crescente
Empresas muito endividadas podem cortar dividendos para reduzir dívidas.

#### 5. Fluxo de Caixa Negativo
Se a empresa não gera caixa suficiente, pode estar pagando dividendos com dívida.

## Critérios para Boas Pagadoras de Dividendos

### 1. Consistência Histórica
- **Dividendos pagos nos últimos 5+ anos**
- **Crescimento ou estabilidade dos pagamentos**
- **Sem cortes significativos**

### 2. Fundamentos Sólidos
- **ROE > 15%** (rentabilidade consistente)
- **Margem líquida > 10%** (eficiência operacional)
- **Crescimento de receita estável**

### 3. Posição Financeira Forte
- **Dívida líquida/EBITDA < 3**
- **Liquidez corrente > 1.2**
- **Geração de caixa positiva**

### 4. Payout Sustentável
- **Payout ratio entre 40-70%**
- **Permite reinvestimento no negócio**
- **Margem para crescer dividendos**

### 5. Negócio Defensivo
- **Demanda estável ou crescente**
- **Pouca ciclicalidade**
- **Vantagens competitivas**

## Setores Tradicionalmente Bons para Dividendos

### 1. Utilities (Energia Elétrica, Saneamento)
**Vantagens:**
- Fluxo de caixa previsível
- Demanda inelástica
- Regulamentação estável

**Exemplos:** TAEE11, CMIG4, SABESP

**DY Típico:** 6-10%

### 2. Bancos
**Vantagens:**
- Obrigação regulatória de distribuir lucros
- Modelo de negócio maduro
- Dividendos trimestrais

**Exemplos:** ITUB4, BBDC4, BBAS3

**DY Típico:** 8-12%

### 3. Seguradoras
**Vantagens:**
- Geração de caixa consistente
- Float para investimentos
- Crescimento com economia

**Exemplos:** BBSE3, PSSA3, IRBR3

**DY Típico:** 5-8%

### 4. Telecomunicações
**Vantagens:**
- Receita recorrente
- Infraestrutura estabelecida
- Fluxo de caixa estável

**Exemplos:** VIVT3, TIMS3

**DY Típico:** 6-9%

## Estratégias de Investimento em Dividendos

### 1. Dividend Growth Investing
Foque em empresas que **crescem os dividendos** consistentemente, mesmo que o DY inicial seja menor.

**Critérios:**
- Crescimento de dividendos > inflação
- Payout ratio conservador (< 60%)
- Negócio em expansão

### 2. High Dividend Yield
Busque empresas com **DY alto mas sustentável**.

**Critérios:**
- DY entre 8-12%
- Fundamentos sólidos
- Histórico de pagamentos

### 3. Dividend Aristocrats Brasileiros
Empresas que **aumentaram dividendos por 10+ anos consecutivos**.

**Exemplos históricos:**
- Taesa (TAEE11)
- Engie (EGIE3)
- Klabin (KLBN11)

## Construindo uma Carteira de Dividendos

### Diversificação por Setor
- **Utilities**: 30-40%
- **Bancos**: 25-30%
- **Consumo**: 15-20%
- **Telecomunicações**: 10-15%
- **Outros**: 10-15%

### Critérios de Seleção
1. **DY > 6%** (atrativo no Brasil)
2. **Payout ratio < 70%**
3. **ROE > 15%**
4. **Dívida controlada**
5. **Histórico de 5+ anos**

### Exemplo de Carteira
| Ação | Setor | DY | Peso |
|------|-------|----|----- |
| TAEE11 | Utilities | 9.5% | 15% |
| ITUB4 | Bancos | 10.2% | 15% |
| BBDC4 | Bancos | 9.8% | 15% |
| VIVT3 | Telecom | 8.1% | 10% |
| CMIG4 | Utilities | 8.7% | 10% |
| BBSE3 | Seguros | 7.3% | 10% |
| KLBN11 | Papel | 6.8% | 10% |
| EGIE3 | Utilities | 7.9% | 10% |
| CPLE6 | Utilities | 8.4% | 5% |

**DY Médio da Carteira:** ~8.7%

## Timing para Investir em Dividendos

### Data Ex-Dividendos
- **Data Ex**: Último dia para ter direito aos dividendos
- **Estratégia**: Compre antes da data ex para receber os dividendos

### Sazonalidade
- **1º Trimestre**: Muitas empresas definem política de dividendos
- **2º Trimestre**: Pagamento de dividendos do ano anterior
- **4º Trimestre**: Dividendos extraordinários

### Ciclo Econômico
- **Recessão**: DY pode ficar atrativo por queda nos preços
- **Expansão**: Crescimento dos dividendos
- **Juros Altos**: Dividendos competem com renda fixa

## Tributação de Dividendos no Brasil

### Regra Atual (2024)
- **Dividendos**: Isentos de IR para pessoa física
- **JCP (Juros sobre Capital Próprio)**: 15% de IR na fonte

### Possíveis Mudanças
Fique atento a propostas de tributação de dividendos que podem afetar a estratégia.

## Reinvestimento de Dividendos

### Estratégia de Reinvestimento
1. **Acumule dividendos** até ter valor significativo
2. **Reinvista na mesma ação** se ainda atrativa
3. **Diversifique** comprando outras ações
4. **Rebalanceie** a carteira periodicamente

### Poder do Juros Compostos
Com reinvestimento, uma carteira com DY de 8% pode dobrar de valor em ~9 anos, considerando crescimento dos dividendos.

## Monitoramento da Carteira

### Indicadores Mensais
- **Dividendos recebidos**
- **DY sobre preço médio**
- **Performance vs. CDI**

### Revisão Trimestral
- **Resultados das empresas**
- **Mudanças no payout**
- **Guidance de dividendos**

### Revisão Anual
- **Rebalanceamento por setor**
- **Substituição de posições fracas**
- **Ajuste de estratégia**

## Ferramentas para Investir em Dividendos

### Nossa Plataforma
- **Ranking por DY sustentável**
- **Filtros anti-dividend trap**
- **Projeção de dividendos**
- **Alertas de pagamento**

### Outras Ferramentas
- **Fundamentus**: DY histórico
- **Status Invest**: Calendário de dividendos
- **B3**: Dados oficiais

## Erros Comuns em Dividendos

### 1. Focar Apenas no DY
DY alto sem sustentabilidade é armadilha.

### 2. Não Diversificar
Concentrar em um setor aumenta o risco.

### 3. Ignorar o Crescimento
Empresas que não crescem podem cortar dividendos.

### 4. Timing Errado
Comprar apenas na data ex pode ser caro.

### 5. Não Reinvestir
Deixar dividendos parados perde o poder dos juros compostos.

## Conclusão

Investir em dividendos é uma estratégia sólida para construir renda passiva, mas exige disciplina e análise cuidadosa. Os pontos-chave são:

1. **Foque na sustentabilidade**, não apenas no DY alto
2. **Diversifique por setores** e empresas
3. **Reinvista os dividendos** para acelerar o crescimento
4. **Monitore regularmente** os fundamentos
5. **Seja paciente** - resultados aparecem no longo prazo

Com a estratégia correta, é possível construir uma carteira que gere renda passiva crescente e superior à inflação.

---

*Nossa plataforma identifica automaticamente as melhores oportunidades de dividend yield, filtrando dividend traps e destacando empresas com pagamentos sustentáveis.*
`
  }
]

// Importar posts adicionais
import { additionalBlogPosts } from './blog-data-extended'

// Combinar todos os posts
const allBlogPosts = [...initialBlogPosts, ...additionalBlogPosts]

// Exportar lista completa
export { allBlogPosts as blogPosts }

export const categories = [
  { name: "Todos", count: 8 },
  { name: "Educação", count: 3 },
  { name: "Estratégias", count: 2 },
  { name: "Renda Passiva", count: 1 },
  { name: "Tecnologia", count: 1 },
  { name: "Análise Setorial", count: 1 }
]

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return allBlogPosts.find((post: BlogPost) => post.slug === slug)
}

export function getBlogPostsByCategory(category: string): BlogPost[] {
  if (category === "Todos") return allBlogPosts
  return allBlogPosts.filter((post: BlogPost) => post.category === category)
}

export function getFeaturedPost(): BlogPost | undefined {
  return allBlogPosts.find((post: BlogPost) => post.featured)
}
