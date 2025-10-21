<!-- 1. Integação pagamento (mercado pago) e permitr o cancelamento da assinatura a qualquer momento na plataforma; -->
<!-- 2. Criar Central de SUPORTE dentro da APP (controle de ticked) por interface e Chat IA; -->
<!-- Resolve Historcio não carregando no backtest -->
Ao Reverter a transação o cache do front não foi invalidados
Para as sugestões de dividendos, está sendo calculado os dividendos considerando as ações de COMPRA REBALANCEAMENTO o que não faz sentido, deve considerar apenas o que esta em custodio

Melhorar a analsie dos snapshot e disparo de relatorios de mundaça de SCORE. Precisamos manter o historico de snapshots em "asset_snapshots" para cada ativo. Ou seja, quando mudar o score e for gerado uma mudança devemos bater um novo snapshot e salvar como ultimo associado ao score. O relatório gerado para FUNDAMENTAL_CHANGE precisa ficar associado ao SNAPSHOT. Com isso a gente mantem a rastreabilidade de todos os relatorios gerados com as mudanças (o FK pode ser null para não quebrar os relatorios que já foram gerados sem o snapshot associado). O relatorio gerado pela IA deve ser menos prolixo e deve evitar falar de indicadores que praticamente não tiveram oscilações (muito proximo do valor original), deve dar o foco ao analisar realmente o que mudou e o que pode ter mudado o score. Talvez para fazer iss oseja interessante gravar tambem no SNAPSHOT a composição da nota (ver como a tela "/acao/itsa4/entendendo-score" calcula o SCORE). Com a composição da NOTA salva junto com o SNAPSHOT o relatorio conseguira indicar de forma mais clara e com exatidão qual foi o ponto chave que mudou e correlacionar os demais indicadores. O relatorio das mudanças também deve usar uma linguagem fácial e acessivel, pois não estaremos falando necessariamente com alguem técnico.

Uma coluna extra para as posições atuais que mostre o Retorno c/ Dividendos (Que ira considerar o que o ativo pagou tambem de dividendos)
Permitir incluir transações por linguagem natural:
- Ex: cadastre uma compra de PETR4 no valor total de 1000 e 30 ações 
> Resultado: transação de compra de ATIVO para PETR4 no valor de 1000, quantidade de 30 a um preço médio de 33,33 
- Ex: cadastre dividendo sintetico com venda de opções de CALL para PETR4 no valor de 99  
> Resultado: cadastro de transação de dividendo no valor de 99 para PETR4 com uma observação extraida para dividendos sintetico
- Ex: saque de 5000 reais
> Resultado: transação de saque do caixa de 5000 reais se houver dinheiro em caixa suficiente, se não houver não aceitar a trasação
- Ex aporte de 2000 com observação de dinheiro de renda extra
> Resultado: transação de aporte no valor de 2000, registrando a observação detalhada
- Ex: venda de 50 PETR4 preço médio 30
> Resultado: transação de venda de 50 PETR4 a um preço médio de 30 (o valor total será calculado)
Pensar em N outras formas de realizar os cadastros com linguagem natural, deve ser usando o LLM do Gemini para cadastrar as transações a partir de linguagemn natural e o LLM deve se adaptar ao pedido e criar as devida transações

A edição das alocações na carteira não esta pratica, o input de numero só aceita o primeiro digito perdendo o foco. Ao incluir um novo ativo com o %, deve alocar o % do ativo e diluir o restante da alocação dos demais ativos proporcionalmente (ao que ja estava)

Drawdown da carteira de ETF em 100% (errado), ver o motivo

Carteira de FII calculou uma transação de rebalanceamento sem gerar um transação de compra de rebalanceamento (sempre deveriam andar juntos a sugestão de venda e compra para rebalancear):
  Venda (Rebal.)
  BTLG11
  17/10/2025
  R$ 620.82
  6 ações
  Rebalanceamento: venda de 6 ações (alocação atual 17.5% > alvo 12.5%)

Ver alguma forma de pegar o pagamento dos dividendos dos FIIs e Ações online


4.  Revisar Footer;
5. Mais conteúdos no BLOG;
6. Parceiro estratégico para dandos (além do BRAPI);
7. Buscar sócio (de preferencia com CNPI para autoridade);