## ADDED Requirements

### Requirement: Listagem de histórico de rankings no wizard
O sistema SHALL exibir a listagem de rankings salvos do usuário no Step 2a do wizard com paginação e filtros. Disponível apenas para usuários autenticados (FREE e PREMIUM).

#### Scenario: Exibição do histórico para usuário autenticado
- **WHEN** o usuário autenticado está no Step 2a (histórico)
- **THEN** o sistema exibe a lista de rankings salvos em ordem cronológica decrescente, mostrando: data/hora, modelo utilizado, classe de ativo, número de resultados

#### Scenario: Estado vazio do histórico
- **WHEN** o usuário autenticado não possui rankings salvos
- **THEN** o sistema exibe uma ilustração e mensagem "Você ainda não criou nenhum ranking" com botão "Criar meu primeiro ranking" que avança para o Step 2b

#### Scenario: Histórico para usuário não autenticado
- **WHEN** um usuário não autenticado tenta acessar o Step 2a
- **THEN** o sistema exibe o Step 1 ou redireciona para login, não permite visualizar histórico

#### Scenario: Paginação do histórico
- **WHEN** o usuário possui mais de 10 rankings salvos
- **THEN** o sistema exibe no máximo 10 itens por página com controles de paginação "Anterior" e "Próximo"

### Requirement: Filtros na listagem de histórico
O sistema SHALL permitir filtrar a listagem de histórico por modelo de valuation e por período. Disponível para usuários autenticados (FREE e PREMIUM).

#### Scenario: Filtro por modelo
- **WHEN** o usuário seleciona um modelo no seletor de filtro
- **THEN** a lista é atualizada mostrando apenas rankings gerados com o modelo selecionado

#### Scenario: Filtro por período
- **WHEN** o usuário seleciona um intervalo de datas no filtro
- **THEN** a lista é atualizada mostrando apenas rankings criados dentro do período selecionado

#### Scenario: Limpeza de filtros
- **WHEN** o usuário clica em "Limpar filtros"
- **THEN** todos os filtros são removidos e a listagem completa é exibida

### Requirement: Abertura de ranking salvo inline no wizard
O sistema SHALL permitir ao usuário abrir um ranking salvo diretamente dentro do wizard, avançando para o Step 4 (resultado) sem sair da página. Disponível para usuários autenticados (FREE e PREMIUM).

#### Scenario: Abertura de ranking da listagem
- **WHEN** o usuário clica em um item da listagem de histórico
- **THEN** o wizard avança para o Step 4 com o ranking carregado via `GET /api/ranking/[id]`

#### Scenario: Loading state ao carregar ranking
- **WHEN** o sistema está carregando o ranking selecionado
- **THEN** o Step 4 exibe um skeleton loader indicando carregamento em progresso

#### Scenario: Erro ao carregar ranking
- **WHEN** a API retorna erro ao buscar o ranking pelo id
- **THEN** o sistema exibe mensagem de erro com botão para retornar à listagem do histórico

#### Scenario: Exibição do resultado do ranking histórico
- **WHEN** o ranking é carregado com sucesso
- **THEN** o Step 4 exibe os resultados com identificação visual de que é um ranking histórico (data de criação, badge "Histórico")

### Requirement: Cards de histórico responsivos
O sistema SHALL exibir cada item do histórico como um card com informações compactas e ação clara de abertura.

#### Scenario: Card em mobile
- **WHEN** a largura da tela é menor que 640px
- **THEN** cada card ocupa 100% da largura e exibe: data, modelo, classe de ativo, número de resultados e botão "Ver ranking"

#### Scenario: Card em desktop
- **WHEN** a largura da tela é maior ou igual a 640px
- **THEN** os cards exibem as mesmas informações dispostas em linha horizontal, com o botão "Ver ranking" alinhado à direita
