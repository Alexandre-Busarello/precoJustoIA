# Validação e Correção de Duplicatas em dividend_history

Este documento descreve o script para validar e corrigir duplicatas na tabela `dividend_history`.

## Problema

A tabela `dividend_history` pode ter registros duplicados para a mesma data (`companyId + exDate`) com valores diferentes. Isso pode acontecer devido a:
- Falhas na API do Yahoo Finance retornando valores incorretos
- Processamento duplicado de dados com valores diferentes
- Erros de sincronização

**Importante**: É possível ter múltiplos dividendos na mesma data (ex: JCP e dividendos ordinários), mas eles devem ter `amount` diferentes e ambos devem estar corretos. O script identifica casos onde temos múltiplos registros para a mesma data e valida qual é o correto através do Yahoo Finance.

## Solução

O script `validate-dividend-duplicates.ts`:
1. **Identifica duplicatas reais**: Busca registros com mesmo `companyId + exDate + amount`
2. **Valida com Yahoo Finance**: Para cada duplicata, busca dados do Yahoo Finance para confirmar o valor correto
3. **Corrige automaticamente**: Remove registros duplicados mantendo apenas o mais recente, e atualiza o `amount` se necessário

## Uso

### Validar um ticker específico

```bash
npx tsx scripts/validate-dividend-duplicates.ts VULC3
```

### Listar todos os tickers com duplicatas

```bash
npx tsx scripts/validate-dividend-duplicates.ts
```

O script mostrará todos os tickers que têm duplicatas, mas não processará automaticamente. Use o comando acima com o ticker específico para corrigir.

## Como Funciona

### 1. Identificação de Duplicatas

O script busca no banco registros onde `companyId + exDate` aparecem mais de uma vez (independente do `amount`):

```sql
SELECT 
  company_id,
  ex_date,
  COUNT(*) as count,
  array_agg(id) as record_ids,
  array_agg(amount) as amounts
FROM dividend_history
GROUP BY company_id, ex_date
HAVING COUNT(*) > 1
```

Isso identifica casos onde temos múltiplos registros para a mesma data, mesmo que com valores diferentes.

### 2. Validação com Yahoo Finance

Para cada duplicata encontrada:
- Busca dividendos do Yahoo Finance para o ticker
- Verifica se existe um dividendo na data específica
- Compara o `amount` do banco com o do Yahoo Finance

### 3. Correção Automática

- **Se encontra um registro com `amount` correto**: Mantém apenas esse registro e remove todos os outros
- **Se nenhum registro corresponde ao Yahoo Finance**: Atualiza o registro mais recente com o valor correto do Yahoo Finance e remove os demais
- **Se não encontrar no Yahoo Finance**: Mantém apenas o registro mais recente e remove os duplicados

## Exemplo de Execução

```bash
$ npx tsx scripts/validate-dividend-duplicates.ts VULC3

📊 Processando VULC3...
⚠️  Encontradas 3 duplicatas para VULC3

📌 Processando duplicata:
   - Ticker: VULC3
   - ExDate: 2025-10-21
   - Registros duplicados: 2
   - Amounts encontrados: 0.125000, 0.118048
   - IDs: 9165, 20661
  📡 Buscando dados do Yahoo Finance para VULC3 na data 2025-10-21...
   📡 Valor do Yahoo Finance: 0.125000
   ✅ Registro correto encontrado: ID 9165 (amount: 0.125000)
   ✅ 1 registros incorretos removidos

✅ Correção concluída para VULC3:
   - Duplicatas processadas: 3
   - Duplicatas corrigidas: 3
   - Registros deletados: 3
   - Erros: 0
```

## Arquivos Relacionados

- `scripts/validate-dividend-duplicates.ts`: Script principal de validação
- `src/lib/dividend-service.ts`: Serviço que busca dividendos do Yahoo Finance
- `prisma/schema.prisma`: Schema com constraint única `@@unique([companyId, exDate, amount])`

## Notas Importantes

1. **Múltiplos dividendos na mesma data**: O sistema permite ter JCP e dividendos ordinários na mesma data, desde que tenham `amount` diferentes e ambos sejam válidos. O script identifica duplicatas quando há múltiplos registros para a mesma data e valida qual é o correto.

2. **Validação com Yahoo Finance**: O script sempre valida com o Yahoo Finance antes de corrigir, garantindo que os dados estejam corretos. Se encontrar um registro com o valor correto, mantém apenas esse. Caso contrário, atualiza o mais recente com o valor do Yahoo Finance.

3. **Registro correto**: O script mantém o registro que corresponde ao valor do Yahoo Finance, não necessariamente o mais recente. Se nenhum corresponder, atualiza o mais recente.

4. **Teste primeiro**: Use o script com um ticker específico primeiro (ex: VULC3) para validar o comportamento antes de processar todos os tickers.

## Verificação Manual

Para verificar duplicatas manualmente no banco:

```sql
SELECT 
  c.ticker,
  dh.ex_date,
  COUNT(*) as count,
  array_agg(dh.id) as record_ids,
  array_agg(dh.amount) as amounts
FROM dividend_history dh
JOIN companies c ON c.id = dh.company_id
GROUP BY c.ticker, dh.ex_date
HAVING COUNT(*) > 1
ORDER BY c.ticker, dh.ex_date DESC;
```

