# Portfolio Metrics Auto-Refresh

## 📊 Overview

As métricas da carteira (Retorno Total, Volatilidade, Sharpe Ratio, etc.) são **automaticamente recalculadas** com preços atualizados quando necessário, garantindo que os valores exibidos estejam sempre corretos.

## 🔄 Como Funciona

### **1. Preços em Tempo Real**

Quando qualquer endpoint busca preços de ativos:

```
Yahoo Finance API (Primário)
    ↓
Preços em tempo real
    ↓
Auto-atualiza database (background)
    ↓
Retorna preço para cálculos
```

### **2. Métricas Auto-Refresh**

Quando o usuário acessa a carteira:

```
GET /api/portfolio/[id]/metrics
    ↓
Verifica: lastCalculatedAt > 5 minutos atrás?
    ↓
├─ SIM → Recalcula com preços atuais do Yahoo Finance
│         ↓
│    Atualiza portfolio_metrics
│         ↓
│    Retorna métricas atualizadas
│
└─ NÃO → Retorna métricas cacheadas
```

## ⏱️ Política de Refresh

### **Métricas são recalculadas quando:**

✅ Não existem métricas salvas  
✅ `lastCalculatedAt` está vazio  
✅ Última calculação foi há **mais de 5 minutos**  
✅ Usuário força recalculação via `POST /api/portfolio/[id]/metrics`  

### **Métricas são cacheadas quando:**

📦 Foram calculadas há menos de 5 minutos  
📦 Na listagem de portfolios (performance)  

## 🎯 Endpoints Afetados

### **Auto-Refresh Habilitado**

| Endpoint | Comportamento | Frequência |
|----------|--------------|------------|
| `GET /api/portfolio/[id]/metrics` | Recalcula se >5min | Automático |
| `GET /api/portfolio/[id]/holdings` | Sempre busca preços atuais | Sempre |
| `POST /api/portfolio/[id]/metrics` | Força recalculação | Manual |

### **Usa Cache (Performance)**

| Endpoint | Comportamento | Motivo |
|----------|--------------|--------|
| `GET /api/portfolio` | Usa métricas cacheadas | Listagem de múltiplos portfolios |

## 📝 Exemplo de Fluxo

### Usuário Abre Carteira

1. **Carrega Holdings** (`/api/portfolio/[id]/holdings`)
   ```
   💰 Fetching prices from Yahoo Finance...
   ✅ PETR4: R$ 29.70 (Yahoo Finance)
   💾 Database updated with R$ 29.70
   ```

2. **Carrega Métricas** (`/api/portfolio/[id]/metrics`)
   ```
   🔄 Checking metrics freshness...
   ⏰ Last calculated: 10 minutes ago
   🔄 Recalculating with fresh prices...
   ✅ Metrics refreshed with latest prices
   ```

3. **Resultado**: Usuário vê Retorno Total atualizado com preços de agora

### Usuário Navega Entre Abas

Se voltar à carteira em <5 minutos:
```
🔄 Checking metrics freshness...
✅ Metrics are fresh (2 minutes old), returning cached
```

## 🎛️ Configuração

### **Tempo de Cache (5 minutos)**

Localizado em: `src/app/api/portfolio/[id]/metrics/route.ts`

```typescript
const METRICS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const needsRefresh = !metrics || 
  !metrics.lastCalculatedAt || 
  (Date.now() - new Date(metrics.lastCalculatedAt).getTime() > METRICS_CACHE_TTL);
```

### **Para Ajustar o TTL:**

```typescript
// 1 minuto
const METRICS_CACHE_TTL = 1 * 60 * 1000;

// 10 minutos
const METRICS_CACHE_TTL = 10 * 60 * 1000;

// Sem cache (sempre recalcula)
const METRICS_CACHE_TTL = 0;
```

## 🔧 Logs de Debug

### **Métricas Recalculadas**
```
🔄 [METRICS] Recalculating metrics for portfolio abc123 (outdated or missing)
💰 [QUOTE SERVICE] Fetching prices for 19 tickers
  ✅ PETR4: R$ 29.70 (Yahoo Finance)
  💾 PETR4: Database updated with R$ 29.70
  ...
✅ [METRICS] Metrics refreshed with latest prices
```

### **Métricas Cacheadas (Fresh)**
```
(No logs - usa cache silenciosamente)
```

## 💡 Benefícios

### **Para o Usuário**

✅ Retorno Total sempre atualizado com preços reais  
✅ Não precisa fazer refresh manual  
✅ Métricas confiáveis refletindo mercado atual  
✅ Performance rápida (cache quando possível)  

### **Para o Sistema**

✅ Balance entre precisão e performance  
✅ Não sobrecarrega Yahoo Finance API  
✅ Database sempre atualizado (background)  
✅ Escalável para muitos usuários  

## 🐛 Troubleshooting

### Métricas não atualizando

1. **Verifique logs** para ver se recalculação está sendo trigada
2. **Confirme TTL** não está muito alto
3. **Teste manualmente** via `POST /api/portfolio/[id]/metrics`

### Performance lenta

1. **Aumente TTL** para 10-15 minutos se aceitável
2. **Monitore** quantas recalculações acontecem
3. **Considere** cache Redis para métricas (futura melhoria)

### Preços desatualizados mesmo com refresh

1. **Verifique** se Yahoo Finance está funcionando (logs)
2. **Confirme** que database está sendo atualizado
3. **Teste** endpoint de holdings para ver preços

## 🔮 Melhorias Futuras

- [ ] Cache Redis para métricas (TTL configurável)
- [ ] WebSocket para atualização em tempo real
- [ ] Batch recalculation para múltiplos portfolios
- [ ] Metrics freshness indicator na UI
- [ ] User preference para TTL (5min vs 15min vs tempo real)
- [ ] Background job para recalcular métricas periodicamente
- [ ] Metrics calculation queue para evitar spikes

## 📚 Relacionado

- [Quote Service](./QUOTE_SERVICE.md) - Como preços são buscados
- [Portfolio Metrics Service](../src/lib/portfolio-metrics-service.ts) - Lógica de cálculo
- [Smart Query Cache](../src/lib/smart-query-cache.ts) - Cache de queries Prisma

