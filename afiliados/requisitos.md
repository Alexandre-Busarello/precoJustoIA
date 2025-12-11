# Documento de Requisitos de Software (DRS)
**Módulo:** Sistema de Afiliados e Centralização de Pedidos
**Versão:** 1.0
**Data:** 11/12/2025

---

## 1. Introdução
Este documento descreve os requisitos funcionais e não funcionais para a implementação do Módulo de Afiliados. O objetivo é permitir que parceiros indiquem a plataforma em troca de comissões, garantindo um rastreamento preciso de leads, uma gestão centralizada de pedidos e um fluxo financeiro transparente.

---

## 2. Regras de Negócio (RN)
As regras fundamentais que regem o comportamento do sistema.

* **RN01 - Modelo de Atribuição:** O sistema deve utilizar o modelo "Last-Click" (Último Clique). A comissão será atribuída ao último afiliado cujo link o usuário clicou antes do cadastro/compra.
* **RN02 - Prioridade de Preço no Checkout:** O preço exibido ao usuário deve seguir a hierarquia estrita:
    1.  Oferta da Plataforma (via Query Param) - *Maior Prioridade*
    2.  Preço do Afiliado (via Cookie/Lead vinculado)
    3.  Preço Base (Tabela Padrão) - *Menor Prioridade*
* **RN03 - Janela de Conversão:** O cookie de rastreamento deve ter validade de **30 dias**.
* **RN04 - Expiração de Pedidos Pix:** Pedidos gerados via Pix devem expirar automaticamente após **30 minutos** se não houver confirmação de pagamento.
* **RN05 - Política de Saque:**
    * Valor mínimo para solicitação: **R$ 50,00**.
    * O saldo só pode ser sacado se a venda estiver com status `PAID` e fora do período de garantia.
    * O pagamento é feito exclusivamente via Pix.

---

## 3. Requisitos Funcionais (RF)
Funcionalidades que o sistema deve oferecer aos usuários (Afiliados, Clientes e Admins).

### 3.1. Módulo de Rastreamento e Checkout
* **RF01 - Captura de Lead:** O sistema deve interceptar parâmetros de URL (`?ref=`) e armazenar cookies seguros.
* **RF02 - Vínculo de Lead:** Ao se cadastrar, o usuário deve ser permanentemente vinculado ao afiliado ativo no cookie (tabela `AffiliateLead`).
* **RF03 - Persistência de Pedido:** Toda tentativa de checkout (clique em "Pagar" ou "Gerar Pix") deve criar um registro na tabela `AffiliateOrder` antes de contatar o gateway.
* **RF04 - Integração de Pagamentos:** O sistema deve suportar criação de sessões de checkout no Stripe (Cartão) e geração de QR Code no Mercado Pago (Pix), vinculando o ID interno do pedido.

### 3.2. Painel do Afiliado (`/affiliate/dashboard`)
* **RF05 - KPIs em Tempo Real:** O afiliado deve visualizar: Clicks totais, Leads cadastrados, Vendas confirmadas e Taxa de conversão.
* **RF06 - Gestão de Links:** O afiliado deve ter acesso fácil ao seu link exclusivo de divulgação.
* **RF07 - Carteira e Saque:** O afiliado deve visualizar seu "Saldo Disponível" e ter um botão para "Solicitar Saque" (habilitado apenas se RN05 for atendida).
* **RF08 - Histórico Financeiro:** Listagem de todas as solicitações de saque com status (Pendente, Pago, Rejeitado) e comprovantes.
* **RF09 - Aceite de Termos:** O acesso ao painel só é liberado após o aceite explícito dos Termos de Uso (registrando data e versão).

### 3.3. Backoffice Administrativo (`/admin/affiliates`)
* **RF10 - Gestão de Parceiros:** O admin deve poder listar, editar taxas de comissão individuais e banir afiliados.
* **RF11 - Processamento de Saques:** O admin deve visualizar uma fila de saques pendentes.
* **RF12 - Baixa de Pagamento:** Ao pagar um saque, o admin deve poder anexar o comprovante (URL ou ID) e marcar o registro como `PAID`.
* **RF13 - Rejeição de Saque:** O admin deve poder rejeitar um saque fornecendo um motivo (o saldo deve retornar à carteira do afiliado).

---

## 4. Requisitos Não Funcionais (RNF)
Critérios de qualidade, segurança e infraestrutura.

* **RNF01 - Integridade de Dados:** Registros de pedidos com status `PAID` devem ser imutáveis em relação aos valores de comissão e preço (Snapshot).
* **RNF02 - Compliance (LGPD):** O armazenamento de IPs para segurança deve ser feito via Hash (SHA-256), conforme estrutura existente `UserSecurity`.
* **RNF03 - Resiliência:** O processamento de Webhooks deve possuir mecanismos de *retry* em caso de falha temporária do banco de dados.
* **RNF04 - Performance:** O cálculo de preço no checkout deve ocorrer no *Server-Side* (SSR) para evitar "piscadas" de valor (layout shift) no frontend.
* **RNF05 - Segurança Financeira:** O sistema deve validar no Backend se `Saldo Disponível >= Valor Solicitado` antes de criar um pedido de saque, prevenindo manipulação de HTML/JS.

---

## 5. Estrutura de Dados
(Referência técnica para validação)
As tabelas principais envolvidas são: `AffiliatePartner`, `AffiliateLead`, `AffiliatePricingRule`, `AffiliateOrder` e `AffiliatePayout`.