# Funcionalidade de Comparação de Ações

## Visão Geral

A nova funcionalidade de comparação de ações permite aos usuários comparar múltiplas ações da B3 lado a lado, com análise fundamentalista completa e renderização no servidor (SSR) para otimização de SEO.

## Rota Implementada

### URL Pattern
```
http://localhost:3000/compara-acoes/[ticker1]/[ticker2]/[tickerN]
```

### Exemplos de URLs
- `/compara-acoes/VALE3/PETR4` - Comparar 2 ações
- `/compara-acoes/ITUB4/BBDC4/SANB11` - Comparar 3 bancos
- `/compara-acoes/VALE3/PETR4/ITUB4/MGLU3/AMER3/LREN3` - Comparar até 6 ações

## Funcionalidades Implementadas

### 1. Rota Dinâmica com Catch-All
- **Arquivo**: `src/app/compara-acoes/[...tickers]/page.tsx`
- **Suporte**: Múltiplos tickers na URL
- **Validação**: Mínimo 2 ações para comparação
- **404**: Página not-found customizada para tickers inválidos

### 2. Server-Side Rendering (SSR)
- **Metadata dinâmica** para SEO otimizado
- **Structured data** (JSON-LD) para mecanismos de busca
- **Open Graph** e **Twitter Cards** para compartilhamento social
- **Canonical URLs** para evitar conteúdo duplicado

### 3. Sistema Premium com Blur
- **Indicadores básicos**: Visíveis para todos os usuários
- **Indicadores premium**: Com efeito blur para usuários não-premium
- **Verificação de sessão**: Server-side para segurança
- **Call-to-action**: Botões para upgrade premium

### 4. Componentes Especializados

#### ComparisonTable
- **Arquivo**: `src/components/comparison-table.tsx`
- **Funcionalidades**:
  - Tabela comparativa com indicadores lado a lado
  - Destaque do melhor valor por indicador
  - Efeito blur para recursos premium
  - Links para análises individuais

#### StockComparisonSelector  
- **Arquivo**: `src/components/stock-comparison-selector.tsx`
- **Funcionalidades**:
  - Interface para seleção de ações
  - Validação de tickers
  - Exemplos de comparações populares
  - Integração com dashboard

#### Table UI Component
- **Arquivo**: `src/components/ui/table.tsx`
- **Funcionalidades**:
  - Componente de tabela reutilizável
  - Estilização consistente com design system
  - Responsivo e acessível

## Indicadores Comparados

### Indicadores Básicos (Gratuitos)
- **P/L** (Preço/Lucro)
- **P/VP** (Preço/Valor Patrimonial)
- **ROE** (Retorno sobre Patrimônio)
- **Dividend Yield**
- **Valor de Mercado**
- **Receita Total**

### Indicadores Premium (Com Blur)
- **Margem Líquida**
- **ROIC** (Retorno sobre Capital Investido)
- **Lucro Líquido**
- **Dívida Líquida/EBITDA**
- **Dívida Líquida/Patrimônio**
- **Liquidez Corrente**

## SEO e Performance

### Metadata Dinâmica
```typescript
// Exemplo de metadata gerada
title: "Comparação VALE3 vs PETR4 | Análise Comparativa de Ações - Preço Justo AI"
description: "Compare as ações VALE3 vs PETR4 (Vale S.A., Petróleo Brasileiro S.A.) com análise fundamentalista completa..."
keywords: "VALE3, PETR4, comparação de ações, análise comparativa..."
```

### Structured Data
- **Schema.org Article** para artigos de comparação
- **Corporation data** para cada empresa
- **Financial indicators** estruturados

### URLs Amigáveis
- **Hierárquica**: `/compara-acoes/TICKER1/TICKER2/TICKER3`
- **SEO-friendly**: Tickers na URL para rankeamento
- **Canonical**: URLs canônicas para evitar duplicação

## Integração com Dashboard

### Seletor de Comparação
- **Localização**: Dashboard principal
- **Interface**: Card dedicado para seleção de ações
- **Exemplos**: Botões com comparações populares
- **Validação**: Mínimo 2, máximo 6 ações

### Navegação
- **Links diretos**: Para análises individuais
- **Breadcrumbs**: Navegação contextual
- **Call-to-actions**: Para upgrade premium

## Arquivos Criados/Modificados

### Novos Arquivos
```
src/app/compara-acoes/[...tickers]/
├── page.tsx                    # Página principal de comparação
└── not-found.tsx              # Página 404 customizada

src/components/
├── comparison-table.tsx        # Tabela de comparação
├── stock-comparison-selector.tsx # Seletor de ações
└── ui/table.tsx               # Componente de tabela

COMPARACAO_ACOES.md            # Esta documentação
```

### Arquivos Modificados
```
src/app/dashboard/page.tsx     # Adicionado seletor de comparação
```

## Como Usar

### 1. Acesso Direto via URL
```
http://localhost:3000/compara-acoes/VALE3/PETR4
```

### 2. Via Dashboard
1. Acesse o dashboard
2. Use o card "Comparar Ações"
3. Adicione os tickers desejados
4. Clique em "Comparar X Ações"

### 3. Via Exemplos Populares
- **VALE3 vs PETR4**: Mineração vs Petróleo
- **Bancos**: ITUB4, BBDC4, SANB11
- **Varejo**: MGLU3, AMER3, LREN3

## Recursos Premium

### Para Usuários Gratuitos
- Visualização de indicadores básicos
- Comparação de até 6 ações
- Efeito blur em indicadores premium
- Call-to-action para upgrade

### Para Usuários Premium
- Acesso completo a todos os indicadores
- Análises de endividamento
- Métricas avançadas de rentabilidade
- Sem limitações de visualização

## Considerações Técnicas

### Performance
- **SSR**: Renderização no servidor para SEO
- **Caching**: Dados financeiros cacheados
- **Lazy loading**: Componentes carregados sob demanda

### Segurança
- **Validação server-side**: Verificação de sessão
- **Sanitização**: Tickers validados e sanitizados
- **Rate limiting**: Proteção contra abuso

### Responsividade
- **Mobile-first**: Design responsivo
- **Tabelas**: Scroll horizontal em telas pequenas
- **Cards**: Layout adaptativo por dispositivo

## Próximos Passos

### Melhorias Futuras
1. **Filtros avançados**: Por setor, tamanho, etc.
2. **Gráficos comparativos**: Visualizações interativas
3. **Exportação**: PDF/Excel das comparações
4. **Histórico**: Comparações salvas pelo usuário
5. **Alertas**: Notificações de mudanças significativas

### SEO Adicional
1. **Sitemaps**: Geração automática de comparações populares
2. **Meta tags**: Otimização adicional por setor
3. **Rich snippets**: Dados estruturados expandidos
4. **AMP**: Versões aceleradas para mobile
