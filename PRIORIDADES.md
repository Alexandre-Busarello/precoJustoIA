<!-- 1. Integação pagamento (mercado pago) e permitr o cancelamento da assinatura a qualquer momento na plataforma; -->
<!-- 2. Criar Central de SUPORTE dentro da APP (controle de ticked) por interface e Chat IA; -->
<!-- Resolve Historcio não carregando no backtest -->

Usuario Gratuito pode fazer backtest apenas com PETR4 e VALE3. A simulação não é salva no banco e fica disponivel apenas na interface, saiu da tela não volta mais

Integrar Redis

Carteira:
- Deve ser possível criar a partir de um backtest ou individualmente (adicionando os ativos via ranking ou pagina do ativo);
- Deve ser possível criar um backtest a partir de uma carteira também;
- Funcionamento da carteira:
- Ela terá uma interface similar ao backtest, onde será definido os ativos que fazem parte da carteira bem com a alocação em cada um e qual é o aporte estimado por mês. A diferença principal para o Backtest é que ela será orientada pelas transações. No bnacktest as transações são calculadas historicamente, ja ná carteira as transações são sugeridas mês a mês. Conforme o usuario for entranda na plataforma, é visto a última vez que foi gerado uma transação e é sugerido todos os meses faltantes com base na data de inicio da carteira.
Quai são as transações que podem ser recomendas?
Similar ao backtest, teremos transações: 
- Crédito Caixa, que será o crédito no caixa dos aportes;
- Aporte, que são as compras dos ativos gerando débitos no Caixa;
- Venda (Rebal.), são vendas para rebalanceamento que geram créditos em caixa;
- Compra (Rebal.), são compras que precisam ser feitas quando tem as vendas de rebalanceamento;
Todas essas transações serão sugeridas automaticamente pela plataforma com base na alocação fornecida, se a plataforma entender que precisa vender algo para rebalancear (sempre com base no ultimo preço disponivel do ativo em daily_quote) será sugerido já as transações e o usuario deve ir confirmando cada uma. Se o aporte por mês configurado for de 1000 por exemplo, todo mês será ja sugerido essa transação onde o usuario pode ir lá e confirma (indicando o valor do aporte). O usuario deve sempre poder lançar transações manualmente na carteira também. Algumas transações manuais do usuario: as mesmas automaticas mais: 
- Venda (sem Rebalanceamento), é uma venda onde o usuário está realmente tirando o dinheiro da carteira
- Dividendo, para registrar dividendos pago (inicialmente não iremos puxar automaticamente, a não ser que tenha um jeito facil de saber quando uma empresa pagou dividendos).
Com base nas transações que é o coração da carteira todas as demais métricas (similar ao backtest) serão exibidas como, "Volatilidade", "Drawdown Máximo", "Performance por Ativo", "Evolução", "Analise de Risco" e todos os dados disponível em Visão Geral. 
O que a carteira deve ter a mais?
- Grafico de Pizza para ver disversificação da carteira por setor e industria


4.  Revisar Footer;
5. Mais conteúdos no BLOG;
6. Parceiro estratégico para dandos (além do BRAPI);
7. Buscar sócio (de preferencia com CNPI para autoridade);