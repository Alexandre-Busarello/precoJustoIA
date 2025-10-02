# Especificação da Feature: Lançamento Alfa/Beta

## 1. Visão Geral

Esta feature introduz as fases de lançamento **"Alfa"** e **"Beta"** para a plataforma, com o objetivo de controlar o acesso inicial, recompensar os primeiros usuários (*early adopters*), e coletar feedback qualificado. A transição entre as fases e o comportamento da plataforma serão controlados via variáveis de ambiente.

## 2. Controle por Variáveis de Ambiente (`.env`)

Será necessário adicionar as seguintes variáveis de ambiente para gerenciar os estágios da feature:

-   `LAUNCH_PHASE`: Controla a fase atual da aplicação.
    -   **Valores possíveis:** `ALFA`, `BETA`, `PROD` (Produção/Normal).
-   `ALFA_USER_LIMIT`: Define o número máximo de usuários permitidos na fase Alfa.
    -   **Exemplo:** `500`.
-   `ALFA_END_DATE`: Define a data final da fase Alfa (ex: Dezembro).
    -   **Formato sugerido:** `YYYY-MM-DD` (ex: `2025-12-31`).

## 3. Fase ALFA

A fase Alfa será ativada quando `LAUNCH_PHASE=ALFA`.

### 3.1. Acesso Premium Universal e Gratuito

-   **Regra de Negócio:** Durante toda a fase Alfa, todos os usuários cadastrados terão acesso irrestrito a todos os recursos do plano **PREMIUM**.
-   **Implementação:** Identificar todas as validações de permissão e acesso a funcionalidades no código (ex: `isPremium()`, `hasActivePlan()`, etc.) e modificá-las para que, se `LAUNCH_PHASE` for `ALFA`, retornem sempre `true`, concedendo o acesso como se o usuário fosse assinante. Esta regra ignora se o usuário possui ou não um plano ativo no banco de dados.

### 3.2. Limite de Inscrições e Lista de Interesse (Whitelist)

-   **Limite de Usuários:** O cadastro de novos usuários será limitado ao valor definido em `ALFA_USER_LIMIT` (ex: 500 usuários).
-   **Atingimento do Limite:** Assim que o número de usuários cadastrados atingir o limite:
    1.  O formulário de cadastro padrão será desabilitado.
    2.  No lugar do formulário, será exibido um formulário de **"Lista de Interesse"** para captura de leads (nome e email), informando que as vagas para a fase Alfa se esgotaram e que os interessados serão notificados quando novas vagas surgirem.
-   **Abertura de Vagas (Usuários Inativos):**
    -   Um mecanismo (ex: *cron job* ou *scheduled task*) deverá ser implementado para verificar diariamente por usuários que estão **inativos há mais de 15 dias** (sem login).
    -   Quando um usuário inativo for encontrado, ele "abre uma vaga", permitindo que uma pessoa da lista de interesse seja convidada a se cadastrar.

### 3.3. Exceção ao Limite: Pacote "Early Adopters"

-   Usuários que adquirirem o pacote especial de *Early Adopters* **não entram na contagem do limite** de usuários. O fluxo de compra deve garantir que o cadastro seja liberado para eles, mesmo que o limite geral tenha sido atingido.

### 3.4. Comunicação Visual na Plataforma e Landing Page

-   **Aviso de Período Alfa:** Exibir um banner ou notificação proeminente, tanto na Landing Page quanto dentro da plataforma logada, comunicando:
    -   Que a plataforma está em fase Alfa.
    -   Que todos os usuários têm acesso PREMIUM gratuito até a data definida em `ALFA_END_DATE` (ex: "Até Dezembro").
-   **Página de Planos:** A página de planos e preços deve ser mantida, mas precisa de uma modificação visual clara quando `LAUNCH_PHASE=ALFA`.
    -   **Sugestão:** Adicionar um destaque, selo ou banner sobre o plano PREMIUM com a mensagem: "**Liberado gratuitamente durante a fase Alfa!**". O botão de "assinar" pode ser desabilitado ou substituído por um aviso informativo.

## 4. Oferta para "Early Adopters"

Durante a fase Alfa, haverá uma oferta especial de assinatura para os primeiros apoiadores.

-   **Benefícios da Oferta:**
    1.  **Preço Congelado:** Garantia de que o preço pago no momento da compra será mantido **para sempre**, em todas as renovações futuras do plano.
    2.  **Canal Exclusivo:** Acesso a um canal exclusivo no **WhatsApp** para feedback direto sobre o produto e conversas com o CEO.
-   **Condições da Oferta:**
    -   **Plano:** Disponível apenas para o plano **Anual**.
    -   **Formas de Pagamento:** Cartão de crédito e PIX.

## 5. Transição para a Fase BETA

Quando a variável de ambiente for alterada para `LAUNCH_PHASE=BETA`:

-   **Fim do Acesso Premium Gratuito:** O acesso universal ao plano PREMIUM é desativado. A partir deste momento, todos os usuários (exceto os que compraram o pacote *Early Adopter*) voltam a ser usuários gratuitos e precisam adquirir um plano pago para acessar os recursos PREMIUM.
-   **Campanha Member Get Member:** Iniciar a implementação e divulgação da campanha de indicação "Member Get Member", onde usuários podem obter benefícios ao indicar novos assinantes.
-   Os avisos sobre a fase Alfa devem ser removidos da plataforma e da Landing Page.

## 6. Divulgação

-   Iniciar a divulgação da fase Alfa em canais selecionados, como o **Reddit**, para atrair o público-alvo inicial.