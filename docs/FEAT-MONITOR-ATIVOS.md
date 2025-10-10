# Especificação Completa da Funcionalidade

**ID da Feature:** `FEAT-MONITOR-ATIVOS`

**Status:** Em definição

**Autor:** Alexandre

**Data:** 10/10/2025

---

### **1. Resumo da Funcionalidade**

O objetivo desta funcionalidade é permitir que usuários se inscrevam ("subscrevam") em ativos específicos (ações de empresas) para receberem notificações proativas sobre mudanças relevantes em seus fundamentos. Um processo automatizado em background, executado como um Vercel Cron Job, irá monitorar os ativos de forma contínua e distribuída. O processo compara o estado atual de cada ativo com um "snapshot" (um retrato salvo anteriormente) e, em caso de variações significativas no Score Geral, utiliza um modelo de linguagem (LLM Gemini) para gerar um relatório detalhado sobre as alterações. Este relatório será armazenado no banco de dados e enviado por e-mail aos usuários inscritos.

---

### **2. Requisitos Funcionais**

#### **2.1. Gestão de Inscrições de Usuários (User Subscription)**

* **RF-001: Inscrição em um Ativo:** Na página de detalhes de um ativo (ex: `/acao/bbse3`), o usuário autenticado deve ter a opção de se inscrever para receber atualizações daquele ativo.
* **RF-002: Cancelamento de Inscrição:** O usuário deve poder cancelar a sua inscrição em um ativo a qualquer momento, seja pela página do ativo ou por uma área de gerenciamento de inscrições em seu perfil.
* **RF-003: Visualização de Inscrições:** O usuário deve ter uma seção em seu perfil onde possa visualizar todos os ativos nos quais está inscrito.

#### **2.2. Processo de Monitoramento em Background (Background Job)**

* **RF-004: Iteração Contínua:** Um processo automatizado (worker/cron job) deve ser executado periodicamente para iterar sobre a lista de todos os ativos monitorados pela plataforma.
* **RF-005: Criação do Primeiro Snapshot:**
    * Para um ativo que ainda não possui um snapshot, o sistema deve criar o primeiro registro.
    * Este "Snapshot" deve conter uma cópia completa e fiel de todos os indicadores fundamentalistas, estratégias e dados associados ao ativo no momento da criação (conforme os dados exibidos na página `/acao/[ticker]`).
* **RF-006: Comparação de Score Geral:**
    * Para um ativo que já possui um snapshot, o processo deve calcular o `Score Geral` atual, utilizando a mesma lógica já implementada (`calculateOverallScore`).
    * O `Score Geral` atual deve ser comparado com o `Score Geral` armazenado no último snapshot.
* **RF-007: Detecção de Variação Relevante:**
    * Se o `Score Geral` atual for **maior** que o do snapshot, o sistema deve registrar uma "mudança positiva".
    * Se o `Score Geral` atual for **menor** que o do snapshot, o sistema deve registrar uma "mudança negativa".
    * Se não houver alteração, o processo segue para o próximo ativo.

#### **2.3. Geração de Relatório com IA (LLM Integration)** (ja temos integração com o Gemini, buscar no código como implementar)

* **RF-008: Acionamento da Geração de Relatório:** A geração de relatório via LLM (Gemini) será acionada sempre que uma "mudança positiva" ou "mudança negativa" for detectada.
* **RF-009: Análise Comparativa:**
    * A LLM receberá como contexto os dados do **snapshot anterior** e os **dados atuais** do ativo.
    * A instrução (prompt) para a LLM deve ser clara para que ela identifique e sumarize as principais diferenças que levaram à variação do Score Geral.
* **RF-010: Conteúdo do Relatório:**
    * **Relatório de Mudança Negativa:** Deve consolidar de forma clara e objetiva quais indicadores ou fatores pioraram.
    * **Relatório de Mudança Positiva:** Deve consolidar de forma clara e objetiva quais indicadores ou fatores melhoraram.
* **RF-011: Armazenamento do Relatório:**
    * O relatório gerado deve ser salvo no banco de dados. A tabela `ai_reports` pode ser reutilizada ou estendida para associar o relatório ao ativo específico e ao evento de mudança. Um novo tipo de relatório (ex: `FUNDAMENTAL_CHANGE`) pode ser criado para diferenciá-lo dos relatórios mensais existentes.
    * Após a geração e armazenamento do relatório, o snapshot atual do ativo deve ser atualizado no banco para refletir o novo estado, servindo como base para a próxima comparação.

#### **2.4. Sistema de Notificação**

* **RF-012: Envio de E-mail:** Após a geração e salvamento bem-sucedido de um novo relatório de mudança, o sistema deve disparar o envio de um e-mail para todos os usuários que estão inscritos no ativo correspondente.
* **RF-013: Conteúdo do E-mail:** O e-mail deve conter o relatório completo gerado pela IA ou um resumo com um link para a visualização completa na plataforma.

---

### **3. Requisitos Não-Funcionais**

* **RNF-001: Arquitetura e Performance (Vercel Cron Job)**
    * **Execução Serverless:** O processo em background será implementado como um Vercel Cron Job, que possui uma limitação de tempo máximo de execução (ex: 5-15 minutos). A arquitetura deve ser projetada para operar de forma eficiente dentro dessa janela de tempo.
    * **Processamento em Lotes e Controle de Estado:** Para garantir que todos os ativos sejam analisados sem exceder o limite de tempo, cada execução do Cron Job deve ser "inteligente" e com estado.
        1.  **Mecanismo de Continuidade:** O job precisa saber onde parou. Uma abordagem recomendada é armazenar um ponteiro ou timestamp no banco de dados. Por exemplo, pode-se ter uma tabela `AssetProcessingState` ou um campo `lastCheckedAt` na própria tabela de `Asset`.
        2.  **Lógica de Execução:** Ao ser iniciado, o job consultará o banco para identificar o próximo lote de ativos a serem processados. Ele buscará os ativos cujo campo `lastCheckedAt` seja mais antigo, garantindo que a análise seja distribuída ao longo do tempo.
        3.  **Atualização de Estado:** Após processar com sucesso cada ativo (criar/comparar snapshot, gerar relatório, etc.), o job deve atualizar o campo `lastCheckedAt` para o timestamp atual (`now()`).
        4.  **Encerramento Gracioso:** O job deve monitorar seu tempo de execução e encerrar graciosamente antes de atingir o limite máximo, garantindo que o estado do último ativo processado seja salvo corretamente.
    * **Reinício do Ciclo:** Uma vez que todos os ativos tenham sido verificados, o ciclo se reinicia naturalmente na próxima execução do cron, que começará a pegar os ativos que foram verificados há mais tempo. Isso cria um ciclo de verificação contínuo e distribuído.

* **RNF-002: Escalabilidade:** A solução deve escalar de forma eficiente. O processamento em lotes e o controle de estado já contribuem para isso, pois o sistema não tentará processar todos os ativos de uma só vez, independentemente de quantos existam na base de dados.

* **RNF-003: Tolerância a Falhas e Idempotência:**
    * **Retentativas (Retry):** A chamada à API do Gemini e as operações de banco de dados devem incluir uma política de retentativas para lidar com falhas transitórias de rede ou serviço.
    * **Idempotência:** As operações devem ser idempotentes. Se o job falhar após gerar um relatório mas antes de atualizar o `lastCheckedAt` de um ativo, na próxima execução ele não deve gerar um relatório duplicado para a mesma mudança.

* **RNF-004: Configurabilidade:** A frequência de execução do Cron Job deve ser facilmente configurável no arquivo `vercel.json` (ex: a cada hora). O tamanho do lote de ativos a serem processados em cada execução também pode ser uma variável de ambiente para facilitar ajustes de performance.

---

### **4. Estrutura de Dados (Sugestões para Schema Prisma)**

* **Tabela `UserAssetSubscription`:**
    * `id`: String (UUID)
    * `userId`: String (Foreign Key para `User`)
    * `assetId`: String (Foreign Key para `Asset`)
    * `createdAt`: DateTime
    * *Índice composto em `[userId, assetId]` para garantir inscrição única.*

* **Tabela `AssetSnapshot`:**
    * `id`: String (UUID)
    * `assetId`: String (Foreign Key para `Asset`, Unique)
    * `snapshotData`: JSON (Contendo a estrutura completa dos dados do ativo)
    * `overallScore`: Float
    * `createdAt`: DateTime
    * `updatedAt`: DateTime

* **Tabela `AiReport` (Modificação Sugerida):**
    * Adicionar um campo `type` (Enum: `MONTHLY_OVERVIEW`, `FUNDAMENTAL_CHANGE`).
    * Adicionar um campo `triggerEventId` (String, opcional) para vincular o relatório a um evento específico, se necessário.

* **Tabela `Asset` (Modificação Sugerida):**
    * Adicionar um campo `lastCheckedAt`: DateTime (para controle do Cron Job).

---

### **5. Fluxo de Trabalho (Workflow)**

1.  **Usuário** acessa a página `/acao/bbse3` e clica no botão "Receber Atualizações".
2.  Uma nova entrada é criada na tabela `UserAssetSubscription`.
3.  **Vercel Cron Job** é executado no horário agendado.
4.  O job busca um lote de ativos com o `lastCheckedAt` mais antigo.
5.  O job processa o ativo `BBSE3` dentro desse lote.
    * **Cenário A (Primeira vez):** Não encontra snapshot para `BBSE3`. Cria um novo `AssetSnapshot` com os dados atuais e `overallScore`.
    * **Cenário B (Já existe snapshot):**
        1.  Calcula o `overallScore` atual para `BBSE3`.
        2.  Compara com o `overallScore` salvo no `AssetSnapshot`.
        3.  Detecta uma variação (ex: de 8.5 para 8.1 - mudança negativa).
        4.  Chama a API do Gemini com os dados do snapshot e os dados atuais.
        5.  Gemini retorna um relatório sobre o que piorou.
        6.  Salva o relatório na tabela `ai_reports` com o tipo `FUNDAMENTAL_CHANGE`.
        7.  Atualiza o `AssetSnapshot` de `BBSE3` com os novos dados.
        8.  Busca todos os `userIds` da tabela `UserAssetSubscription` associados a `BBSE3`.
        9.  Enfileira o envio de e-mails para cada usuário com o relatório gerado.
6.  Após o processamento de `BBSE3`, o job atualiza o campo `lastCheckedAt` do ativo.
7.  O job continua para o próximo ativo do lote até que o tempo de execução esteja próximo do limite.
8.  O job é encerrado. Na próxima execução agendada, ele buscará o próximo lote de ativos que não foram verificados recentemente.