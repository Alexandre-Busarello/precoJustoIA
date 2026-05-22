## MODIFIED Requirements

### Requirement: Seleção de classe de ativo dentro do wizard
O sistema SHALL apresentar a seleção de classe de ativo como o Step 2b do fluxo wizard de criação de ranking, em vez de uma página hub independente em `/ranking` sem parâmetros. As quatro opções de classe de ativo (B3, BDR, Ambos, FII) SHALL ser exibidas como cards visuais com ícone, nome e descrição curta. Disponível para todos os tiers (FREE e PREMIUM).

#### Scenario: Exibição dos cards de seleção de ativo no wizard
- **WHEN** o usuário avança do Step 1 escolhendo "Criar novo ranking"
- **THEN** o wizard exibe o Step 2b com quatro cards de seleção: "Ações B3", "BDRs", "B3 + BDRs", "FIIs"

#### Scenario: Seleção de classe de ativo
- **WHEN** o usuário clica em um card de classe de ativo
- **THEN** o card é marcado como selecionado visualmente (borda colorida, check) e o botão "Continuar" é habilitado

#### Scenario: Avanço ao Step 3 após seleção
- **WHEN** o usuário clica em "Continuar" após selecionar uma classe de ativo
- **THEN** o wizard avança para o Step 3 (configuração do modelo) com a classe de ativo selecionada propagada para o QuickRanker

#### Scenario: Layout dos cards em mobile
- **WHEN** a largura da tela é menor que 640px
- **THEN** os quatro cards de classe de ativo são exibidos em grid 2x2

#### Scenario: Layout dos cards em desktop
- **WHEN** a largura da tela é maior ou igual a 640px
- **THEN** os quatro cards são exibidos em linha horizontal (grid 4 colunas) ou 2x2 em tablet

#### Scenario: Acesso direto via URL com assetType
- **WHEN** o usuário acessa `/ranking?assetType=fii`
- **THEN** o wizard pula o Step 2b e inicializa no Step 3 com FII pré-selecionado (comportamento de deep-link preservado)
