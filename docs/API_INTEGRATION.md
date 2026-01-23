# API de Dados Financeiros TTM - Documentação de Integração

## 📋 Visão Geral

A API de Dados Financeiros TTM permite que terceiros consultem dados financeiros em tempo real (Trailing Twelve Months) de empresas brasileiras listadas na B3. A API retorna mais de 70 indicadores financeiros calculados, incluindo métricas de valuation, rentabilidade, endividamento, crescimento e muito mais.

**Base URL:** `https://seu-dominio.com/api/v1/financial-data`

**Versão:** v1

**Formato:** JSON

---

## 🔐 Autenticação

A API utiliza autenticação via **Bearer Token** no header `Authorization`.

### Como Obter uma API Key

Entre em contato com a equipe para obter sua chave de API única.

### Como Usar

Inclua a API key no header de todas as requisições:

```
Authorization: Bearer sua-api-key-aqui
```

### Exemplo de Requisição Autenticada

```bash
curl -X GET "https://seu-dominio.com/api/v1/financial-data/PETR4" \
  -H "Authorization: Bearer sua-api-key-aqui"
```

---

## 📡 Endpoints

### 1. Buscar Dados de um Único Ticker

Retorna os dados financeiros TTM de uma empresa específica.

**Endpoint:** `GET /api/v1/financial-data/{ticker}`

**Parâmetros:**

| Parâmetro | Tipo   | Obrigatório | Descrição                    |
|-----------|--------|-------------|------------------------------|
| ticker    | string | Sim         | Código do ticker (ex: PETR4) |

**Exemplo de Requisição:**

```bash
GET /api/v1/financial-data/PETR4
Authorization: Bearer sua-api-key-aqui
```

**Exemplo de Resposta (200 OK):**

```json
{
  "success": true,
  "data": {
    "ticker": "PETR4",
    "company": {
      "name": "Petróleo Brasileiro S.A. - Petrobras",
      "sector": "Energy",
      "industry": "Oil & Gas Integrated"
    },
    "financialData": {
      "pl": 5.23,
      "forwardPE": 4.85,
      "earningsYield": 0.1912,
      "pvp": 0.89,
      "dy": 0.15,
      "evEbitda": 3.45,
      "evEbit": 4.12,
      "evRevenue": 0.78,
      "psr": 1.23,
      "pAtivos": 0.56,
      "pCapGiro": 2.34,
      "pEbit": 4.12,
      "lpa": 2.45,
      "trailingEps": 2.45,
      "vpa": 28.90,
      "marketCap": 450000000000,
      "enterpriseValue": 520000000000,
      "sharesOutstanding": 13000000000,
      "totalAssets": 800000000000,
      "dividaLiquidaPl": 0.35,
      "dividaLiquidaEbitda": 1.25,
      "liquidezCorrente": 1.45,
      "liquidezRapida": 1.12,
      "passivoAtivos": 0.65,
      "debtToEquity": 0.52,
      "roe": 0.25,
      "roic": 0.18,
      "roa": 0.12,
      "margemBruta": 0.35,
      "margemEbitda": 0.28,
      "margemLiquida": 0.15,
      "giroAtivos": 0.65,
      "cagrLucros5a": 0.12,
      "crescimentoLucros": 0.08,
      "crescimentoReceitas": 0.15,
      "dividendYield12m": 0.15,
      "ultimoDividendo": 0.85,
      "dataUltimoDividendo": "2025-01-10",
      "payout": 0.45,
      "variacao52Semanas": 0.25,
      "retornoAnoAtual": 0.18,
      "ebitda": 150000000000,
      "receitaTotal": 350000000000,
      "lucroLiquido": 52000000000,
      "fluxoCaixaOperacional": 120000000000,
      "fluxoCaixaInvestimento": -45000000000,
      "fluxoCaixaFinanciamento": -30000000000,
      "fluxoCaixaLivre": 75000000000,
      "totalCaixa": 45000000000,
      "totalDivida": 180000000000,
      "receitaPorAcao": 26.92,
      "caixaPorAcao": 3.46,
      "ativoCirculante": 120000000000,
      "ativoTotal": 800000000000,
      "passivoCirculante": 85000000000,
      "passivoTotal": 520000000000,
      "patrimonioLiquido": 280000000000,
      "caixa": 45000000000,
      "estoques": 15000000000,
      "contasReceber": 35000000000,
      "imobilizado": 450000000000,
      "intangivel": 25000000000,
      "dividaCirculante": 45000000000,
      "dividaLongoPrazo": 135000000000,
      "dividendoMaisRecente": 0.85,
      "dataDividendoMaisRecente": "2025-01-10",
      "historicoUltimosDividendos": "0.85,0.75,0.65,0.70",
      "cagrReceitas5a": 0.10,
      "dataSource": "brapi"
    },
    "historicalAverages": {
      "dy": 0.14,
      "dividendYield12m": 0.13,
      "roe": 0.22,
      "roic": 0.18,
      "roa": 0.11,
      "margemBruta": 0.33,
      "margemEbitda": 0.26,
      "margemLiquida": 0.14,
      "payout": 0.42,
      "pl": 5.45,
      "pvp": 0.92,
      "crescimentoLucros": 0.10,
      "crescimentoReceitas": 0.12,
      "liquidezCorrente": 1.38,
      "debtToEquity": 0.48,
      "evEbitda": 3.52
    },
    "year": 2025,
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### 2. Buscar Dados de Múltiplos Tickers

Retorna os dados financeiros TTM de múltiplas empresas em uma única requisição.

**Endpoint:** `GET /api/v1/financial-data?tickers={ticker1},{ticker2},{ticker3}`

**Parâmetros:**

| Parâmetro | Tipo   | Obrigatório | Descrição                                    |
|-----------|--------|-------------|----------------------------------------------|
| tickers   | string | Sim         | Lista de tickers separados por vírgula (máx. 50) |

**Exemplo de Requisição:**

```bash
GET /api/v1/financial-data?tickers=PETR4,VALE3,ITUB4
Authorization: Bearer sua-api-key-aqui
```

**Exemplo de Resposta (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "ticker": "PETR4",
      "company": {
        "name": "Petróleo Brasileiro S.A. - Petrobras",
        "sector": "Energy",
        "industry": "Oil & Gas Integrated"
      },
          "financialData": {
            "pl": 5.23,
            "dy": 0.15,
            "roe": 0.25
            // ... todos os outros campos
          },
          "historicalAverages": {
            "dy": 0.14,
            "roe": 0.22,
            "roic": 0.18
            // ... outras médias históricas
          },
          "year": 2025,
          "updatedAt": "2025-01-15T10:30:00.000Z"
        },
    {
      "ticker": "VALE3",
      "company": {
        "name": "Vale S.A.",
        "sector": "Basic Materials",
        "industry": "Steel & Iron"
      },
      "financialData": {
        "pl": 6.45,
        "dy": 0.12,
        "roe": 0.22
        // ... todos os outros campos
      },
      "year": 2025,
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "ticker": "ITUB4",
      "company": {
        "name": "Itaú Unibanco Holding S.A.",
        "sector": "Financial Services",
        "industry": "Banks"
      },
      "financialData": {
        "pl": 8.90,
        "dy": 0.08,
        "roe": 0.18
        // ... todos os outros campos
      },
      "year": 2025,
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "notFound": []
}
```

**Resposta com Tickers Não Encontrados:**

```json
{
  "success": true,
  "data": [
    {
      "ticker": "PETR4",
      "company": { ... },
      "financialData": { ... }
    }
  ],
  "notFound": ["INVALID", "FAKE4"]
}
```

---

## 📊 Campos Retornados

A API retorna mais de 70 campos financeiros organizados nas seguintes categorias:

### Indicadores de Valuation

| Campo          | Tipo    | Descrição                                    | Unidade |
|----------------|---------|----------------------------------------------|---------|
| pl             | number  | Preço/Lucro (P/L)                            | múltiplo |
| forwardPE      | number  | Preço/Lucro Projetado                        | múltiplo |
| earningsYield  | number  | Rentabilidade sobre o Preço (Earnings Yield) | decimal |
| pvp            | number  | Preço/Valor Patrimonial (P/VP)               | múltiplo |
| dy             | number  | Dividend Yield                                | decimal |
| evEbitda       | number  | Enterprise Value/EBITDA                      | múltiplo |
| evEbit         | number  | Enterprise Value/EBIT                        | múltiplo |
| evRevenue      | number  | Enterprise Value/Receita                      | múltiplo |
| psr            | number  | Preço/Receita (P/S)                          | múltiplo |
| pAtivos        | number  | Preço/Ativos                                  | múltiplo |
| pCapGiro       | number  | Preço/Capital de Giro                        | múltiplo |
| pEbit          | number  | Preço/EBIT                                    | múltiplo |

### Indicadores por Ação

| Campo      | Tipo   | Descrição                          | Unidade |
|------------|--------|------------------------------------|---------|
| lpa        | number | Lucro por Ação                     | R$/ação |
| trailingEps| number | Lucro por Ação (TTM)               | R$/ação |
| vpa        | number | Valor Patrimonial por Ação         | R$/ação |
| receitaPorAcao | number | Receita por Ação               | R$/ação |
| caixaPorAcao   | number | Caixa por Ação                 | R$/ação |

### Dados de Mercado

| Campo            | Tipo   | Descrição                          | Unidade      |
|------------------|--------|------------------------------------|--------------|
| marketCap        | number | Valor de Mercado                   | R$           |
| enterpriseValue  | number | Valor da Empresa                   | R$           |
| sharesOutstanding| number | Ações em Circulação                | quantidade   |

### Indicadores de Rentabilidade

| Campo        | Tipo   | Descrição                                    | Unidade |
|--------------|--------|----------------------------------------------|---------|
| roe          | number | Retorno sobre Patrimônio Líquido             | decimal |
| roic         | number | Retorno sobre Capital Investido              | decimal |
| roa          | number | Retorno sobre Ativos                         | decimal |
| margemBruta  | number | Margem Bruta                                 | decimal |
| margemEbitda | number | Margem EBITDA                                | decimal |
| margemLiquida| number | Margem Líquida                               | decimal |
| giroAtivos   | number | Giro de Ativos                               | decimal |

### Indicadores de Endividamento e Liquidez

| Campo              | Tipo   | Descrição                          | Unidade |
|--------------------|--------|------------------------------------|---------|
| dividaLiquidaPl    | number | Dívida Líquida/Patrimônio Líquido  | múltiplo |
| dividaLiquidaEbitda| number | Dívida Líquida/EBITDA              | múltiplo |
| liquidezCorrente   | number | Liquidez Corrente                  | múltiplo |
| liquidezRapida     | number | Liquidez Rápida                    | múltiplo |
| passivoAtivos      | number | Passivo/Ativos                     | decimal |
| debtToEquity       | number | Dívida/Patrimônio                  | múltiplo |

### Indicadores de Crescimento

| Campo              | Tipo   | Descrição                                    | Unidade |
|--------------------|--------|----------------------------------------------|---------|
| cagrLucros5a       | number | CAGR dos Lucros (5 anos)                    | decimal |
| crescimentoLucros  | number | Crescimento dos Lucros (anual)              | decimal |
| crescimentoReceitas| number | Crescimento das Receitas (anual)             | decimal |
| cagrReceitas5a     | number | CAGR das Receitas (5 anos)                  | decimal |

### Dados Operacionais

| Campo                    | Tipo   | Descrição                          | Unidade |
|--------------------------|--------|------------------------------------|---------|
| ebitda                   | number | EBITDA                             | R$      |
| receitaTotal             | number | Receita Total                      | R$      |
| lucroLiquido            | number | Lucro Líquido                      | R$      |
| fluxoCaixaOperacional   | number | Fluxo de Caixa Operacional        | R$      |
| fluxoCaixaInvestimento  | number | Fluxo de Caixa de Investimento    | R$      |
| fluxoCaixaFinanciamento | number | Fluxo de Caixa de Financiamento   | R$      |
| fluxoCaixaLivre         | number | Fluxo de Caixa Livre (FCF)        | R$      |

### Dados de Caixa e Dívida

| Campo            | Tipo   | Descrição                          | Unidade |
|------------------|--------|------------------------------------|---------|
| totalCaixa       | number | Total de Caixa e Equivalentes      | R$      |
| totalDivida      | number | Total de Dívida                    | R$      |
| dividaCirculante | number | Dívida de Curto Prazo              | R$      |
| dividaLongoPrazo | number | Dívida de Longo Prazo              | R$      |

### Dados do Balanço Patrimonial

| Campo              | Tipo   | Descrição                          | Unidade |
|--------------------|--------|------------------------------------|---------|
| ativoCirculante    | number | Ativo Circulante                   | R$      |
| ativoTotal         | number | Ativo Total                        | R$      |
| passivoCirculante  | number | Passivo Circulante                 | R$      |
| passivoTotal       | number | Passivo Total                      | R$      |
| patrimonioLiquido  | number | Patrimônio Líquido                 | R$      |
| caixa              | number | Caixa e Equivalentes               | R$      |
| estoques           | number | Estoques                           | R$      |
| contasReceber      | number | Contas a Receber                  | R$      |
| imobilizado        | number | Imobilizado                        | R$      |
| intangivel         | number | Intangível                         | R$      |
| totalAssets        | number | Total de Ativos                    | R$      |

### Dados de Dividendos

| Campo                    | Tipo   | Descrição                          | Unidade |
|--------------------------|--------|------------------------------------|---------|
| dividendYield12m         | number | Dividend Yield (12 meses)          | decimal |
| ultimoDividendo          | number | Último Dividendo Pago             | R$/ação |
| dataUltimoDividendo      | string | Data do Último Dividendo          | ISO date |
| payout                   | number | Payout Ratio                       | decimal |
| dividendoMaisRecente     | number | Dividendo Mais Recente             | R$/ação |
| dataDividendoMaisRecente | string | Data do Dividendo Mais Recente    | ISO date |
| historicoUltimosDividendos| string | Histórico dos Últimos Dividendos  | string  |

### Indicadores de Performance

| Campo            | Tipo   | Descrição                          | Unidade |
|------------------|--------|------------------------------------|---------|
| variacao52Semanas| number | Variação de Preço (52 semanas)    | decimal |
| retornoAnoAtual  | number | Retorno no Ano Atual              | decimal |

### Metadados

| Campo     | Tipo   | Descrição                          |
|-----------|--------|------------------------------------|
| year      | number | Ano de referência dos dados TTM    |
| updatedAt | string | Data/hora da última atualização    |
| dataSource| string | Fonte dos dados (ex: "brapi")      |

### Médias Históricas (historicalAverages)

A API retorna também uma seção `historicalAverages` contendo as médias dos últimos 5 anos (excluindo o ano atual) para os seguintes indicadores:

| Campo              | Tipo   | Descrição                                    |
|--------------------|--------|----------------------------------------------|
| dy                 | number | Média do Dividend Yield (últimos 5 anos)     |
| dividendYield12m   | number | Média do Dividend Yield 12 meses            |
| roe                | number | Média do Retorno sobre Patrimônio            |
| roic               | number | Média do Retorno sobre Capital Investido     |
| roa                | number | Média do Retorno sobre Ativos                |
| margemBruta        | number | Média da Margem Bruta                        |
| margemEbitda       | number | Média da Margem EBITDA                       |
| margemLiquida      | number | Média da Margem Líquida                      |
| payout             | number | Média do Payout Ratio                        |
| pl                 | number | Média do Preço/Lucro                         |
| pvp                | number | Média do Preço/Valor Patrimonial              |
| crescimentoLucros  | number | Média do Crescimento de Lucros               |
| crescimentoReceitas| number | Média do Crescimento de Receitas             |
| liquidezCorrente   | number | Média da Liquidez Corrente                   |
| debtToEquity       | number | Média da Dívida/Patrimônio                   |
| evEbitda           | number | Média do EV/EBITDA                           |

**Nota:** Se não houver dados históricos suficientes, `historicalAverages` será `null`. Os valores são calculados apenas com anos completos (excluindo o ano atual).

---

## ⚠️ Códigos de Erro

### 400 Bad Request

Requisição inválida (ticker inválido, formato incorreto, etc.)

```json
{
  "success": false,
  "error": "Ticker inválido ou formato incorreto",
  "code": "INVALID_TICKER"
}
```

### 401 Unauthorized

API key ausente ou inválida

```json
{
  "success": false,
  "error": "Não autorizado. API key inválida ou ausente",
  "code": "UNAUTHORIZED"
}
```

### 404 Not Found

Ticker não encontrado (apenas no endpoint de ticker único)

```json
{
  "success": false,
  "error": "Ticker não encontrado",
  "code": "TICKER_NOT_FOUND"
}
```

### 429 Too Many Requests

Rate limit excedido

```json
{
  "success": false,
  "error": "Muitas requisições. Limite de 100 requisições por minuto",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

### 500 Internal Server Error

Erro interno do servidor

```json
{
  "success": false,
  "error": "Erro interno do servidor",
  "code": "INTERNAL_ERROR"
}
```

---

## 🚦 Rate Limiting

A API possui rate limiting de **100 requisições por minuto** por IP.

### Headers de Rate Limit

Todas as respostas incluem headers informativos sobre o rate limit:

- `X-RateLimit-Limit`: Limite de requisições por minuto (100)
- `X-RateLimit-Remaining`: Requisições restantes no período atual
- `X-RateLimit-Reset`: Timestamp de quando o limite será resetado

### Exemplo de Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

### Tratamento de Rate Limit

Quando o limite é excedido, a API retorna:

- Status: `429 Too Many Requests`
- Header `Retry-After`: Segundos até poder fazer nova requisição

---

## 💻 Exemplos de Integração

### cURL

#### Buscar um ticker

```bash
curl -X GET "https://seu-dominio.com/api/v1/financial-data/PETR4" \
  -H "Authorization: Bearer sua-api-key-aqui" \
  -H "Content-Type: application/json"
```

#### Buscar múltiplos tickers

```bash
curl -X GET "https://seu-dominio.com/api/v1/financial-data?tickers=PETR4,VALE3,ITUB4" \
  -H "Authorization: Bearer sua-api-key-aqui" \
  -H "Content-Type: application/json"
```

### JavaScript (Node.js / Fetch API)

```javascript
async function getFinancialData(tickers) {
  const url = Array.isArray(tickers)
    ? `https://seu-dominio.com/api/v1/financial-data?tickers=${tickers.join(',')}`
    : `https://seu-dominio.com/api/v1/financial-data/${tickers}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer sua-api-key-aqui',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar dados');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro:', error.message);
    throw error;
  }
}

// Uso
getFinancialData('PETR4').then(data => {
  console.log('Dados:', data);
});

// Múltiplos tickers
getFinancialData(['PETR4', 'VALE3', 'ITUB4']).then(data => {
  console.log('Dados:', data);
});
```

### Python

```python
import requests
from typing import List, Union, Dict, Any

API_BASE_URL = "https://seu-dominio.com/api/v1/financial-data"
API_KEY = "sua-api-key-aqui"

def get_financial_data(tickers: Union[str, List[str]]) -> Dict[str, Any]:
    """
    Busca dados financeiros TTM de um ou múltiplos tickers
    
    Args:
        tickers: String com um ticker ou lista de tickers
        
    Returns:
        Dict com os dados financeiros
    """
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    if isinstance(tickers, list):
        tickers_str = ",".join(tickers)
        url = f"{API_BASE_URL}?tickers={tickers_str}"
    else:
        url = f"{API_BASE_URL}/{tickers}"
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        error_data = e.response.json() if e.response.content else {}
        raise Exception(error_data.get('error', 'Erro ao buscar dados'))
    except Exception as e:
        raise Exception(f"Erro na requisição: {str(e)}")

# Uso
if __name__ == "__main__":
    # Um ticker
    data = get_financial_data("PETR4")
    print(f"P/L: {data['data']['financialData']['pl']}")
    print(f"ROE: {data['data']['financialData']['roe']}")
    
    # Múltiplos tickers
    data = get_financial_data(["PETR4", "VALE3", "ITUB4"])
    for company in data['data']:
        print(f"{company['ticker']}: P/L = {company['financialData']['pl']}")
```

### PHP

```php
<?php

class FinancialDataAPI {
    private $baseUrl = "https://seu-dominio.com/api/v1/financial-data";
    private $apiKey = "sua-api-key-aqui";
    
    public function getFinancialData($tickers) {
        $headers = [
            "Authorization: Bearer " . $this->apiKey,
            "Content-Type: application/json"
        ];
        
        if (is_array($tickers)) {
            $tickersStr = implode(',', $tickers);
            $url = $this->baseUrl . "?tickers=" . urlencode($tickersStr);
        } else {
            $url = $this->baseUrl . "/" . urlencode($tickers);
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            $error = json_decode($response, true);
            throw new Exception($error['error'] ?? 'Erro ao buscar dados');
        }
        
        return json_decode($response, true);
    }
}

// Uso
$api = new FinancialDataAPI();

// Um ticker
$data = $api->getFinancialData("PETR4");
echo "P/L: " . $data['data']['financialData']['pl'] . "\n";

// Múltiplos tickers
$data = $api->getFinancialData(["PETR4", "VALE3", "ITUB4"]);
foreach ($data['data'] as $company) {
    echo $company['ticker'] . ": P/L = " . $company['financialData']['pl'] . "\n";
}
?>
```

### Go

```go
package main

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "strings"
)

const (
    APIBaseURL = "https://seu-dominio.com/api/v1/financial-data"
    APIKey     = "sua-api-key-aqui"
)

type FinancialDataResponse struct {
    Success bool `json:"success"`
    Data    interface{} `json:"data"`
    Error   string `json:"error,omitempty"`
}

func GetFinancialData(tickers []string) (*FinancialDataResponse, error) {
    var url string
    if len(tickers) == 1 {
        url = fmt.Sprintf("%s/%s", APIBaseURL, tickers[0])
    } else {
        url = fmt.Sprintf("%s?tickers=%s", APIBaseURL, strings.Join(tickers, ","))
    }
    
    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", APIKey))
    req.Header.Set("Content-Type", "application/json")
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    if resp.StatusCode != http.StatusOK {
        var errorResp FinancialDataResponse
        json.Unmarshal(body, &errorResp)
        return nil, fmt.Errorf("erro: %s", errorResp.Error)
    }
    
    var result FinancialDataResponse
    err = json.Unmarshal(body, &result)
    if err != nil {
        return nil, err
    }
    
    return &result, nil
}

func main() {
    // Um ticker
    data, err := GetFinancialData([]string{"PETR4"})
    if err != nil {
        fmt.Printf("Erro: %v\n", err)
        return
    }
    fmt.Printf("Dados: %+v\n", data)
    
    // Múltiplos tickers
    data, err = GetFinancialData([]string{"PETR4", "VALE3", "ITUB4"})
    if err != nil {
        fmt.Printf("Erro: %v\n", err)
        return
    }
    fmt.Printf("Dados: %+v\n", data)
}
```

---

## 📝 Notas Importantes

### Formato de Valores

- **Percentuais**: Valores como `dy`, `roe`, `margemLiquida` são retornados como decimais (ex: 0.15 = 15%)
- **Múltiplos**: Valores como `pl`, `pvp` são retornados como números (ex: 5.23 = 5.23x)
- **Valores Monetários**: Valores em R$ são retornados como números (ex: 450000000000 = R$ 450 bilhões)
- **Datas**: Datas são retornadas no formato ISO 8601 (YYYY-MM-DD)

### Valores Nulos

Alguns campos podem retornar `null` quando:
- O dado não está disponível para aquela empresa
- O cálculo não é aplicável ao setor da empresa
- O dado ainda não foi atualizado

Sempre verifique se o valor é `null` antes de usar em cálculos.

### Limites

- **Máximo de tickers por requisição**: 50 tickers
- **Rate limit**: 100 requisições por minuto
- **Timeout**: 30 segundos por requisição

### Atualização dos Dados

Os dados TTM são atualizados diariamente. O campo `updatedAt` indica quando os dados foram atualizados pela última vez.

### Tickers Suportados

A API suporta todos os tickers listados na B3:
- Ações ordinárias (ex: PETR3, VALE3)
- Ações preferenciais (ex: PETR4, VALE5)
- BDRs (ex: AAPL34, MSFT34)
- ETFs (ex: BOVA11, SMAL11)
- FIIs (ex: HGLG11, XPLG11)

---

## 🔒 Segurança

### Boas Práticas

1. **Nunca exponha sua API key** em código cliente ou repositórios públicos
2. **Use HTTPS** sempre (a API só funciona via HTTPS em produção)
3. **Implemente retry logic** com backoff exponencial para lidar com rate limits
4. **Valide os dados** recebidos antes de usar em produção
5. **Monitore o uso** da API para evitar atingir limites

### Armazenamento Seguro da API Key

```javascript
// ❌ NÃO FAÇA ISSO
const API_KEY = "sua-api-key-aqui"; // Exposto no código

// ✅ FAÇA ISSO
const API_KEY = process.env.API_KEY; // Variável de ambiente
```

---

## 📞 Suporte

Para dúvidas, problemas ou solicitação de API keys, entre em contato:

- **Email**: suporte@seu-dominio.com
- **Documentação**: https://docs.seu-dominio.com
- **Status da API**: https://status.seu-dominio.com

---

## 📄 Changelog

### v1.0.0 (2025-01-15)
- Lançamento inicial da API
- Suporte a consulta de ticker único e múltiplos tickers
- Retorno de 70+ indicadores financeiros TTM
- Autenticação via Bearer Token
- Rate limiting de 100 req/min

---

## 📚 Recursos Adicionais

- [Glossário de Indicadores Financeiros](https://docs.seu-dominio.com/glossary)
- [Guia de Boas Práticas](https://docs.seu-dominio.com/best-practices)
- [FAQ](https://docs.seu-dominio.com/faq)


