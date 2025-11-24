Rever UX/UI da carteira, backtest e ranking conforme abaixo e depois fazer uma seção por ativo 100% dedicado a análise técnica com predição de preço por ia do range de preço que deve ficar nos próximos meses (com projeções) e o melhor preço pra compra. Disclaimer para indicar que o preço não é para trade é sim para investimento de longo prazo, dando prioridade para investir em empresas de qualidade 

Estou refatorando a UX/UI do módulo de Carteiras ("/carteira") da minha aplicação Next.js (PreçoJustoAI). É uma refatoração de fluxo e experiência UI/UX, com exceção do campo de smart paste para o input das transações com IA, todo o resto já existe e deve ser considerado a melhor forma de encaixar todas as features existentes do "/carteira" nesse novo fluxo.

Outro ponto que quero rever na feature de carteira é as transações sugeridas (aqui precisamos ver o backend tambem). Não quero que exista mais transações pendentes, confirmadas e rejeitadas. As transações de compra ou rebalanceamento devem serem sugeridas sem salvas nenhuma transação no banco, a confirmação deve abrir uma boleta de transação onde é feito o lançamento manualmente (com os valores ja preenchidos). Essas transações devem ser geradas de acordo com cada modificação ou de rebalanceamento, para evitar que seja gerado toda hora novas sugestões, as sugestões de compra devem ser geradas enquanto houver saldo em caixa (caixa positivo) e as de rebalanceamneto devem ser geradas até atingir o rebalanceamento ideal da carteira (aceitando um desvio de até 1% em cada ativo).


1. Rota: Listagem e Seleção (/carteira)
Esta é a porta de entrada. O objetivo aqui é Clareza e Educação.

Layout Geral:

Topo (Hero Banner): Um banner dispensável (com um "X" sutil) mas visualmente rico.

Copy: "Aprenda a trazer seus dados históricos em 5 minutos."

Ação: Ao clicar, leva para /app/tutorial ou abre um Slide-over lateral com o vídeo e o passo-a-passo em texto (checklist).

Grid de Carteiras: Cards visuais mostrando: Nome da Carteira, Patrimônio Atual e Variação do Dia (se houver dados).

Paginação: Infinite scroll ou botões "Próximo/Anterior" se passar de 6-8 carteiras.

Estado Vazio (Zero Data State):

Se o usuário não tem carteiras, nada de tabela vazia.

Componente: Uma ilustração central de alta qualidade (svg).

CTA Primário: Botão grande e contrastante: "Criar minha primeira Carteira".

Microcopy: "Organize seus ativos da B3 e receba recomendações de IA."

No grid de carteiras podemos ter opções de ações rapidas como lançar transações, ver métricas e etc, cada uma ja vai direto para uma área especifica da carteira. Precisamos facilitar a manutenção e acesso da carteira que hoje está em uma unica tela muito poluida.

2. Rota: Criação de Carteira (/carteira/nova)
Mudança Chave: Saída do Modal -> Entrada de Página Dedicada. Isso dá peso à decisão de começar um investimento.

Layout (Formulário Fluido):

Não use um "Wizard" (passo a passo bloqueante). Use um formulário vertical de rolagem suave, dividido em seções claras.

Seção 1: Identidade: Nome da Carteira, Descrição (opcional).

Seção 2: Estratégia (Opcional): Aporte Mensal Planejado.

Seção 3: Alocação de Ativos (O "Wow" Factor):

Default: Vazio.

Botão IA: "Gerar alocação sugerida com IA". Ao clicar, ele preenche os percentuais baseados num perfil conservador/moderado/arrojado (selecionável).

Nota: Deixe claro que isso pode ser editado depois na aba "Configurações".

Sticky Footer (Mobile & Desktop): O botão "Criar Carteira" fica fixo no rodapé da tela para estar sempre acessível.

3. Rota: Detalhe da Carteira (/carteira/[id])
Aqui ocorre a mágica. Esta página deve ter dois estados de visualização baseados em dados.

A. A "Smart Input Zone" (O Topo da Página)
Conforme seu requisito, a entrada de dados é a protagonista.

Design: Um card expandido no topo, estilo "Composer" (como o post do Twitter/LinkedIn, mas anabolizado).

Título: "Atualizar Custódia / Importar Transações".

Tabs de Entrada:

"Texto Inteligente/CSV" (Default): O campo de texto grande (textarea) com Smart Paste.

"Upload de Nota (PDF)": Área de drag & drop.

"Manual": O formulário clássico (Data, Ticker, Qtd, Preço), mas escondido numa tab para não assustar.

Comportamento (A "Staging Area"):

Ao colar o texto ou soltar o arquivo, o card se expande revelando uma Tabela de Pré-visualização.

O usuário valida as linhas e clica em "Processar Transações".

Sucesso: Confetti + Atualização dos gráficos abaixo.

B. O Dashboard (Abaixo do Input)
Após a área de input, o conteúdo se adapta:

Resumo Financeiro: Patrimônio Total, Lucro/Prejuízo, Dividendos Recebidos.

Aba de Recomendações (O "Smart Advisor"):

Esta seção ganha destaque se houver cash disponível ou desbalanceamento.

Visual: Um card com borda dourada ou verde.

Mensagem: "Você tem R$ 1.000,00 em caixa. Para manter sua estratégia, sugerimos comprar: [Lista de Ativos]."

Ação: Botão "Simular Compra" (que joga esses ativos para o input ou apenas registra a intenção).

Gráficos e Análises: (Mantenha o que já existe: pizza de alocação, evolução histórica, etc.).

Configurações (Aba ou Botão): Um local discreto (canto superior direito ou aba final) para editar as alocações definidas na criação.

4. Adaptação Mobile (Responsividade)
Input Zone: No mobile, o "Smart Input" no topo pode ocupar muito espaço.

Solução: Transforme-o em um Botão Flutuante (FAB) ou uma barra inferior persistente escrito "Adicionar Transação/Nota". Ao clicar, sobe um Bottom Sheet (gaveta) que ocupa 90% da tela com a área de input.

Rebalanceamento: Cards de recomendação aparecem logo abaixo do saldo total, com rolagem horizontal se houver mais de uma sugestão.

Tabelas: Tabelas de ativos (listagem) devem esconder colunas menos importantes no mobile (ex: preço médio) e focar em: Ticker | Qtd | Valor Atual | % Variação.

---

CONTEXTO:
A aplicação é focada em investidores de renda variável (B3). O usuário precisa de facilidade para importar dados (notas de corretagem/CSV) e clareza sobre o rebalanceamento da carteira. Como não temos integração com a B3, o foco da refatoração tá em facilitar o lançamento de transações na carteira simplificando ao máximo e criando o momento aha. Precisamos refatorar a UX/UI deixando a interface mais simples e intuitiva para o usuário final mas sem remover nenhuma feature existente

OBJETIVOS DA REFATORAÇÃO:

1. PÁGINA DE LISTAGEM (/carteira):
- Criar visualização em Cards (Grid).
- Se lista vazia: Mostrar Empty State com ilustração e CTA forte para criar.
- Banner no topo (dismissible): "Tutorial: Importe seus dados em 5 min" (link p/ página de vídeo).

2. PÁGINA DE CRIAÇÃO (/carteira/nova):
- Migrar de Modal de criação de carteira para Página inteira.
- Campos: Nome, Descrição, Aporte Mensal.
- Feature "Alocação Inteligente": Botão que usa IA para sugerir % de alocação nos ativos (opcional), já temos algo assim na modal de criação, ver como tá implementado.

3. PÁGINA DE DETALHE (/carteira/[id]):
- SEÇÃO HERO (Prioridade Máxima): Componente de Input de Dados. Deve aceitar colar texto (CSV/Copy-paste) ou Upload de documentos como Nota de Corretagem. Ao receber dados, deve mostrar preview (Staging Area) da transações antes de salvar (já temos um comportamente na tela de carteira que já faz algo muito similar a isso com IA, seria uma evolução)
- DASHBOARD: Exibir métricas após o input.
- FEATURE REBALANCEAMENTO: Componente de destaque que verifica o saldo em caixa vs. alocação alvo e sugere compras/vendas. Deve ser muito visível (já temos isso bem implementado na página da carteira, precisamos apenas ver como adaptar na nova UX/UI que visa simplificar e despoluir a tela da carteira.
- CONFIGURAÇÕES: Acesso fácil para editar alocações e nome da carteira.

STACK:
- Next.js (App Router)
- Tailwind CSS
- Componentes UI (Shadcn/UI ou similar)
- Ícones (Lucide React)

REQUISITOS TÉCNICOS:
- Tudo deve ser Mobile First.
- O Input de dados deve ser a primeira coisa visível, mas colapsável se o usuário quiser focar na análise.