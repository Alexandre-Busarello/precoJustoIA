# **Funcionalidade: Carteira**

A Carteira é uma ferramenta para acompanhamento e gerenciamento de portfólios de investimentos de forma contínua e orientada a transações.

## **1. Criação e Interoperabilidade**

### **1.1. Métodos de Criação**
A criação de uma carteira será flexível, permitindo ao usuário iniciar de duas maneiras:
- **Individualmente:** O usuário pode criar uma carteira do zero, adicionando ativos manualmente através da página de um ativo específico ou utilizando o sistema de Ranking para encontrá-los.
- **A partir de um Backtest:** Um backtest já realizado pode ser instantaneamente convertido em uma carteira, importando todos os ativos e suas respectivas alocações teóricas como ponto de partida.

### **1.2. Interoperabilidade com Backtest**
A integração entre as ferramentas será de mão dupla:
- **Carteira para Backtest:** Será possível gerar um backtest a partir da composição atual de uma carteira para analisar o desempenho histórico da estratégia adotada.

## **2. Funcionamento e Interface**

A interface da Carteira será visualmente similar à do Backtest, porém, seu núcleo funcional será diferente.

- **Configuração Inicial:** O usuário define os ativos que compõem o portfólio, a alocação percentual desejada para cada um e o valor do **aporte mensal estimado**.
- **Orientada a Transações:** Esta é a principal diferença em relação ao Backtest.
    - No **Backtest**, as transações são calculadas e simuladas com base em dados históricos.
    - Na **Carteira**, as transações são **sugeridas e confirmadas mês a mês** pelo usuário, refletindo as operações reais.
- **Lógica de Sugestão:** A plataforma verifica a data da última transação registrada. Com base na data de início da carteira e na frequência mensal, o sistema sugere todas as transações pendentes (aportes, rebalanceamentos, etc.) para que o usuário as confirme e mantenha a carteira atualizada.

## **3. Gestão de Transações**

As transações são o coração da carteira. Elas podem ser sugeridas automaticamente pela plataforma ou lançadas manualmente pelo usuário.

### **3.1. Transações Sugeridas (Automáticas)**
Com base na alocação-alvo, no aporte mensal configurado e nos preços mais recentes dos ativos (`daily_quote`), a plataforma irá recomendar as seguintes operações, que o usuário deverá confirmar:

- **Crédito Caixa (Aporte Mensal):** Sugestão automática de crédito no caixa da carteira, com base no valor de aporte mensal definido pelo usuário. O usuário pode confirmar ou editar o valor no momento da confirmação.
- **Aporte (Compra):** Com base no saldo em caixa (proveniente dos aportes), sugere a compra dos ativos para atingir ou manter a alocação-alvo.
- **Venda (Rebalanceamento):** Quando um ativo ultrapassa sua alocação-alvo, a plataforma sugere a venda do excedente para gerar caixa.
- **Compra (Rebalanceamento):** Utiliza o caixa gerado pela "Venda (Rebal.)" para comprar ativos que estão abaixo da alocação-alvo.

### **3.2. Transações Manuais**
O usuário terá total liberdade para registrar transações manualmente a qualquer momento, incluindo:

- **Todas as transações automáticas:** O usuário pode se adiantar e lançar aportes, compras ou vendas de rebalanceamento. A venda de relanceamento deve ser sempre em conjunto com uma compra rebalanceamento (no lançamento manual garantir que as duas são lançadas em conjunto)
- **Venda (sem Rebalanceamento):** Permite registrar uma venda onde o capital é retirado da carteira (resgate), diminuindo o patrimônio total gerenciado.
- **Dividendo:** Lançamento manual do recebimento de dividendos ou outros proventos.
    - *Nota: Inicialmente, a importação automática de dividendos não será implementada.*. Devemos recomendar fortemente na interface da carteira que os dividendos sejam registrados e seu valor reinvestido. Quando um dividendo for registrado o caixa será aumentado e as novas compras devem considerar esse valor em caixa.

## **4. Métricas e Análises**

Com base no histórico de transações confirmadas, a Carteira irá calcular e exibir um conjunto completo de métricas e gráficos, de forma similar ao Backtest:

- **Visão Geral:** Todos os dados consolidados da carteira (Patrimônio, Rentabilidade, etc.).
- **Evolução:** Gráfico da evolução do patrimônio ao longo do tempo.
- **Performance por Ativo:** Análise detalhada do desempenho individual de cada ativo dentro da carteira.
- **Análise de Risco:**
    - **Volatilidade:** Medida da oscilação do retorno da carteira.
    - **Drawdown Máximo:** Análise das piores quedas históricas do portfólio.

## **5. Funcionalidades Adicionais**

Além das métricas já conhecidas do Backtest, a Carteira terá visualizações específicas para a análise de portfólio:

- **Gráfico de Diversificação (Pizza):**
    - **Por Setor:** Visualização da alocação da carteira entre os diferentes setores da economia.
    - **Por Indústria:** Detalhamento da alocação por indústrias dentro de cada setor.

## **6. Mudança de ativos na carteira**

O usuario pode a qualquer momento alterar a quantidade de alocação dos ativos ou adicionar e remover ativos da configuração. O sistema deve conseguir gerenciar isso, caso um ativo seja excluido automaticamente deve ser sugerida uma transação de venda (se o usuario tiver ativos em custodia) para rebalancear a carteira. O mesmo vale para o % de alocações.

Um usuario deve poder excluir transações e o sistema deve se auto gerenciado evitando transações que não façam sentido e avisando o porque, mas o usuário sempre deve ter como consertar algo nas suas transações, seja valores, quantidades dos ativos comprados, preço médio da operação, ou até mesmo removendo operações.

VOCE DEVE AVALIAR BEM A FEATURE DE BACKTEST QUE TERÁ MUITO DELA NA FEATURE DA CARTEIRA