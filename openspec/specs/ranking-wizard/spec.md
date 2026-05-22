## ADDED Requirements

### Requirement: Wizard multi-step para criação de ranking
O sistema SHALL apresentar um fluxo wizard com steps sequenciais que guiam o usuário desde a escolha de destino até o resultado do ranking. O wizard SHALL ser o único elemento principal da página `/ranking`, substituindo o layout vertical atual. Disponível para todos os tiers (FREE e PREMIUM).

#### Scenario: Renderização do wizard no acesso inicial
- **WHEN** o usuário acessa `/ranking` sem parâmetros de URL
- **THEN** o sistema exibe o Step 1 com dois cartões de ação: "Criar novo ranking" e "Ver histórico de rankings"

#### Scenario: Navegação forward ao escolher criar novo ranking
- **WHEN** o usuário clica em "Criar novo ranking" no Step 1
- **THEN** o sistema avança para o Step 2b (seleção de classe de ativo) com animação de transição

#### Scenario: Navegação forward ao escolher ver histórico
- **WHEN** o usuário clica em "Ver histórico de rankings" no Step 1
- **THEN** o sistema avança para o Step 2a (histórico) com animação de transição

#### Scenario: Navegação backward entre steps
- **WHEN** o usuário clica no botão "Voltar" em qualquer step após o Step 1
- **THEN** o sistema retorna ao step anterior preservando o estado já preenchido

#### Scenario: Preservação de estado ao voltar
- **WHEN** o usuário está no Step 3 (configuração) com um modelo selecionado e clica em "Voltar"
- **THEN** o sistema retorna ao Step 2b e, ao avançar novamente, o modelo selecionado anteriormente está preservado

### Requirement: Barra de progresso (stepper) do wizard
O sistema SHALL exibir uma barra de progresso visual persistente no topo do wizard indicando os steps do fluxo ativo. Disponível para todos os tiers.

#### Scenario: Stepper no fluxo de criação de novo ranking
- **WHEN** o usuário está no fluxo "Criar novo ranking"
- **THEN** o stepper exibe 3 steps: "Tipo de ativo", "Configurar modelo", "Resultado"

#### Scenario: Stepper no fluxo de histórico
- **WHEN** o usuário está no fluxo "Ver histórico"
- **THEN** o stepper exibe 1 step: "Histórico"

#### Scenario: Indicação do step atual
- **WHEN** o usuário está em qualquer step
- **THEN** o step atual está visualmente destacado (ativo) e os steps concluídos estão marcados com ícone de check

#### Scenario: Stepper em mobile
- **WHEN** a largura da tela é menor que 640px (breakpoint sm)
- **THEN** o stepper exibe apenas ícones e números dos steps, sem labels de texto

### Requirement: Deep-linking por parâmetros de URL
O sistema SHALL inicializar o wizard no step correto com base nos parâmetros de URL `assetType` e `id`. Disponível para todos os tiers.

#### Scenario: Deep-link com assetType sem id
- **WHEN** o usuário acessa `/ranking?assetType=b3`
- **THEN** o wizard inicializa diretamente no Step 3 (configuração do modelo) com B3 pré-selecionado

#### Scenario: Deep-link com id de ranking salvo
- **WHEN** o usuário acessa `/ranking?assetType=b3&id=abc123`
- **THEN** o wizard inicializa diretamente no Step 4 (resultado) carregando o ranking salvo

#### Scenario: URL params inválidos
- **WHEN** o usuário acessa `/ranking?assetType=invalido`
- **THEN** o wizard inicializa no Step 1 (escolha de destino) e ignora o parâmetro inválido

### Requirement: Animações de transição entre steps
O sistema SHALL aplicar animações suaves de transição ao navegar entre steps. O sistema SHALL respeitar a preferência `prefers-reduced-motion` do sistema operacional do usuário.

#### Scenario: Transição de avanço
- **WHEN** o usuário avança para o próximo step
- **THEN** o novo step entra deslizando da direita e o step anterior sai pela esquerda

#### Scenario: Transição de retorno
- **WHEN** o usuário retorna ao step anterior
- **THEN** o step anterior entra deslizando da esquerda e o step atual sai pela direita

#### Scenario: Acessibilidade - reduced motion
- **WHEN** o sistema operacional do usuário tem `prefers-reduced-motion: reduce` ativado
- **THEN** as animações de transição são substituídas por fade simples (opacidade) sem movimento lateral

### Requirement: Responsividade mobile-first
O sistema SHALL funcionar corretamente em dispositivos com tela a partir de 320px de largura. Todos os elementos interativos SHALL ter área de toque mínima de 44x44px.

#### Scenario: Layout em mobile
- **WHEN** a largura da tela é menor que 768px
- **THEN** os cartões do Step 1 são empilhados verticalmente, cada um ocupando 100% da largura disponível

#### Scenario: Layout em tablet e desktop
- **WHEN** a largura da tela é maior ou igual a 768px
- **THEN** os cartões do Step 1 são exibidos lado a lado em grid de 2 colunas

#### Scenario: Botões de navegação em mobile
- **WHEN** o usuário está em mobile e visualiza os botões "Voltar" e "Continuar"
- **THEN** os botões ocupam 100% da largura e têm altura mínima de 48px
