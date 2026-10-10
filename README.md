# Preço Justo AI - SaaS de Análise Fundamentalista

Uma plataforma SaaS que simplifica a análise fundamentalista de ações para investidores pessoa física, utilizando modelos de valuation consagrados e o poder da IA.

## Antes de cada nova implementação

Antes de cada nova implementação, consulte [`docs/vault/00 - Início.md`](docs/vault/00%20-%20In%C3%ADcio.md) (segundo cérebro do projeto: decisões do dono, fórmulas dos modelos, arquitetura, armadilhas e pendências; abre como vault do Obsidian) e [`docs/harness/README.md`](docs/harness/README.md) (método de implementação multiagente: papéis, ondas e lotes, regras de segurança e scripts).

> O `.env` aponta para o banco de **produção**: não rode `yarn build`/`npm run build` (executa `prisma db push`) nem migrações contra ele. Ambiente local em [`scripts/local/README.md`](scripts/local/README.md).

## 🚀 Tecnologias

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **UI Components:** shadcn/ui
- **Backend:** Next.js API Routes
- **Banco de Dados:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **Autenticação:** NextAuth.js
- **IA:** Google Gemini API

## 📋 Pré-requisitos

- Node.js 18+ e npm
- Conta no Supabase (PostgreSQL)
- Conta no Google Cloud (para OAuth e Gemini)

## ⚙️ Configuração

1. **Clone e instale dependências:**
```bash
git clone <repository-url>
cd analisador-acoes
npm install
``` 

2. **Configure as variáveis de ambiente:**
Crie um arquivo `.env` na raiz do projeto baseado no `env.example`:

```env
# Database (Supabase)
DATABASE_URL="postgresql://username:password@db.host.com:5432/database_name?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://username:password@db.host.com:5432/database_name"

# NextAuth.js
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

3. **Configure o banco de dados:**
```bash
# Gerar o cliente Prisma
npx prisma generate

# Executar as migrações
npx prisma db push

# (Opcional) Visualizar o banco
npx prisma studio
```

4. **Execute o projeto:**
```bash
npm run dev
```

## 🗃️ Estrutura do Banco de Dados

O projeto utiliza os seguintes modelos principais:

- **User:** Usuários da plataforma com sistema de assinatura
- **Company:** Empresas listadas na B3
- **FinancialData:** Indicadores fundamentalistas das empresas
- **DailyQuote:** Cotações históricas
- **Portfolio:** Carteiras de investimento dos usuários

## 🔐 Autenticação

A aplicação suporta dois métodos de autenticação:
- **Credentials:** Email/senha com bcrypt
- **Google OAuth:** Login social

## 📊 Funcionalidades

### Nível Gratuito
- Ranking básico usando Fórmula de Graham
- Visualização de até 10 empresas
- Dados fundamentalistas básicos

### Nível Premium
- Múltiplos modelos de valuation
- Análise completa com IA (Gemini)
- Criação e gestão de carteiras
- Backtesting avançado
- Rankings ilimitados

## 🛠️ Desenvolvimento

```bash
# Executar em modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar worker de ingestão de dados
npm run fetch:data

# Testar API de ranking
npm run test:rank-builder

# Executar linting
npm run lint
```

## 🔄 Worker de Ingestão de Dados

O projeto inclui um script TypeScript para buscar dados de ações brasileiras:

```bash
# Plano gratuito (1 ação por vez)
npm run fetch:data:free

# Plano pago (10 ações por lote) 
npm run fetch:data:paid

# Script padrão (gratuito)
npm run fetch:data
```

**Funcionalidades:**
- ✅ 45+ tickers principais do BOVESPA
- ✅ **65 indicadores fundamentalistas** extraídos por ação (**62/65 disponíveis tipicamente ~95%**)
- ✅ 100% compatível com plano gratuito da Brapi  
- ✅ **TODOS os dados críticos funcionam!** (**ROE, ROA, Margem Bruta, EBITDA**, etc.)
- ✅ **Balanço Patrimonial completo** - 12+ campos de ativos, passivos, patrimônio líquido
- ✅ **63+ dividendos históricos** - último dividendo, datas, tipos, histórico completo
- ✅ **8 indicadores calculados** - P/Ativos, ROIC, Giro Ativos, Dívida Líquida/PL, etc.
- ✅ Suporte para upgrade automático ao plano pago
- ✅ Integração com Brapi API oficial (4 módulos + dividends=true)
- ✅ Rate limiting adaptativo por plano
- ✅ Cálculos proprietários para indicadores não disponíveis na API

**Configuração:**
```env
# Opcional - para rate limiting maior
BRAPI_TOKEN="seu-token-brapi"
```

Veja documentação completa em [`scripts/README.md`](scripts/README.md).

## 🎯 API de Ranking (/api/rank-builder)

A API de ranking implementa 4 modelos de valuation **aprimorados** com filtros de qualidade para evitar armadilhas comuns:

### 📊 Modelos Disponíveis

**1. Graham Quality Model (`graham`)**
```json
{
  "model": "graham",
  "params": { "marginOfSafety": 0.3 }
}
```
- ✅ **Fórmula Original**: Preço Justo = √(22.5 × LPA × VPA)
- 🛡️ **Filtros de Qualidade**: ROE ≥ 10%, Liquidez ≥ 1.0, Margem Líquida > 0%, Dívida/PL ≤ 150%
- 📊 **Score de Qualidade**: Prioriza empresas sólidas dentro da margem de segurança
- 🎯 **Retorna**: preço justo, potencial de alta, margem de segurança + qualityScore

**2. Anti-Dividend Trap Model (`dividendYield`)**
```json
{
  "model": "dividendYield", 
  "params": { "minYield": 0.06 }
}
```
- 🚨 **Problema Resolvido**: Evita "dividend traps" (empresas que pagam DY alto mas estão em declínio)
- 🛡️ **Filtros Anti-Trap**: ROE ≥ 10%, LC ≥ 1.2, P/L entre 4-25, Margem Líquida ≥ 5%, Market Cap ≥ R$ 1B
- 📊 **Sustainability Score**: Combina DY + sustentabilidade financeira
- 💡 **Ideal**: Renda passiva sustentável, não armadilhas

**3. Value Investing Model (`lowPE`)**
```json
{
  "model": "lowPE",
  "params": { "maxPE": 15, "minROE": 0.15 }
}
```
- 💎 **Filosofia**: P/L baixo + empresas de qualidade (não "value traps")
- 🔍 **Filtros Rigorosos**: ROA ≥ 5%, Margem Líquida ≥ 3%, Crescimento Receitas > -10%, LC ≥ 1.0
- 📊 **Value Score**: Combina preço atrativo + indicadores de qualidade
- 🎯 **Busca**: Empresas baratas MAS rentáveis e saudáveis

**4. Enhanced Magic Formula (`magicFormula`)**
```json
{
  "model": "magicFormula",
  "params": { "limit": 10 }
}
```
- 🧙‍♂️ **Base Greenblatt**: ROIC + Earnings Yield ranking
- ✨ **Melhorias**: ROIC ajustado por margem e crescimento, filtros de qualidade adicionais
- 🛡️ **Filtros Extras**: ROE ≥ 8%, Margem EBITDA ≥ 10%, Crescimento > -15%, LC ≥ 1.0
- 🏆 **Resultado**: Empresas com qualidade E preço atrativo (não apenas baratas)

### 📋 Campo Rational - Transparência Total

Cada resposta da API inclui dois níveis de racional:

**1. Racional Geral da Estratégia** (`rational` na resposta principal):
```json
{
  "model": "graham",
  "rational": "🧮 **MODELO GRAHAM APRIMORADO**\n\n📚 **Filosofia**: Baseado na fórmula clássica de Benjamin Graham...",
  "results": [...]
}
```

**2. Racional Individual de Cada Empresa** (`rational` em cada resultado):
```json
{
  "ticker": "VALE3",
  "name": "Vale S.A.",
  "rational": "✅ Aprovada no Graham Quality Model com 35.2% de margem de segurança. Empresa sólida: ROE 15.3%, LC 1.45, Margem Líquida 12.8%. Score de qualidade: 78.5/100."
}
```

### 🧪 Testando a API

```bash
# Testar todos os modelos com racionais detalhados
npm run test:rank-builder

# Ou testar manualmente:
curl -X POST http://localhost:3000/api/rank-builder \
  -H "Content-Type: application/json" \
  -d '{"model": "graham", "params": {"marginOfSafety": 0.2}}'
```

**Resposta Exemplo com Rational:**
```json
{
  "model": "graham",
  "rational": "🧮 MODELO GRAHAM APRIMORADO - Filosofia, filtros e critérios...",
  "results": [
    {
      "ticker": "VALE3",
      "rational": "✅ Aprovada no Graham Quality Model com 35.2% de margem...",
      "fairValue": 125.50,
      "marginOfSafety": 35.2,
      "key_metrics": {...}
    }
  ]
}
```

## 📁 Estrutura do Projeto

```
src/
├── app/                 # App Router do Next.js
│   ├── api/            # API Routes
│   ├── login/          # Página de login
│   ├── register/       # Página de registro
│   └── globals.css     # Estilos globais
├── components/         # Componentes React
│   └── ui/            # Componentes shadcn/ui
├── lib/               # Utilitários
│   ├── auth.ts        # Configuração NextAuth
│   └── prisma.ts      # Cliente Prisma
├── providers/         # Providers do React
└── types/            # Tipos TypeScript

scripts/
├── fetch-data.ts       # Worker de ingestão de dados
└── README.md          # Documentação dos scripts
```

## 🚧 Próximos Passos

1. ✅ ~~Implementar worker de ingestão de dados (Brapi API)~~ - **CONCLUÍDO**
2. ✅ ~~Desenvolver API de ranking com 4 modelos de valuation aprimorados~~ - **CONCLUÍDO**
3. ✅ ~~Adicionar campo 'rational' para transparência total da estratégia~~ - **CONCLUÍDO**
4. Criar interface frontend para ferramenta de ranking rápido
5. Criar páginas individuais de ativos
6. Integrar Google Gemini para análise IA
7. Implementar sistema de pagamento PIX
8. Desenvolver sistema de backtesting

## 📄 Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.