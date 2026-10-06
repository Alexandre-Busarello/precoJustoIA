/**
 * Seed LOCAL do Preço Justo AI (somente banco Docker local).
 *
 * Uso:
 *   DATABASE_URL=postgresql://postgres:local@localhost:55432/pja \
 *   DIRECT_URL=postgresql://postgres:local@localhost:55432/pja \
 *   npx tsx scripts/local/seed-local.ts
 *
 * - Aborta imediatamente se DATABASE_URL/DIRECT_URL não apontarem para localhost/127.0.0.1.
 * - Idempotente: faz TRUNCATE (local) das tabelas que semeia e reinsere tudo.
 * - Os dados são plausíveis (ordens de grandeza próximas da realidade de 2025/2026),
 *   mas NÃO são dados reais. Séries de preço são passeios aleatórios determinísticos
 *   (seed fixa por ticker) calibrados para terminar no preço atual definido abaixo.
 * - Também pré-popula os "caches de IA" (relatórios mensais, análise técnica, projeções
 *   do radar de dividendos, projeções IBOV) para que abrir páginas NÃO dispare chamadas
 *   ao Gemini. Rode o seed de novo a cada dia de uso (a análise técnica do Radar é diária).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1) GUARDA DE SEGURANÇA — precisa ser a primeira lógica executada.
// ─────────────────────────────────────────────────────────────────────────────
const LOCAL_HOST_RE = /(^|[@/])(localhost|127\.0\.0\.1)([:/]|$)/
function assertLocalDatabase(): void {
  const dbUrl = process.env.DATABASE_URL ?? ''
  const directUrl = process.env.DIRECT_URL ?? ''
  const bgUrl = process.env.BACKGROUND_PROCESS_POSTGRES ?? ''
  const problems: string[] = []
  if (!(dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) || !LOCAL_HOST_RE.test(dbUrl)) {
    problems.push('DATABASE_URL não aponta para localhost/127.0.0.1')
  }
  if (directUrl && !LOCAL_HOST_RE.test(directUrl)) problems.push('DIRECT_URL não aponta para localhost/127.0.0.1')
  if (bgUrl && !LOCAL_HOST_RE.test(bgUrl)) problems.push('BACKGROUND_PROCESS_POSTGRES não aponta para localhost/127.0.0.1')
  if (problems.length > 0) {
    console.error('\n❌ ABORTADO: este seed só roda contra o banco LOCAL.')
    for (const p of problems) console.error('   - ' + p)
    console.error('   Exemplo: DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=$DATABASE_URL npx tsx scripts/local/seed-local.ts\n')
    process.exit(1)
  }
}
assertLocalDatabase()

// Importes de tipo são apagados na compilação; o client real é importado dinamicamente em main()
// (depois da guarda), para que nada relacionado a banco seja carregado antes da verificação.
import type { PrismaClient as PrismaClientType } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { TechnicalIndicators, type PriceData } from '../../src/lib/technical-indicators'
import { combineLevels } from '../../src/lib/support-resistance'

// ─────────────────────────────────────────────────────────────────────────────
// 2) Utilitários determinísticos
// ─────────────────────────────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type Rng = () => number
function gauss(rng: Rng): number {
  const u = Math.max(rng(), 1e-12)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
/** Arredonda e devolve null se não for finito (evita NaN/Infinity em colunas Decimal). */
function r(x: number | null | undefined, digits = 6): number | null {
  if (x === null || x === undefined || !Number.isFinite(x)) return null
  const f = Math.pow(10, digits)
  return Math.round(x * f) / f
}
function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x))
}
/** Data "calendário" (sem hora) em UTC, para colunas @db.Date. */
function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day))
}
function ymd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Hoje no fuso local da máquina (mesma convenção de quote-service.ensureTodayPrice).
const NOW = new Date()
const TODAY = d(NOW.getFullYear(), NOW.getMonth() + 1, NOW.getDate())
const CURRENT_YEAR = NOW.getFullYear()
const DAY_MS = 86400000

// ─────────────────────────────────────────────────────────────────────────────
// 3) Universo de ativos
// ─────────────────────────────────────────────────────────────────────────────
type DivFreq = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'none'
interface StockDef {
  ticker: string
  name: string
  sector: string
  industry: string
  type: 'STOCK' | 'BDR'
  price: number // preço atual (R$)
  shares: number // ações (ou BDR-equivalentes) em circulação
  revenue: number // receita anual atual (R$)
  netMargin: number
  ebitdaMargin: number | null // null para bancos/seguradoras
  grossMargin: number | null
  roe: number
  netDebtEbitda: number | null
  dy: number
  revGrowth: number // crescimento anual médio da receita
  cagr10: number // CAGR do preço nos últimos 10 anos (para calibrar a série)
  vol: number // volatilidade anual
  adtv: number // volume financeiro médio diário (R$)
  currentRatio: number | null
  divFreq: DivFreq
  jcp?: boolean
  financial?: boolean
  city: string
  state: string
  country?: string
  employees: number
  website: string
  description: string
}

// Preços "atuais" ancorados nas cotações que o próprio app buscou no Yahoo em 2026-09-29: ao abrir páginas o app
// grava a cotação real do dia por cima do seed, então ancorar evita saltos artificiais no fim dos gráficos.
const STOCKS: StockDef[] = [
  { ticker: 'PETR4', name: 'Petróleo Brasileiro S.A. - Petrobras', sector: 'Energia', industry: 'Petróleo, Gás e Biocombustíveis', type: 'STOCK', price: 48.54, shares: 12.89e9, revenue: 490e9, netMargin: 0.16, ebitdaMargin: 0.45, grossMargin: 0.5, roe: 0.21, netDebtEbitda: 1.4, dy: 0.115, revGrowth: 0.04, cagr10: 0.14, vol: 0.32, adtv: 1.6e9, currentRatio: 0.95, divFreq: 'quarterly', jcp: true, city: 'Rio de Janeiro', state: 'RJ', employees: 41000, website: 'https://petrobras.com.br', description: 'A Petrobras é a maior empresa de energia do Brasil, atuando em exploração e produção de petróleo e gás natural, refino, logística e comercialização de derivados. O pré-sal responde pela maior parte da produção.' },
  { ticker: 'VALE3', name: 'Vale S.A.', sector: 'Materiais Básicos', industry: 'Mineração', type: 'STOCK', price: 69.62, shares: 4.27e9, revenue: 212e9, netMargin: 0.15, ebitdaMargin: 0.4, grossMargin: 0.36, roe: 0.16, netDebtEbitda: 0.9, dy: 0.08, revGrowth: 0.02, cagr10: 0.17, vol: 0.3, adtv: 1.5e9, currentRatio: 1.1, divFreq: 'semiannual', jcp: true, city: 'Rio de Janeiro', state: 'RJ', employees: 64000, website: 'https://vale.com', description: 'A Vale é uma das maiores mineradoras do mundo, líder na produção de minério de ferro e pelotas, com operações relevantes em níquel e cobre voltadas à transição energética.' },
  { ticker: 'ITUB4', name: 'Itaú Unibanco Holding S.A.', sector: 'Financeiro', industry: 'Bancos', type: 'STOCK', price: 41.62, shares: 9.8e9, revenue: 175e9, netMargin: 0.24, ebitdaMargin: null, grossMargin: null, roe: 0.22, netDebtEbitda: null, dy: 0.075, revGrowth: 0.07, cagr10: 0.1, vol: 0.22, adtv: 1.0e9, currentRatio: null, divFreq: 'monthly', jcp: true, financial: true, city: 'São Paulo', state: 'SP', employees: 96000, website: 'https://www.itau.com.br', description: 'O Itaú Unibanco é o maior banco privado do Brasil, com atuação em varejo, atacado, cartões, seguros e gestão de recursos, além de presença na América Latina.' },
  { ticker: 'BBDC4', name: 'Banco Bradesco S.A.', sector: 'Financeiro', industry: 'Bancos', type: 'STOCK', price: 17.57, shares: 10.6e9, revenue: 140e9, netMargin: 0.15, ebitdaMargin: null, grossMargin: null, roe: 0.12, netDebtEbitda: null, dy: 0.08, revGrowth: 0.04, cagr10: 0.01, vol: 0.27, adtv: 7.0e8, currentRatio: null, divFreq: 'monthly', jcp: true, financial: true, city: 'Osasco', state: 'SP', employees: 84000, website: 'https://www.bradesco.com.br', description: 'O Bradesco é um dos maiores bancos privados do país, com forte presença no varejo, no segmento de seguros (Bradesco Seguros) e ampla rede de atendimento.' },
  { ticker: 'BBAS3', name: 'Banco do Brasil S.A.', sector: 'Financeiro', industry: 'Bancos', type: 'STOCK', price: 21.77, shares: 5.73e9, revenue: 135e9, netMargin: 0.17, ebitdaMargin: null, grossMargin: null, roe: 0.14, netDebtEbitda: null, dy: 0.09, revGrowth: 0.05, cagr10: 0.09, vol: 0.28, adtv: 8.0e8, currentRatio: null, divFreq: 'quarterly', jcp: true, financial: true, city: 'Brasília', state: 'DF', employees: 86000, website: 'https://www.bb.com.br', description: 'O Banco do Brasil é um banco de economia mista controlado pela União, líder no crédito ao agronegócio e com grande base de clientes pessoa física e setor público.' },
  { ticker: 'WEGE3', name: 'WEG S.A.', sector: 'Bens Industriais', industry: 'Máquinas e Equipamentos', type: 'STOCK', price: 49.93, shares: 4.19e9, revenue: 41e9, netMargin: 0.16, ebitdaMargin: 0.21, grossMargin: 0.33, roe: 0.3, netDebtEbitda: -0.2, dy: 0.02, revGrowth: 0.12, cagr10: 0.2, vol: 0.28, adtv: 4.0e8, currentRatio: 1.8, divFreq: 'quarterly', jcp: true, city: 'Jaraguá do Sul', state: 'SC', employees: 45000, website: 'https://www.weg.net', description: 'A WEG fabrica motores elétricos, geradores, transformadores e sistemas de automação, com fábricas em diversos países e forte exposição a energia renovável e eletrificação.' },
  { ticker: 'TAEE11', name: 'Transmissora Aliança de Energia Elétrica S.A. - Taesa', sector: 'Utilidade Pública', industry: 'Energia Elétrica', type: 'STOCK', price: 40.25, shares: 344e6, revenue: 3.9e9, netMargin: 0.36, ebitdaMargin: 0.75, grossMargin: 0.8, roe: 0.16, netDebtEbitda: 3.5, dy: 0.1, revGrowth: 0.05, cagr10: 0.09, vol: 0.18, adtv: 1.1e8, currentRatio: 1.6, divFreq: 'quarterly', jcp: true, city: 'Rio de Janeiro', state: 'RJ', employees: 900, website: 'https://www.taesa.com.br', description: 'A Taesa é uma das maiores transmissoras de energia elétrica do Brasil, com receitas reguladas (RAP) e contratos de concessão de longo prazo.' },
  { ticker: 'EGIE3', name: 'Engie Brasil Energia S.A.', sector: 'Utilidade Pública', industry: 'Energia Elétrica', type: 'STOCK', price: 28.94, shares: 816e6, revenue: 11e9, netMargin: 0.24, ebitdaMargin: 0.55, grossMargin: 0.5, roe: 0.28, netDebtEbitda: 2.5, dy: 0.07, revGrowth: 0.04, cagr10: 0.06, vol: 0.2, adtv: 1.3e8, currentRatio: 1.2, divFreq: 'semiannual', jcp: true, city: 'Florianópolis', state: 'SC', employees: 1400, website: 'https://www.engie.com.br', description: 'A Engie Brasil é a maior geradora privada de energia do país, com portfólio majoritariamente renovável (hidrelétricas, eólicas e solares) e ativos de transmissão.' },
  { ticker: 'ABEV3', name: 'Ambev S.A.', sector: 'Consumo Não Cíclico', industry: 'Bebidas', type: 'STOCK', price: 15.14, shares: 15.75e9, revenue: 89e9, netMargin: 0.165, ebitdaMargin: 0.31, grossMargin: 0.5, roe: 0.16, netDebtEbitda: -0.6, dy: 0.06, revGrowth: 0.05, cagr10: -0.01, vol: 0.2, adtv: 4.0e8, currentRatio: 1.0, divFreq: 'semiannual', jcp: true, city: 'São Paulo', state: 'SP', employees: 43000, website: 'https://www.ambev.com.br', description: 'A Ambev é a maior cervejaria da América Latina, dona de marcas como Brahma, Skol e Antarctica, e distribuidora de refrigerantes e bebidas não alcoólicas.' },
  { ticker: 'MGLU3', name: 'Magazine Luiza S.A.', sector: 'Consumo Cíclico', industry: 'Comércio', type: 'STOCK', price: 6.71, shares: 770e6, revenue: 38e9, netMargin: 0.004, ebitdaMargin: 0.08, grossMargin: 0.3, roe: 0.03, netDebtEbitda: 1.5, dy: 0.0, revGrowth: 0.03, cagr10: 0.12, vol: 0.6, adtv: 1.8e8, currentRatio: 1.3, divFreq: 'none', city: 'Franca', state: 'SP', employees: 36000, website: 'https://ri.magazineluiza.com.br', description: 'O Magazine Luiza é uma varejista multicanal de eletrodomésticos, eletrônicos e móveis, com marketplace próprio e ecossistema de serviços financeiros e logísticos.' },
  { ticker: 'RENT3', name: 'Localiza Rent a Car S.A.', sector: 'Consumo Cíclico', industry: 'Diversos', type: 'STOCK', price: 38.0, shares: 1.07e9, revenue: 37e9, netMargin: 0.05, ebitdaMargin: 0.3, grossMargin: 0.35, roe: 0.07, netDebtEbitda: 3.0, dy: 0.02, revGrowth: 0.08, cagr10: 0.13, vol: 0.38, adtv: 3.5e8, currentRatio: 1.5, divFreq: 'quarterly', jcp: true, city: 'Belo Horizonte', state: 'MG', employees: 22000, website: 'https://ri.localiza.com', description: 'A Localiza é a maior locadora de veículos e gestora de frotas da América Latina, também atuante na venda de seminovos.' },
  { ticker: 'SUZB3', name: 'Suzano S.A.', sector: 'Materiais Básicos', industry: 'Madeira e Papel', type: 'STOCK', price: 44.18, shares: 1.24e9, revenue: 50e9, netMargin: 0.12, ebitdaMargin: 0.45, grossMargin: 0.38, roe: 0.13, netDebtEbitda: 3.2, dy: 0.04, revGrowth: 0.06, cagr10: 0.11, vol: 0.3, adtv: 3.0e8, currentRatio: 2.2, divFreq: 'annual', jcp: true, city: 'Salvador', state: 'BA', employees: 20000, website: 'https://ri.suzano.com.br', description: 'A Suzano é a maior produtora de celulose de eucalipto do mundo, com operações integradas de florestas, fábricas e logística voltadas à exportação.' },
  { ticker: 'PRIO3', name: 'PRIO S.A.', sector: 'Energia', industry: 'Petróleo, Gás e Biocombustíveis', type: 'STOCK', price: 60.93, shares: 850e6, revenue: 14e9, netMargin: 0.38, ebitdaMargin: 0.65, grossMargin: 0.6, roe: 0.25, netDebtEbitda: 1.2, dy: 0.0, revGrowth: 0.2, cagr10: 0.45, vol: 0.42, adtv: 4.0e8, currentRatio: 1.7, divFreq: 'none', city: 'Rio de Janeiro', state: 'RJ', employees: 1200, website: 'https://ri.prio3.com.br', description: 'A PRIO é a maior petroleira independente do Brasil, focada na aquisição e revitalização de campos maduros offshore na Bacia de Campos.' },
  { ticker: 'B3SA3', name: 'B3 S.A. - Brasil, Bolsa, Balcão', sector: 'Financeiro', industry: 'Serviços Financeiros Diversos', type: 'STOCK', price: 17.66, shares: 5.3e9, revenue: 10.8e9, netMargin: 0.44, ebitdaMargin: 0.65, grossMargin: 0.85, roe: 0.22, netDebtEbitda: 0.3, dy: 0.05, revGrowth: 0.05, cagr10: 0.07, vol: 0.3, adtv: 4.5e8, currentRatio: 1.4, divFreq: 'quarterly', jcp: true, city: 'São Paulo', state: 'SP', employees: 2900, website: 'https://www.b3.com.br', description: 'A B3 é a bolsa de valores do Brasil, responsável pela negociação, compensação, liquidação e depósito de ações, derivativos, renda fixa e outros ativos.' },
  { ticker: 'ELET3', name: 'Centrais Elétricas Brasileiras S.A. - Eletrobras', sector: 'Utilidade Pública', industry: 'Energia Elétrica', type: 'STOCK', price: 45.2, shares: 2.25e9, revenue: 40e9, netMargin: 0.13, ebitdaMargin: 0.5, grossMargin: 0.55, roe: 0.05, netDebtEbitda: 3.0, dy: 0.03, revGrowth: 0.03, cagr10: 0.2, vol: 0.32, adtv: 5.0e8, currentRatio: 1.5, divFreq: 'annual', jcp: false, city: 'Rio de Janeiro', state: 'RJ', employees: 8000, website: 'https://ri.eletrobras.com', description: 'A Eletrobras é a maior companhia de energia elétrica da América Latina, com grande parque de geração hidrelétrica e extensa rede de transmissão.' },
  { ticker: 'RADL3', name: 'Raia Drogasil S.A.', sector: 'Saúde', industry: 'Comércio e Distribuição', type: 'STOCK', price: 17.97, shares: 1.72e9, revenue: 41e9, netMargin: 0.032, ebitdaMargin: 0.07, grossMargin: 0.28, roe: 0.17, netDebtEbitda: 1.0, dy: 0.015, revGrowth: 0.12, cagr10: 0.09, vol: 0.3, adtv: 2.5e8, currentRatio: 1.4, divFreq: 'quarterly', jcp: true, city: 'São Paulo', state: 'SP', employees: 60000, website: 'https://ri.rdsaude.com.br', description: 'A RD Saúde (Raia Drogasil) é a maior rede de farmácias do Brasil, com mais de 3 mil lojas e plataforma digital de saúde.' },
  { ticker: 'SBSP3', name: 'Cia. de Saneamento Básico do Estado de São Paulo - Sabesp', sector: 'Utilidade Pública', industry: 'Água e Saneamento', type: 'STOCK', price: 26.63, shares: 2.99e9, revenue: 36e9, netMargin: 0.18, ebitdaMargin: 0.42, grossMargin: 0.45, roe: 0.2, netDebtEbitda: 2.3, dy: 0.02, revGrowth: 0.09, cagr10: 0.17, vol: 0.25, adtv: 4.0e8, currentRatio: 1.1, divFreq: 'annual', jcp: true, city: 'São Paulo', state: 'SP', employees: 11000, website: 'https://ri.sabesp.com.br', description: 'A Sabesp é a maior empresa de saneamento das Américas em número de clientes, privatizada em 2024, com plano de universalização de água e esgoto em São Paulo.' },
  { ticker: 'CMIG4', name: 'Cia. Energética de Minas Gerais - Cemig', sector: 'Utilidade Pública', industry: 'Energia Elétrica', type: 'STOCK', price: 10.79, shares: 2.86e9, revenue: 40e9, netMargin: 0.16, ebitdaMargin: 0.2, grossMargin: 0.3, roe: 0.21, netDebtEbitda: 1.3, dy: 0.1, revGrowth: 0.04, cagr10: 0.08, vol: 0.28, adtv: 2.0e8, currentRatio: 1.3, divFreq: 'semiannual', jcp: true, city: 'Belo Horizonte', state: 'MG', employees: 5000, website: 'https://ri.cemig.com.br', description: 'A Cemig é uma companhia integrada de energia de Minas Gerais, com operações em geração, transmissão, distribuição e comercialização de energia elétrica e gás.' },
  { ticker: 'KLBN11', name: 'Klabin S.A.', sector: 'Materiais Básicos', industry: 'Madeira e Papel', type: 'STOCK', price: 18.0, shares: 1.23e9, revenue: 20e9, netMargin: 0.12, ebitdaMargin: 0.36, grossMargin: 0.34, roe: 0.18, netDebtEbitda: 3.8, dy: 0.06, revGrowth: 0.06, cagr10: 0.06, vol: 0.24, adtv: 1.6e8, currentRatio: 2.0, divFreq: 'quarterly', jcp: true, city: 'São Paulo', state: 'SP', employees: 26000, website: 'https://ri.klabin.com.br', description: 'A Klabin é a maior produtora e exportadora de papéis para embalagens do Brasil, com atuação em celulose, papel cartão, kraftliner e embalagens de papelão ondulado.' },
  { ticker: 'VIVT3', name: 'Telefônica Brasil S.A. - Vivo', sector: 'Comunicações', industry: 'Telecomunicações', type: 'STOCK', price: 29.44, shares: 3.25e9, revenue: 58e9, netMargin: 0.105, ebitdaMargin: 0.41, grossMargin: 0.45, roe: 0.09, netDebtEbitda: 0.8, dy: 0.07, revGrowth: 0.07, cagr10: 0.04, vol: 0.2, adtv: 2.2e8, currentRatio: 0.9, divFreq: 'quarterly', jcp: true, city: 'São Paulo', state: 'SP', employees: 34000, website: 'https://ri.telefonica.com.br', description: 'A Vivo é líder em telefonia móvel e fibra óptica no Brasil, com estratégia de ecossistema digital incluindo serviços financeiros, saúde e educação.' },
  { ticker: 'BBSE3', name: 'BB Seguridade Participações S.A.', sector: 'Financeiro', industry: 'Previdência e Seguros', type: 'STOCK', price: 38.73, shares: 1.98e9, revenue: 10.5e9, netMargin: 0.8, ebitdaMargin: null, grossMargin: null, roe: 0.8, netDebtEbitda: null, dy: 0.1, revGrowth: 0.08, cagr10: 0.06, vol: 0.2, adtv: 1.8e8, currentRatio: null, divFreq: 'semiannual', financial: true, city: 'Brasília', state: 'DF', employees: 250, website: 'https://www.bbseguridaderi.com.br', description: 'A BB Seguridade é a holding de seguros, previdência, capitalização e resseguros do Banco do Brasil, distribuindo produtos pela rede de agências do banco.' },
  { ticker: 'CPLE6', name: 'Cia. Paranaense de Energia - Copel', sector: 'Utilidade Pública', industry: 'Energia Elétrica', type: 'STOCK', price: 11.4, shares: 2.98e9, revenue: 23e9, netMargin: 0.11, ebitdaMargin: 0.28, grossMargin: 0.3, roe: 0.1, netDebtEbitda: 2.3, dy: 0.06, revGrowth: 0.04, cagr10: 0.14, vol: 0.28, adtv: 1.5e8, currentRatio: 1.4, divFreq: 'semiannual', jcp: true, city: 'Curitiba', state: 'PR', employees: 5500, website: 'https://ri.copel.com', description: 'A Copel atua em geração, transmissão, distribuição e comercialização de energia no Paraná; tornou-se corporação sem controlador definido após a privatização em 2023.' },
  { ticker: 'LREN3', name: 'Lojas Renner S.A.', sector: 'Consumo Cíclico', industry: 'Comércio', type: 'STOCK', price: 11.15, shares: 960e6, revenue: 15e9, netMargin: 0.09, ebitdaMargin: 0.2, grossMargin: 0.55, roe: 0.13, netDebtEbitda: -0.3, dy: 0.04, revGrowth: 0.07, cagr10: -0.02, vol: 0.38, adtv: 2.0e8, currentRatio: 1.9, divFreq: 'quarterly', jcp: true, city: 'Porto Alegre', state: 'RS', employees: 24000, website: 'https://lojasrenner.mzweb.com.br', description: 'A Lojas Renner é a maior varejista de moda do Brasil, operando as marcas Renner, Camicado, Youcom e a fintech Realize.' },
  { ticker: 'HAPV3', name: 'Hapvida Participações e Investimentos S.A.', sector: 'Saúde', industry: 'Serviços Médico-Hospitalares', type: 'STOCK', price: 6.23, shares: 7.5e9, revenue: 30e9, netMargin: 0.03, ebitdaMargin: 0.13, grossMargin: 0.3, roe: 0.03, netDebtEbitda: 1.3, dy: 0.0, revGrowth: 0.06, cagr10: -0.05, vol: 0.5, adtv: 2.5e8, currentRatio: 1.2, divFreq: 'none', city: 'Fortaleza', state: 'CE', employees: 68000, website: 'https://ri.hapvida.com.br', description: 'A Hapvida é a maior operadora verticalizada de planos de saúde do Brasil, com rede própria de hospitais, clínicas e laboratórios.' },
  { ticker: 'EMBR3', name: 'Embraer S.A.', sector: 'Bens Industriais', industry: 'Material de Transporte', type: 'STOCK', price: 76.5, shares: 734e6, revenue: 38e9, netMargin: 0.065, ebitdaMargin: 0.13, grossMargin: 0.19, roe: 0.14, netDebtEbitda: 0.5, dy: 0.005, revGrowth: 0.15, cagr10: 0.14, vol: 0.4, adtv: 4.5e8, currentRatio: 1.5, divFreq: 'annual', jcp: false, city: 'São José dos Campos', state: 'SP', employees: 19000, website: 'https://ri.embraer.com.br', description: 'A Embraer é a terceira maior fabricante de aeronaves comerciais do mundo, com atuação em aviação executiva, defesa e segurança e serviços.' },
  // BDRs (valores em R$, por BDR; "shares" = ações da empresa x razão do BDR)
  { ticker: 'AAPL34', name: 'Apple Inc.', sector: 'Tecnologia da Informação', industry: 'Hardware e Equipamentos', type: 'BDR', price: 86.45, shares: 15.0e9 * 20, revenue: 391e9 * 5.4, netMargin: 0.24, ebitdaMargin: 0.34, grossMargin: 0.46, roe: 1.4, netDebtEbitda: 0.3, dy: 0.005, revGrowth: 0.05, cagr10: 0.27, vol: 0.3, adtv: 6.0e7, currentRatio: 0.9, divFreq: 'quarterly', city: 'Cupertino', state: 'CA', country: 'United States', employees: 164000, website: 'https://www.apple.com', description: 'A Apple projeta e vende iPhone, Mac, iPad, wearables e serviços digitais (App Store, iCloud, Apple Music). BDR negociado na B3 com lastro em ações da Nasdaq.' },
  { ticker: 'MSFT34', name: 'Microsoft Corporation', sector: 'Tecnologia da Informação', industry: 'Programas e Serviços', type: 'BDR', price: 110.47, shares: 7.43e9 * 24, revenue: 262e9 * 5.4, netMargin: 0.36, ebitdaMargin: 0.55, grossMargin: 0.69, roe: 0.33, netDebtEbitda: -0.2, dy: 0.007, revGrowth: 0.14, cagr10: 0.3, vol: 0.27, adtv: 4.0e7, currentRatio: 1.3, divFreq: 'quarterly', city: 'Redmond', state: 'WA', country: 'United States', employees: 228000, website: 'https://www.microsoft.com', description: 'A Microsoft desenvolve software, serviços de nuvem (Azure), produtividade (Microsoft 365), jogos e soluções de inteligência artificial. BDR com lastro em ações da Nasdaq.' },
  { ticker: 'NVDC34', name: 'NVIDIA Corporation', sector: 'Tecnologia da Informação', industry: 'Semicondutores', type: 'BDR', price: 25.05, shares: 24.4e9 * 48, revenue: 165e9 * 5.4, netMargin: 0.53, ebitdaMargin: 0.63, grossMargin: 0.72, roe: 1.0, netDebtEbitda: -0.4, dy: 0.0003, revGrowth: 0.5, cagr10: 0.6, vol: 0.5, adtv: 1.2e8, currentRatio: 4.0, divFreq: 'quarterly', city: 'Santa Clara', state: 'CA', country: 'United States', employees: 36000, website: 'https://www.nvidia.com', description: 'A NVIDIA projeta GPUs e plataformas de computação acelerada usadas em data centers, inteligência artificial, jogos e automação. BDR com lastro em ações da Nasdaq.' },
]

interface FiiDef {
  ticker: string
  name: string
  segment: string
  isPapel: boolean
  price: number
  pvp: number
  dy: number
  vacancia: number | null
  qtdImoveis: number | null
  capRate: number | null
  liquidez: number
  cotas: number
  cagr10: number
  vol: number
  description: string
}
const FIIS: FiiDef[] = [
  { ticker: 'HGLG11', name: 'Pátria Log Fundo de Investimento Imobiliário', segment: 'Logística', isPapel: false, price: 147.35, pvp: 0.98, dy: 0.086, vacancia: 0.055, qtdImoveis: 24, capRate: 0.085, liquidez: 9.5e6, cotas: 33.8e6, cagr10: 0.02, vol: 0.14, description: 'FII de galpões logísticos e industriais de alto padrão, com imóveis localizados majoritariamente no raio de 30 km da cidade de São Paulo.' },
  { ticker: 'MXRF11', name: 'Maxi Renda Fundo de Investimento Imobiliário', segment: 'Títulos e Val. Mob.', isPapel: true, price: 9.62, pvp: 1.01, dy: 0.123, vacancia: null, qtdImoveis: null, capRate: null, liquidez: 1.6e7, cotas: 420e6, cagr10: 0.0, vol: 0.1, description: 'FII de papel com carteira diversificada de CRIs (majoritariamente high yield e high grade indexados ao CDI e IPCA) e participações em outros FIIs.' },
  { ticker: 'KNRI11', name: 'Kinea Renda Imobiliária FII', segment: 'Híbrido', isPapel: false, price: 150.1, pvp: 0.93, dy: 0.08, vacancia: 0.07, qtdImoveis: 19, capRate: 0.078, liquidez: 5.0e6, cotas: 28.5e6, cagr10: 0.0, vol: 0.12, description: 'FII híbrido com portfólio de lajes corporativas e galpões logísticos em São Paulo, Rio de Janeiro e Minas Gerais, gerido pela Kinea.' },
  { ticker: 'XPML11', name: 'XP Malls Fundo de Investimento Imobiliário', segment: 'Shoppings', isPapel: false, price: 104.8, pvp: 0.95, dy: 0.094, vacancia: 0.04, qtdImoveis: 16, capRate: 0.09, liquidez: 1.1e7, cotas: 55e6, cagr10: 0.01, vol: 0.15, description: 'FII de participações em shopping centers dominantes em suas regiões, com contratos de aluguel mínimo e percentual sobre vendas.' },
  { ticker: 'VISC11', name: 'Vinci Shopping Centers FII', segment: 'Shoppings', isPapel: false, price: 104.2, pvp: 0.87, dy: 0.092, vacancia: 0.045, qtdImoveis: 23, capRate: 0.088, liquidez: 5.5e6, cotas: 29e6, cagr10: 0.0, vol: 0.15, description: 'FII com participações em shoppings de diferentes perfis e regiões do Brasil, gerido pela Vinci Partners.' },
  { ticker: 'BTLG11', name: 'BTG Pactual Logística FII', segment: 'Logística', isPapel: false, price: 101.4, pvp: 0.97, dy: 0.09, vacancia: 0.03, qtdImoveis: 30, capRate: 0.087, liquidez: 7.0e6, cotas: 38e6, cagr10: 0.02, vol: 0.13, description: 'FII de galpões logísticos modernos e bem localizados, com contratos atípicos de longo prazo com locatários de primeira linha.' },
]

interface EtfDef {
  ticker: string
  name: string
  etfClass: string
  benchmark: string
  price: number
  expense: number
  netAssets: number
  dy: number
  cagr10: number
  vol: number
  divFreq: DivFreq
  holdings: Array<{ ticker: string | null; name: string; weight: number }>
  description: string
}
const ETFS: EtfDef[] = [
  { ticker: 'BOVA11', name: 'iShares Ibovespa Fundo de Índice', etfClass: 'Renda Variável BR', benchmark: 'Ibovespa', price: 141.3, expense: 0.001, netAssets: 16e9, dy: 0, cagr10: 0.1, vol: 0.22, divFreq: 'none', holdings: [
    { ticker: 'VALE3', name: 'Vale ON', weight: 0.11 }, { ticker: 'ITUB4', name: 'Itaú Unibanco PN', weight: 0.08 }, { ticker: 'PETR4', name: 'Petrobras PN', weight: 0.075 }, { ticker: 'ELET3', name: 'Eletrobras ON', weight: 0.045 }, { ticker: 'BBDC4', name: 'Bradesco PN', weight: 0.035 }, { ticker: 'B3SA3', name: 'B3 ON', weight: 0.03 }, { ticker: 'BBAS3', name: 'Banco do Brasil ON', weight: 0.028 }, { ticker: 'WEGE3', name: 'WEG ON', weight: 0.027 }, { ticker: 'SBSP3', name: 'Sabesp ON', weight: 0.026 }, { ticker: 'ABEV3', name: 'Ambev ON', weight: 0.025 },
  ], description: 'ETF que replica o Ibovespa, principal índice da bolsa brasileira, oferecendo exposição diversificada às maiores e mais negociadas ações da B3.' },
  { ticker: 'IVVB11', name: 'iShares S&P 500 Fundo de Índice', etfClass: 'Internacional', benchmark: 'S&P 500 (em reais)', price: 382.5, expense: 0.0023, netAssets: 7.5e9, dy: 0, cagr10: 0.2, vol: 0.2, divFreq: 'none', holdings: [
    { ticker: null, name: 'NVIDIA Corp', weight: 0.074 }, { ticker: null, name: 'Microsoft Corp', weight: 0.066 }, { ticker: null, name: 'Apple Inc', weight: 0.061 }, { ticker: null, name: 'Amazon.com Inc', weight: 0.039 }, { ticker: null, name: 'Meta Platforms Inc', weight: 0.029 }, { ticker: null, name: 'Broadcom Inc', weight: 0.025 }, { ticker: null, name: 'Alphabet Inc A', weight: 0.021 }, { ticker: null, name: 'Tesla Inc', weight: 0.018 },
  ], description: 'ETF que replica o S&P 500 em reais (sem proteção cambial), dando exposição às 500 maiores empresas listadas nos Estados Unidos.' },
  { ticker: 'SMAL11', name: 'iShares BM&FBovespa Small Cap Fundo de Índice', etfClass: 'Renda Variável BR', benchmark: 'Índice Small Cap (SMLL)', price: 104.6, expense: 0.005, netAssets: 1.3e9, dy: 0, cagr10: 0.06, vol: 0.28, divFreq: 'none', holdings: [
    { ticker: null, name: 'Cyrela ON', weight: 0.035 }, { ticker: null, name: 'Marcopolo PN', weight: 0.033 }, { ticker: 'CPLE6', name: 'Copel PNB', weight: 0.03 }, { ticker: null, name: 'Smartfit ON', weight: 0.03 }, { ticker: null, name: 'Direcional ON', weight: 0.028 }, { ticker: 'MGLU3', name: 'Magazine Luiza ON', weight: 0.02 }, { ticker: 'LREN3', name: 'Lojas Renner ON', weight: 0.02 },
  ], description: 'ETF que replica o índice de Small Caps da B3, composto por empresas de menor capitalização com maior potencial de crescimento e volatilidade.' },
  { ticker: 'DIVO11', name: 'It Now IDIV Fundo de Índice', etfClass: 'Dividendos', benchmark: 'Índice Dividendos (IDIV)', price: 96.4, expense: 0.005, netAssets: 0.55e9, dy: 0.06, cagr10: 0.11, vol: 0.18, divFreq: 'quarterly', holdings: [
    { ticker: 'ITUB4', name: 'Itaú Unibanco PN', weight: 0.09 }, { ticker: 'BBAS3', name: 'Banco do Brasil ON', weight: 0.085 }, { ticker: 'PETR4', name: 'Petrobras PN', weight: 0.08 }, { ticker: 'BBSE3', name: 'BB Seguridade ON', weight: 0.06 }, { ticker: 'TAEE11', name: 'Taesa UNT', weight: 0.055 }, { ticker: 'CMIG4', name: 'Cemig PN', weight: 0.05 }, { ticker: 'VIVT3', name: 'Vivo ON', weight: 0.045 }, { ticker: 'EGIE3', name: 'Engie Brasil ON', weight: 0.04 },
  ], description: 'ETF que replica o IDIV, índice das ações com maior dividend yield e consistência de proventos da B3.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 4) Geração de séries de preço
// ─────────────────────────────────────────────────────────────────────────────
interface DailyBar {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}
/** Passeio aleatório diário (10 anos, dias úteis) que termina exatamente em `endPrice`. */
function genDailySeries(ticker: string, endPrice: number, cagr10: number, vol: number, adtv: number, years = 10): DailyBar[] {
  const rng = mulberry32(hashStr('px:' + ticker))
  const dates: Date[] = []
  const start = new Date(TODAY.getTime() - Math.round(years * 365.25) * DAY_MS)
  for (let t = start.getTime(); t <= TODAY.getTime(); t += DAY_MS) {
    const dt = new Date(t)
    const wd = dt.getUTCDay()
    if (wd !== 0 && wd !== 6) dates.push(dt)
  }
  // garante "hoje" presente mesmo em fim de semana (evita ensureTodayPrice buscar no Yahoo)
  if (ymd(dates[dates.length - 1]) !== ymd(TODAY)) dates.push(new Date(TODAY))
  const n = dates.length
  const sigma = vol / Math.sqrt(252)
  // regimes para dar "cara" de mercado (ciclos de alta/baixa)
  const rets: number[] = []
  let regime = 0
  for (let i = 0; i < n - 1; i++) {
    if (i % 90 === 0) regime = (rng() - 0.5) * 0.004
    rets.push(regime + sigma * gauss(rng))
  }
  const startPrice = endPrice / Math.pow(1 + cagr10, years)
  const target = Math.log(endPrice / startPrice)
  const sum = rets.reduce((a, b) => a + b, 0)
  const adj = (target - sum) / rets.length
  const closes = [startPrice]
  for (const x of rets) closes.push(closes[closes.length - 1] * Math.exp(x + adj))
  closes[closes.length - 1] = endPrice
  const bars: DailyBar[] = []
  for (let i = 0; i < n; i++) {
    const c = closes[i]
    const o = i === 0 ? c : closes[i - 1] * (1 + sigma * 0.2 * gauss(rng))
    const hi = Math.max(o, c) * (1 + Math.abs(sigma * 0.6 * gauss(rng)))
    const lo = Math.min(o, c) * (1 - Math.abs(sigma * 0.6 * gauss(rng)))
    const volBrl = adtv * (0.6 + rng() * 0.8)
    bars.push({ date: dates[i], open: o, high: hi, low: lo, close: c, volume: Math.max(100, Math.round(volBrl / c)) })
  }
  return bars
}
/** Agrega em barras mensais (data = 1º dia do mês, como o Yahoo 1mo). */
function toMonthly(bars: DailyBar[]): DailyBar[] {
  const map = new Map<string, DailyBar>()
  for (const b of bars) {
    const key = `${b.date.getUTCFullYear()}-${b.date.getUTCMonth()}`
    const m = map.get(key)
    if (!m) {
      map.set(key, { date: d(b.date.getUTCFullYear(), b.date.getUTCMonth() + 1, 1), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })
    } else {
      m.high = Math.max(m.high, b.high)
      m.low = Math.min(m.low, b.low)
      m.close = b.close
      m.volume += b.volume
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
}
function closeAtYearEnd(bars: DailyBar[], year: number): number | null {
  let last: number | null = null
  for (const b of bars) {
    if (b.date.getUTCFullYear() === year) last = b.close
    else if (b.date.getUTCFullYear() > year) break
  }
  return last
}
function closeOnOrBefore(bars: DailyBar[], date: Date): number {
  let last = bars[0].close
  for (const b of bars) {
    if (b.date.getTime() <= date.getTime()) last = b.close
    else break
  }
  return last
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) Dividendos
// ─────────────────────────────────────────────────────────────────────────────
interface Div {
  exDate: Date
  paymentDate: Date
  amount: number
  type: string
}
function genDividends(ticker: string, freq: DivFreq, dy: number, bars: DailyBar[], jcp = false, years = 5): Div[] {
  if (freq === 'none' || dy <= 0) return []
  const rng = mulberry32(hashStr('div:' + ticker))
  const months: number[] =
    freq === 'monthly' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      : freq === 'quarterly' ? [3, 6, 9, 12].map((m) => ((m + (hashStr(ticker) % 3) - 1 + 11) % 12) + 1)
        : freq === 'semiannual' ? [4, 10].map((m) => ((m + (hashStr(ticker) % 2) - 1) % 12) + 1)
          : [4 + (hashStr(ticker) % 3)]
  const perYear = months.length
  const out: Div[] = []
  const firstYear = TODAY.getUTCFullYear() - years
  for (let y = firstYear; y <= TODAY.getUTCFullYear(); y++) {
    for (const m of months) {
      const day = freq === 'monthly' ? 1 + (hashStr(ticker) % 5) : 10 + Math.floor(rng() * 15)
      const ex = d(y, m, Math.min(day, 28))
      if (ex.getTime() >= TODAY.getTime() || ex.getTime() < bars[0].date.getTime()) continue
      const px = closeOnOrBefore(bars, ex)
      const amount = (px * dy * (0.8 + rng() * 0.4)) / perYear
      const pay = new Date(ex.getTime() + (freq === 'monthly' ? 30 : 20 + Math.floor(rng() * 40)) * DAY_MS)
      const isJcp = jcp && (freq === 'monthly' ? true : rng() < 0.5)
      out.push({ exDate: ex, paymentDate: pay, amount: r(amount, 6)!, type: isJcp ? 'JCP' : 'DIVIDENDO' })
    }
  }
  return out
}
function genRadarProjections(divs: Div[], ticker: string) {
  if (divs.length === 0) return []
  const rng = mulberry32(hashStr('radar:' + ticker))
  const lastYearCut = new Date(TODAY.getTime() - 366 * DAY_MS)
  const recent = divs.filter((x) => x.exDate >= lastYearCut)
  const byMonth = new Map<number, number[]>()
  for (const x of recent) {
    const m = x.exDate.getUTCMonth() + 1
    byMonth.set(m, [...(byMonth.get(m) ?? []), x.amount])
  }
  const out: Array<{ month: number; year: number; projectedExDate: string; projectedAmount: number; confidence: number }> = []
  for (let k = 0; k < 12; k++) {
    const dt = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + k, 1))
    const m = dt.getUTCMonth() + 1
    const amounts = byMonth.get(m)
    if (!amounts) continue
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const day = k === 0 ? Math.max(TODAY.getUTCDate(), 15) : 15
    out.push({
      month: m,
      year: dt.getUTCFullYear(),
      projectedExDate: ymd(d(dt.getUTCFullYear(), m, Math.min(day, 28))),
      projectedAmount: r(avg * (0.95 + rng() * 0.1), 4)!,
      confidence: Math.round(65 + rng() * 25),
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) Fundamentos por ano
// ─────────────────────────────────────────────────────────────────────────────
const FIN_YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 7 + i) // ex.: 2019..2026 (ano atual = TTM)

interface YearFin {
  year: number
  price: number
  revenue: number
  netIncome: number
  ebitda: number | null
  ebit: number | null
  grossProfit: number | null
  equity: number
  totalAssets: number
  cash: number
  totalDebt: number
  netDebt: number
  currentAssets: number
  currentLiab: number
  ocf: number
  capex: number
  fcf: number
  dividendsPaid: number
  dy: number
}
function genYearFins(s: StockDef, bars: DailyBar[]): YearFin[] {
  const rng = mulberry32(hashStr('fin:' + s.ticker))
  const baseNI = s.revenue * s.netMargin
  const baseEquity = baseNI / s.roe
  const leverage = s.financial ? 11 : s.type === 'BDR' ? 3 : 2.3
  const out: YearFin[] = []
  for (const y of FIN_YEARS) {
    const k = y - CURRENT_YEAR
    const noise = 1 + gauss(rng) * 0.04
    const revenue = s.revenue * Math.pow(1 + s.revGrowth, k) * noise
    const nm = s.netMargin * (1 + gauss(rng) * 0.15)
    // um ano ruim ocasional para empresas cíclicas
    const shock = s.vol > 0.35 && y === CURRENT_YEAR - 4 ? -0.6 : 0
    const netIncome = revenue * nm * (1 + shock)
    const equity = baseEquity * Math.pow(1 + s.revGrowth * 0.8, k) * (1 + gauss(rng) * 0.03)
    const ebitda = s.ebitdaMargin !== null ? revenue * s.ebitdaMargin * (1 + gauss(rng) * 0.06) : null
    const ebit = ebitda !== null ? ebitda * 0.78 : null
    const grossProfit = s.grossMargin !== null ? revenue * s.grossMargin * (1 + gauss(rng) * 0.04) : null
    const totalAssets = equity * leverage
    const cash = s.financial ? totalAssets * 0.05 : revenue * (0.1 + rng() * 0.08)
    const netDebt = ebitda !== null && s.netDebtEbitda !== null ? ebitda * s.netDebtEbitda * (1 + gauss(rng) * 0.1) : 0
    const totalDebt = Math.max(0, netDebt + cash)
    const currentAssets = s.financial ? totalAssets * 0.4 : totalAssets * 0.32
    const currentLiab = s.currentRatio ? currentAssets / (s.currentRatio * (1 + gauss(rng) * 0.05)) : totalAssets * 0.3
    const ocf = ebitda !== null ? ebitda * 0.85 : netIncome * 1.1
    const capex = ebitda !== null ? -revenue * 0.07 : -netIncome * 0.1
    const price = y === CURRENT_YEAR ? s.price : (closeAtYearEnd(bars, y) ?? s.price)
    const dyY = s.dy * (0.8 + rng() * 0.4)
    const dividendsPaid = -(price * s.shares * dyY)
    out.push({ year: y, price, revenue, netIncome, ebitda, ebit, grossProfit, equity, totalAssets, cash, totalDebt, netDebt, currentAssets, currentLiab, ocf, capex, fcf: ocf + capex, dividendsPaid, dy: dyY })
  }
  return out
}

function financialDataRow(companyId: number, s: StockDef, fins: YearFin[], idx: number, divs: Div[], bars: DailyBar[]) {
  const f = fins[idx]
  const prev = idx > 0 ? fins[idx - 1] : null
  const five = idx >= 5 ? fins[idx - 5] : null
  const lpa = f.netIncome / s.shares
  const vpa = f.equity / s.shares
  const mcap = f.price * s.shares
  const ev = mcap + f.netDebt
  const isCurrent = f.year === CURRENT_YEAR
  const lastDiv = [...divs].reverse().find((x) => x.exDate.getUTCFullYear() <= f.year)
  const yearStart = closeAtYearEnd(bars, f.year - 1)
  const px52 = closeOnOrBefore(bars, new Date(TODAY.getTime() - 365 * DAY_MS))
  const cagr = (a: number | null | undefined, b: number | null | undefined) => (a && b && a > 0 && b > 0 ? Math.pow(a / b, 1 / 5) - 1 : null)
  const lastDivs = divs.filter((x) => x.exDate.getUTCFullYear() <= f.year).slice(-4)
  const row = {
    companyId,
    year: f.year,
    pl: r(f.price / lpa),
    forwardPE: isCurrent ? r((f.price / lpa) * 0.92) : null,
    earningsYield: r(lpa / f.price),
    pvp: r(f.price / vpa),
    dy: r(f.dy),
    evEbitda: f.ebitda ? r(ev / f.ebitda) : null,
    evEbit: f.ebit ? r(ev / f.ebit) : null,
    evRevenue: s.financial ? null : r(ev / f.revenue),
    psr: r(mcap / f.revenue),
    pAtivos: r(mcap / f.totalAssets),
    pCapGiro: s.financial || f.currentAssets <= f.currentLiab ? null : r(mcap / (f.currentAssets - f.currentLiab)),
    pEbit: f.ebit ? r(mcap / f.ebit) : null,
    lpa: r(lpa),
    trailingEps: r(lpa),
    vpa: r(vpa),
    marketCap: r(mcap, 2),
    enterpriseValue: s.financial ? null : r(ev, 2),
    sharesOutstanding: Math.round(s.shares),
    totalAssets: r(f.totalAssets, 2),
    dividaLiquidaPl: s.financial ? null : r(f.netDebt / f.equity),
    dividaLiquidaEbitda: f.ebitda ? r(f.netDebt / f.ebitda) : null,
    liquidezCorrente: s.financial ? null : r(f.currentAssets / f.currentLiab),
    liquidezRapida: s.financial ? null : r((f.currentAssets * 0.8) / f.currentLiab),
    passivoAtivos: r((f.totalAssets - f.equity) / f.totalAssets),
    debtToEquity: s.financial ? null : r(f.totalDebt / f.equity),
    roe: r(f.netIncome / f.equity),
    roic: f.ebit ? r((f.ebit * 0.66) / (f.equity + Math.max(0, f.netDebt))) : null,
    roa: r(f.netIncome / f.totalAssets),
    margemBruta: f.grossProfit ? r(f.grossProfit / f.revenue) : null,
    margemEbitda: f.ebitda ? r(f.ebitda / f.revenue) : null,
    margemLiquida: r(f.netIncome / f.revenue),
    giroAtivos: r(f.revenue / f.totalAssets),
    cagrLucros5a: five ? r(cagr(f.netIncome, five.netIncome)) : null,
    cagrReceitas5a: five ? r(cagr(f.revenue, five.revenue)) : null,
    crescimentoLucros: prev ? r(f.netIncome / prev.netIncome - 1) : null,
    crescimentoReceitas: prev ? r(f.revenue / prev.revenue - 1) : null,
    dividendYield12m: r(f.dy),
    ultimoDividendo: lastDiv ? r(lastDiv.amount) : null,
    dataUltimoDividendo: lastDiv ? lastDiv.exDate : null,
    payout: lpa > 0 ? r(clamp((f.dy * f.price) / lpa, 0, 1.5)) : null,
    variacao52Semanas: isCurrent ? r(s.price / px52 - 1) : null,
    retornoAnoAtual: yearStart ? r(f.price / yearStart - 1) : null,
    ebitda: r(f.ebitda, 2),
    receitaTotal: r(f.revenue, 2),
    lucroLiquido: r(f.netIncome, 2),
    fluxoCaixaOperacional: r(f.ocf, 2),
    fluxoCaixaInvestimento: r(f.capex * 1.1, 2),
    fluxoCaixaFinanciamento: r(f.dividendsPaid - f.ocf * 0.1, 2),
    fluxoCaixaLivre: r(f.fcf, 2),
    totalCaixa: r(f.cash, 2),
    totalDivida: r(f.totalDebt, 2),
    receitaPorAcao: r(f.revenue / s.shares),
    caixaPorAcao: r(f.cash / s.shares),
    ativoCirculante: r(f.currentAssets, 2),
    ativoTotal: r(f.totalAssets, 2),
    passivoCirculante: r(f.currentLiab, 2),
    passivoTotal: r(f.totalAssets - f.equity, 2),
    patrimonioLiquido: r(f.equity, 2),
    caixa: r(f.cash, 2),
    estoques: s.financial ? null : r(f.revenue * 0.08, 2),
    contasReceber: s.financial ? null : r(f.revenue * 0.12, 2),
    imobilizado: s.financial ? null : r(f.totalAssets * 0.35, 2),
    intangivel: r(f.totalAssets * 0.05, 2),
    dividaCirculante: s.financial ? null : r(f.totalDebt * 0.2, 2),
    dividaLongoPrazo: s.financial ? null : r(f.totalDebt * 0.8, 2),
    dividendoMaisRecente: lastDiv ? r(lastDiv.amount) : null,
    dataDividendoMaisRecente: lastDiv ? lastDiv.exDate : null,
    historicoUltimosDividendos: lastDivs.length ? lastDivs.map((x) => `${ymd(x.exDate)}:${x.amount.toFixed(4)}`).join(';') : null,
    dataSource: 'local-seed',
  }
  // Colunas Decimal(15,6) estouram acima de 1e9: descarta razões absurdas (ex.: capital de giro ~0)
  const RATIO_KEYS = ['pl', 'forwardPE', 'earningsYield', 'pvp', 'dy', 'evEbitda', 'evEbit', 'evRevenue', 'psr', 'pAtivos', 'pCapGiro', 'pEbit', 'lpa', 'trailingEps', 'vpa', 'dividaLiquidaPl', 'dividaLiquidaEbitda', 'liquidezCorrente', 'liquidezRapida', 'passivoAtivos', 'debtToEquity', 'roe', 'roic', 'roa', 'margemBruta', 'margemEbitda', 'margemLiquida', 'giroAtivos', 'cagrLucros5a', 'cagrReceitas5a', 'crescimentoLucros', 'crescimentoReceitas', 'dividendYield12m', 'payout', 'variacao52Semanas', 'retornoAnoAtual', 'receitaPorAcao', 'caixaPorAcao'] as const
  for (const k of RATIO_KEYS) {
    const v = row[k]
    if (typeof v === 'number' && Math.abs(v) >= 1e8) (row as Record<string, unknown>)[k] = null
  }
  return row
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) Conteúdo textual
// ─────────────────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`
const fmtBi = (v: number) => `R$ ${(v / 1e9).toFixed(1).replace('.', ',')} bi`

function monthlyReportContent(s: StockDef, f: YearFin, score: number): string {
  const pl = f.price / (f.netIncome / s.shares)
  return `# ${s.ticker} — Análise mensal (${s.name})

> Relatório gerado localmente pelo seed de desenvolvimento. Conteúdo ilustrativo, não é recomendação de investimento.

## Resumo
A ${s.name.split(' - ')[0]} negocia a **${fmtBRL(s.price)}**, com P/L de **${pl.toFixed(1).replace('.', ',')}x**, ROE de **${fmtPct(f.netIncome / f.equity)}** e dividend yield de **${fmtPct(f.dy)}** nos últimos 12 meses. O score geral da plataforma está em **${score}/100**.

## Pontos positivos
- Receita de ${fmtBi(f.revenue)} nos últimos 12 meses, com crescimento médio de ${fmtPct(s.revGrowth)} ao ano.
- Margem líquida de ${fmtPct(f.netIncome / f.revenue)}${f.ebitda ? ` e margem EBITDA de ${fmtPct(f.ebitda / f.revenue)}` : ''}.
- Posição relevante no setor de ${s.sector.toLowerCase()} (${s.industry}).

## Pontos de atenção
- ${s.netDebtEbitda !== null ? `Alavancagem de ${s.netDebtEbitda.toFixed(1).replace('.', ',')}x dívida líquida/EBITDA.` : 'Sensibilidade do resultado à inadimplência e ao ciclo de juros.'}
- Volatilidade anualizada estimada em ${fmtPct(s.vol)}.
- Resultados sujeitos a fatores macroeconômicos (Selic, câmbio e atividade).

## Conclusão
Os fundamentos seguem ${score >= 70 ? 'sólidos' : score >= 50 ? 'razoáveis, com pontos a monitorar' : 'pressionados'} no mês. Acompanhe os próximos resultados trimestrais e a política de proventos.`
}

const BLOG_POSTS = [
  {
    slug: 'como-calcular-preco-justo-metodo-graham',
    title: 'Como calcular o preço justo de uma ação pelo método de Graham',
    excerpt: 'Entenda a fórmula de Benjamin Graham, quando ela funciona e quais cuidados tomar ao aplicá-la em empresas da B3.',
    category: 'Valuation',
    readTime: '7 min',
    featured: true,
    image: '/image-backtest.png',
    imageAlt: 'Gráfico de backtest de carteira',
    tags: ['graham', 'valuation', 'preço justo'],
    content: `## O que é o preço justo de Graham

Benjamin Graham, mentor de Warren Buffett, propôs uma fórmula simples para estimar o valor intrínseco de uma ação:

**Valor = √(22,5 × LPA × VPA)**

O fator 22,5 vem da combinação de um P/L máximo de 15 com um P/VP máximo de 1,5.

## Exemplo prático

Imagine uma empresa com LPA de R$ 3,00 e VPA de R$ 20,00:

- 22,5 × 3,00 × 20,00 = 1.350
- √1.350 ≈ **R$ 36,74**

Se a ação negocia a R$ 28,00, a margem de segurança é de aproximadamente 31%.

## Quando a fórmula não funciona bem

1. **Empresas de crescimento acelerado** — o lucro atual subestima o potencial.
2. **Empresas com prejuízo** — LPA negativo inviabiliza o cálculo.
3. **Setores com ativos intangíveis relevantes** — o VPA não reflete o valor real.

## Conclusão

A fórmula de Graham é um ótimo ponto de partida para empresas maduras e lucrativas, mas deve ser combinada com outras métricas, como ROE, endividamento e histórico de dividendos.`,
  },
  {
    slug: 'dividend-yield-armadilhas',
    title: 'Dividend Yield alto: oportunidade ou armadilha?',
    excerpt: 'Um DY muito alto pode esconder lucros não recorrentes ou queda forte da cotação. Veja como analisar com cuidado.',
    category: 'Dividendos',
    readTime: '6 min',
    featured: false,
    image: null,
    imageAlt: null,
    tags: ['dividendos', 'dividend yield', 'renda passiva'],
    content: `## O que é Dividend Yield

O Dividend Yield (DY) mede quanto uma ação pagou em proventos nos últimos 12 meses em relação ao seu preço atual.

## Por que um DY alto pode enganar

- **Dividendos extraordinários**: venda de ativos ou lucros não recorrentes inflam o DY de um único ano.
- **Queda da cotação**: se o preço cai muito, o DY sobe mesmo sem aumento de proventos.
- **Payout insustentável**: distribuir mais de 100% do lucro não se sustenta no longo prazo.

## Como analisar

1. Olhe o histórico de pelo menos 5 anos de proventos.
2. Compare o payout com a geração de caixa livre.
3. Verifique o endividamento (Dívida Líquida/EBITDA).

## Conclusão

Use o Radar de Dividendos para acompanhar a consistência dos pagamentos e projetar os próximos meses.`,
  },
  {
    slug: 'fiis-de-logistica-o-que-observar',
    title: 'FIIs de logística: o que observar antes de investir',
    excerpt: 'Vacância, localização dos galpões, prazo dos contratos e P/VP: os principais indicadores para escolher um FII logístico.',
    category: 'Fundos Imobiliários',
    readTime: '5 min',
    featured: false,
    image: null,
    imageAlt: null,
    tags: ['fii', 'logística', 'galpões'],
    content: `## Por que FIIs de logística

O crescimento do comércio eletrônico aumentou a demanda por galpões modernos próximos aos grandes centros consumidores.

## Indicadores importantes

- **Vacância física e financeira**: quanto menor, melhor.
- **Localização**: galpões no raio de 30 km de São Paulo tendem a ter menor vacância.
- **Contratos atípicos**: prazos longos e multas altas trazem previsibilidade.
- **P/VP**: abaixo de 1 pode indicar desconto em relação ao valor patrimonial.

## Conclusão

Compare os fundos pelo score da plataforma e acompanhe a evolução dos rendimentos mensais.`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 8) Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const bcrypt = (await import('bcryptjs')).default
  const prisma: PrismaClientType = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } })

  try {
    // Segunda checagem: o servidor conectado precisa ser o local.
    const who = await prisma.$queryRawUnsafe<Array<{ db: string; addr: string | null; port: number | null }>>(
      'select current_database() as db, inet_server_addr()::text as addr, inet_server_port() as port'
    )
    console.log(`🔒 Conectado a ${who[0]?.db} @ ${who[0]?.addr ?? 'socket'}:${who[0]?.port ?? ''} (local)`)

    console.log('🧹 Limpando tabelas semeadas (TRUNCATE local)...')
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE
      companies, users, blog_posts, offers, pl_bolsa_history, ibov_projections,
      index_definitions, anonymous_feature_usage, "VerificationToken", password_reset_tokens,
      economic_indicator_history, ticker_processing_status
      RESTART IDENTITY CASCADE`)

    const companyIds = new Map<string, number>()
    const barsByTicker = new Map<string, DailyBar[]>()
    const divsByTicker = new Map<string, Div[]>()

    const insertPrices = async (companyId: number, ticker: string, bars: DailyBar[]) => {
      const monthly = toMonthly(bars)
      await prisma.historicalPrice.createMany({
        data: monthly.map((b) => ({
          companyId, date: b.date, interval: '1mo',
          open: r(b.open, 4)!, high: r(b.high, 4)!, low: r(b.low, 4)!, close: r(b.close, 4)!, adjustedClose: r(b.close, 4)!,
          volume: BigInt(Math.round(b.volume)),
        })),
      })
      // Cotações diárias: ~3 anos
      const cut = new Date(TODAY.getTime() - 3 * 366 * DAY_MS)
      const daily = bars.filter((b) => b.date >= cut)
      await prisma.dailyQuote.createMany({ data: daily.map((b) => ({ companyId, date: b.date, price: r(b.close, 4)! })) })
      // Barras diárias de 1 ano (interval 1d) para gráficos que suportam 1d
      const cut1y = new Date(TODAY.getTime() - 366 * DAY_MS)
      await prisma.historicalPrice.createMany({
        data: bars.filter((b) => b.date >= cut1y).map((b) => ({
          companyId, date: b.date, interval: '1d',
          open: r(b.open, 4)!, high: r(b.high, 4)!, low: r(b.low, 4)!, close: r(b.close, 4)!, adjustedClose: r(b.close, 4)!,
          volume: BigInt(Math.round(b.volume)),
        })),
      })
      barsByTicker.set(ticker, bars)
    }

    const insertOscillations = async (companyId: number, bars: DailyBar[]) => {
      const last = bars[bars.length - 1].close
      const at = (days: number) => closeOnOrBefore(bars, new Date(TODAY.getTime() - days * DAY_MS))
      const yr = (y: number) => {
        const a = closeAtYearEnd(bars, y - 1)
        const b = y === CURRENT_YEAR ? last : closeAtYearEnd(bars, y)
        return a && b ? r(b / a - 1) : null
      }
      const last52 = bars.filter((b) => b.date.getTime() >= TODAY.getTime() - 365 * DAY_MS)
      await prisma.priceOscillations.create({
        data: {
          companyId, extractionDate: TODAY,
          variationDay: r(last / bars[bars.length - 2].close - 1),
          variationMonth: r(last / closeOnOrBefore(bars, d(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + 1, 1)) - 1),
          variation30Days: r(last / at(30) - 1),
          variation12Months: r(last / at(365) - 1),
          variation2025: yr(2025), variation2024: yr(2024), variation2023: yr(2023), variation2022: yr(2022), variation2021: yr(2021), variation2020: yr(2020),
          min52Weeks: r(Math.min(...last52.map((b) => b.low)), 4),
          max52Weeks: r(Math.max(...last52.map((b) => b.high)), 4),
          tradedVolumePerDay: r(last52.reduce((a, b) => a + b.volume * b.close, 0) / last52.length, 2),
        },
      })
    }

    const insertTechnical = async (companyId: number, ticker: string, bars: DailyBar[]) => {
      const monthly: PriceData[] = toMonthly(bars).map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }))
      const current = bars[bars.length - 1].close
      const t = TechnicalIndicators.calculateTechnicalAnalysis(monthly, 12)
      const sr = combineLevels(monthly, 20, current)
      const rng = mulberry32(hashStr('ta:' + ticker))
      const fair = current * (0.9 + rng() * 0.12)
      const rsi = t.currentRSI?.rsi ?? null
      const ok = (v: number | undefined | null) => (v && v > 0 && Math.abs(v - current) < current * 2 ? r(v, 4) : null)
      await prisma.assetTechnicalAnalysis.create({
        data: {
          companyId,
          rsi: r(rsi, 2), stochasticK: r(t.currentStochastic?.k, 2), stochasticD: r(t.currentStochastic?.d, 2),
          macd: r(t.currentMACD?.macd, 4), macdSignal: r(t.currentMACD?.signal, 4), macdHistogram: r(t.currentMACD?.histogram, 4),
          sma20: ok(t.currentMovingAverages?.sma20), sma50: ok(t.currentMovingAverages?.sma50), sma200: ok(t.currentMovingAverages?.sma200),
          ema12: ok(t.currentMovingAverages?.ema12), ema26: ok(t.currentMovingAverages?.ema26),
          bbUpper: ok(t.currentBollingerBands?.upper), bbMiddle: ok(t.currentBollingerBands?.middle), bbLower: ok(t.currentBollingerBands?.lower),
          bbWidth: r(t.currentBollingerBands?.width, 4),
          fib236: r(t.fibonacci?.fib236, 4), fib382: r(t.fibonacci?.fib382, 4), fib500: r(t.fibonacci?.fib500, 4), fib618: r(t.fibonacci?.fib618, 4), fib786: r(t.fibonacci?.fib786, 4),
          tenkanSen: r(t.currentIchimoku?.tenkanSen, 4), kijunSen: r(t.currentIchimoku?.kijunSen, 4), senkouSpanA: r(t.currentIchimoku?.senkouSpanA, 4), senkouSpanB: r(t.currentIchimoku?.senkouSpanB, 4), chikouSpan: r(t.currentIchimoku?.chikouSpan, 4),
          supportLevels: JSON.parse(JSON.stringify(sr.supportLevels)),
          resistanceLevels: JSON.parse(JSON.stringify(sr.resistanceLevels)),
          psychologicalLevels: JSON.parse(JSON.stringify(sr.psychologicalLevels)),
          aiMinPrice: r(fair * 0.9, 4), aiMaxPrice: r(fair * 1.15, 4), aiFairEntryPrice: r(fair, 4),
          aiAnalysis: `Análise técnica ilustrativa (seed local). ${ticker} negocia a ${fmtBRL(current)}${rsi !== null ? `, com IFR mensal em ${rsi.toFixed(0)}` : ''}. Região de entrada considerada justa próxima de ${fmtBRL(fair)}, com suporte em ${fmtBRL(fair * 0.9)} e alvo em ${fmtBRL(fair * 1.15)}.`,
          aiConfidence: r(60 + rng() * 25, 2),
          calculatedAt: new Date(), expiresAt: new Date(Date.now() + 30 * DAY_MS), isActive: true,
        },
      })
    }

    const insertDividends = async (companyId: number, ticker: string, divs: Div[]) => {
      if (divs.length) {
        await prisma.dividendHistory.createMany({
          data: divs.map((x) => ({ companyId, exDate: x.exDate, paymentDate: x.paymentDate, amount: x.amount, type: x.type, currency: 'BRL', source: 'local-seed' })),
          skipDuplicates: true,
        })
      }
      divsByTicker.set(ticker, divs)
    }

    /** Projeções do radar pré-calculadas + data-sentinela: impede que o app chame o Gemini ao abrir páginas. */
    const radarFields = (divs: Div[], ticker: string) => {
      const last = divs[divs.length - 1]
      return {
        dividendRadarProjections: genRadarProjections(divs, ticker),
        dividendRadarLastProcessedAt: new Date(),
        // Sentinela no futuro: DividendRadarService.shouldReprocessProjections() compara a data do último
        // dividendo com este campo; mesmo que o app busque dividendos reais no Yahoo, não reprocessa via IA.
        dividendRadarLastDividendDate: d(2099, 12, 31),
        ultimoDividendo: last ? last.amount : null,
        dataUltimoDividendo: last ? last.exDate : null,
      }
    }

    // ── Ações e BDRs ──────────────────────────────────────────────────────────
    console.log(`🏢 Inserindo ${STOCKS.length} ações/BDRs...`)
    for (const s of STOCKS) {
      const bars = genDailySeries(s.ticker, s.price, s.cagr10, s.vol, s.adtv)
      const divs = genDividends(s.ticker, s.divFreq, s.dy, bars, !!s.jcp)
      const company = await prisma.company.create({
        data: {
          ticker: s.ticker, name: s.name, sector: s.sector, industry: s.industry, sectorDisp: s.sector, industryDisp: s.industry,
          description: s.description, descriptionSource: 'local-seed', website: s.website, city: s.city, state: s.state,
          country: s.country ?? 'Brazil', fullTimeEmployees: s.employees, assetType: s.type, isActive: true,
          lastCheckedAt: new Date(), yahooLastUpdatedAt: new Date(), youtubeLastCheckedAt: new Date(),
          ...radarFields(divs, s.ticker),
        },
      })
      companyIds.set(s.ticker, company.id)
      await insertPrices(company.id, s.ticker, bars)
      await insertDividends(company.id, s.ticker, divs)

      const fins = genYearFins(s, bars)
      await prisma.financialData.createMany({ data: fins.map((_, i) => financialDataRow(company.id, s, fins, i, divs, bars)) })

      // Demonstrações anuais (exercícios encerrados)
      const closed = fins.filter((f) => f.year < CURRENT_YEAR)
      for (const f of closed) {
        const endDate = d(f.year, 12, 31)
        const cogs = f.grossProfit !== null ? f.revenue - f.grossProfit : null
        const incomeBeforeTax = f.netIncome / 0.72
        await prisma.incomeStatement.create({
          data: {
            companyId: company.id, period: 'YEARLY', endDate,
            totalRevenue: r(f.revenue, 2), costOfRevenue: cogs !== null ? r(-cogs, 2) : null, grossProfit: r(f.grossProfit, 2),
            sellingGeneralAdministrative: f.grossProfit !== null && f.ebit !== null ? r(-(f.grossProfit - f.ebit) * 0.8, 2) : null,
            operatingIncome: r(f.ebit ?? incomeBeforeTax, 2), ebit: r(f.ebit ?? incomeBeforeTax, 2),
            financialResult: f.ebit !== null ? r(incomeBeforeTax - f.ebit, 2) : null,
            financialIncome: s.financial ? r(f.revenue * 1.6, 2) : r(f.cash * 0.1, 2),
            financialExpenses: s.financial ? r(-f.revenue * 0.9, 2) : r(-f.totalDebt * 0.11, 2),
            incomeBeforeTax: r(incomeBeforeTax, 2), incomeTaxExpense: r(-(incomeBeforeTax - f.netIncome), 2),
            netIncome: r(f.netIncome, 2), netIncomeApplicableToCommonShares: r(f.netIncome, 2), netIncomeFromContinuingOps: r(f.netIncome, 2),
            basicEarningsPerShare: r(f.netIncome / s.shares), dilutedEarningsPerShare: r(f.netIncome / s.shares), earningsPerShare: r(f.netIncome / s.shares),
          },
        })
        await prisma.balanceSheet.create({
          data: {
            companyId: company.id, period: 'YEARLY', endDate,
            cash: r(f.cash, 2), shortTermInvestments: r(f.cash * 0.5, 2), totalCurrentAssets: r(f.currentAssets, 2),
            longTermInvestments: r(f.totalAssets * 0.08, 2), nonCurrentAssets: r(f.totalAssets - f.currentAssets, 2),
            totalAssets: r(f.totalAssets, 2), totalCurrentLiabilities: r(f.currentLiab, 2), currentLiabilities: r(f.currentLiab, 2),
            nonCurrentLiabilities: r(f.totalAssets - f.equity - f.currentLiab, 2), totalLiab: r(f.totalAssets - f.equity, 2),
            totalStockholderEquity: r(f.equity, 2), shareholdersEquity: r(f.equity, 2), realizedShareCapital: r(f.equity * 0.55, 2),
            profitReserves: r(f.equity * 0.4, 2), goodWill: r(f.totalAssets * 0.02, 2), netTangibleAssets: r(f.equity * 0.93, 2),
            thirdPartyDeposits: s.financial ? r(f.totalAssets * 0.45, 2) : null,
          },
        })
        await prisma.cashflowStatement.create({
          data: {
            companyId: company.id, period: 'YEARLY', endDate,
            operatingCashFlow: r(f.ocf, 2), incomeFromOperations: r(f.netIncome, 2), netIncomeBeforeTaxes: r(incomeBeforeTax, 2),
            investmentCashFlow: r(f.capex * 1.1, 2), financingCashFlow: r(f.dividendsPaid - f.ocf * 0.1, 2),
            increaseOrDecreaseInCash: r(f.ocf + f.capex * 1.1 + f.dividendsPaid - f.ocf * 0.1, 2),
            initialCashBalance: r(f.cash * 0.9, 2), finalCashBalance: r(f.cash, 2), cashGeneratedInOperations: r(f.ocf * 1.05, 2),
          },
        })
        await prisma.keyStatistics.create({
          data: {
            companyId: company.id, period: 'YEARLY', endDate,
            enterpriseValue: s.financial ? null : r(f.price * s.shares + f.netDebt, 2), forwardPE: null,
            profitMargins: r(f.netIncome / f.revenue), sharesOutstanding: Math.round(s.shares), bookValue: r(f.equity / s.shares),
            priceToBook: r(f.price / (f.equity / s.shares)), trailingEps: r(f.netIncome / s.shares),
            enterpriseToRevenue: s.financial ? null : r((f.price * s.shares + f.netDebt) / f.revenue),
            enterpriseToEbitda: f.ebitda ? r((f.price * s.shares + f.netDebt) / f.ebitda) : null,
            dividendYield: r(f.dy), totalAssets: r(f.totalAssets, 2),
          },
        })
        await prisma.valueAddedStatement.create({
          data: { companyId: company.id, period: 'YEARLY', endDate, revenue: r(f.revenue * 1.15, 2), financialIntermediationRevenue: s.financial ? r(f.revenue * 1.6, 2) : null },
        })
      }
      // KeyStatistics "atual" (TTM)
      const cur = fins[fins.length - 1]
      const lastDiv = divs[divs.length - 1]
      await prisma.keyStatistics.create({
        data: {
          companyId: company.id, period: 'QUARTERLY', endDate: d(TODAY.getUTCFullYear(), Math.max(1, Math.floor(TODAY.getUTCMonth() / 3) * 3), 28),
          enterpriseValue: s.financial ? null : r(s.price * s.shares + cur.netDebt, 2), forwardPE: r((s.price / (cur.netIncome / s.shares)) * 0.92),
          profitMargins: r(cur.netIncome / cur.revenue), sharesOutstanding: Math.round(s.shares), bookValue: r(cur.equity / s.shares),
          priceToBook: r(s.price / (cur.equity / s.shares)), trailingEps: r(cur.netIncome / s.shares),
          earningsQuarterlyGrowth: r(s.revGrowth * 0.9), earningsAnnualGrowth: r(s.revGrowth),
          fiftyTwoWeekChange: r(s.price / closeOnOrBefore(bars, new Date(TODAY.getTime() - 365 * DAY_MS)) - 1),
          ytdReturn: r(s.price / (closeAtYearEnd(bars, CURRENT_YEAR - 1) ?? s.price) - 1),
          lastDividendValue: lastDiv ? lastDiv.amount : null, lastDividendDate: lastDiv ? lastDiv.exDate : null,
          dividendYield: r(s.dy), totalAssets: r(cur.totalAssets, 2), mostRecentQuarter: d(TODAY.getUTCFullYear(), Math.max(1, Math.floor(TODAY.getUTCMonth() / 3) * 3), 28),
        },
      })
      // Trimestrais resumidos
      await prisma.quarterlyFinancials.create({
        data: {
          companyId: company.id, extractionDate: TODAY,
          quarterlyRevenue: r(cur.revenue / 4, 2), quarterlyEbit: r((cur.ebit ?? cur.netIncome / 0.72) / 4, 2), quarterlyNetIncome: r(cur.netIncome / 4, 2),
          twelveMonthsRevenue: r(cur.revenue, 2), twelveMonthsEbit: r(cur.ebit ?? cur.netIncome / 0.72, 2), twelveMonthsNetIncome: r(cur.netIncome, 2),
        },
      })
      await insertOscillations(company.id, bars)
      await insertTechnical(company.id, s.ticker, bars)

      // Relatório mensal de IA (evita auto-geração via Gemini para usuários Premium)
      const score = Math.round(clamp(45 + s.roe * 60 + (s.dy * 100) - s.vol * 20, 25, 92))
      await prisma.aIReport.create({
        data: {
          companyId: company.id, type: 'MONTHLY_OVERVIEW', status: 'COMPLETED', isActive: true, version: 1,
          content: monthlyReportContent(s, cur, score), currentScore: score, previousScore: score - 2, changeDirection: 'positive',
          createdAt: new Date(Date.now() - 3 * DAY_MS), likeCount: 3, dislikeCount: 0,
        },
      })
    }

    // Um relatório de mudança fundamental + análise do YouTube para enriquecer páginas de exemplo
    for (const t of ['PETR4', 'WEGE3', 'ITUB4']) {
      const id = companyIds.get(t)!
      await prisma.aIReport.create({
        data: {
          companyId: id, type: 'FUNDAMENTAL_CHANGE', status: 'COMPLETED', isActive: true,
          content: `## Mudança fundamental detectada em ${t}\n\nO score geral variou de 68 para 74 após a divulgação do último resultado trimestral, impulsionado por melhora de margens e redução do endividamento.\n\n*Conteúdo ilustrativo gerado pelo seed local.*`,
          previousScore: 68, currentScore: 74, changeDirection: 'positive', createdAt: new Date(Date.now() - 20 * DAY_MS),
        },
      })
      await prisma.youTubeAnalysis.create({
        data: {
          companyId: id, score: 72, isActive: true, videoIds: ['local-seed-1', 'local-seed-2'],
          summary: `Sentimento predominantemente positivo entre analistas do YouTube sobre ${t}, com destaque para a disciplina de capital e a geração de caixa.`,
          positivePoints: ['Geração de caixa consistente', 'Boa governança recente', 'Dividendos acima da média'],
          negativePoints: ['Riscos macroeconômicos', 'Sensibilidade a commodities/juros'],
        },
      })
    }

    // ── FIIs ─────────────────────────────────────────────────────────────────
    console.log(`🏬 Inserindo ${FIIS.length} FIIs...`)
    for (const f of FIIS) {
      const adtv = f.liquidez
      const bars = genDailySeries(f.ticker, f.price, f.cagr10, f.vol, adtv)
      const divs = genDividends(f.ticker, 'monthly', f.dy, bars, false).map((x) => ({ ...x, type: 'RENDIMENTO' }))
      const vp = f.price / f.pvp
      const company = await prisma.company.create({
        data: {
          ticker: f.ticker, name: f.name, sector: 'Fundos Imobiliários', industry: f.segment, description: f.description, descriptionSource: 'local-seed',
          country: 'Brazil', city: 'São Paulo', state: 'SP', assetType: 'FII', isActive: true, lastCheckedAt: new Date(),
          ...radarFields(divs, f.ticker),
        },
      })
      companyIds.set(f.ticker, company.id)
      await insertPrices(company.id, f.ticker, bars)
      await insertDividends(company.id, f.ticker, divs)
      const last = divs[divs.length - 1]
      await prisma.fiiData.create({
        data: {
          companyId: company.id, segment: f.segment, isPapel: f.isPapel, cotacao: f.price, pvp: f.pvp, dividendYield: f.dy,
          ffoYield: r(f.dy * 1.05), valorPatrimonial: r(vp), patrimonioLiquido: r(vp * f.cotas, 2), netAssets: r(vp * f.cotas, 2),
          valorMercado: r(f.price * f.cotas, 2), liquidez: f.liquidez, qtdImoveis: f.qtdImoveis, vacanciaMedia: f.vacancia, capRate: f.capRate,
          precoM2: f.isPapel ? null : 4200 + (hashStr(f.ticker) % 3000), aluguelM2: f.isPapel ? null : 28 + (hashStr(f.ticker) % 40),
          lastDividendValue: last?.amount ?? null, lastDividendDate: last?.exDate ?? null, dataSource: 'local-seed', lastFetchedAt: new Date(),
        },
      })
      for (const y of [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR]) {
        const px = y === CURRENT_YEAR ? f.price : (closeAtYearEnd(bars, y) ?? f.price)
        await prisma.financialData.create({
          data: {
            companyId: company.id, year: y, dy: r(f.dy * (y === CURRENT_YEAR ? 1 : 0.95)), dividendYield12m: r(f.dy), pvp: r(px / vp), vpa: r(vp),
            marketCap: r(px * f.cotas, 2), patrimonioLiquido: r(vp * f.cotas, 2), sharesOutstanding: Math.round(f.cotas),
            ultimoDividendo: last?.amount ?? null, dataUltimoDividendo: last?.exDate ?? null, dataSource: 'local-seed',
          },
        })
      }
      await insertOscillations(company.id, bars)
      await insertTechnical(company.id, f.ticker, bars)
      const score = Math.round(clamp(55 + (1 - f.pvp) * 60 + f.dy * 100 - (f.vacancia ?? 0) * 100, 30, 90))
      await prisma.aIReport.create({
        data: {
          companyId: company.id, type: 'MONTHLY_OVERVIEW', status: 'COMPLETED', isActive: true, currentScore: score,
          content: `# ${f.ticker} — Análise mensal\n\n> Conteúdo ilustrativo do seed local.\n\nO fundo negocia a **${fmtBRL(f.price)}** (P/VP ${f.pvp.toFixed(2).replace('.', ',')}), com dividend yield de **${fmtPct(f.dy)}**.${f.vacancia !== null ? ` Vacância média de ${fmtPct(f.vacancia)}.` : ''}\n\n## Destaques\n- Segmento: ${f.segment}\n- Liquidez diária média: ${fmtBRL(f.liquidez)}\n\n## Conclusão\nRendimentos estáveis nos últimos meses; acompanhe o P/VP e a evolução da vacância.`,
          createdAt: new Date(Date.now() - 3 * DAY_MS),
        },
      })
    }

    // ── ETFs ─────────────────────────────────────────────────────────────────
    console.log(`📦 Inserindo ${ETFS.length} ETFs...`)
    for (const e of ETFS) {
      const bars = genDailySeries(e.ticker, e.price, e.cagr10, e.vol, e.netAssets * 0.02)
      const divs = genDividends(e.ticker, e.divFreq, e.dy, bars, false).map((x) => ({ ...x, type: 'RENDIMENTO' }))
      const company = await prisma.company.create({
        data: {
          ticker: e.ticker, name: e.name, sector: 'ETF', industry: e.etfClass, description: e.description, descriptionSource: 'local-seed',
          country: 'Brazil', assetType: 'ETF', isActive: true, lastCheckedAt: new Date(), ...radarFields(divs, e.ticker),
        },
      })
      companyIds.set(e.ticker, company.id)
      await insertPrices(company.id, e.ticker, bars)
      await insertDividends(company.id, e.ticker, divs)
      const ret = (days: number) => r(e.price / closeOnOrBefore(bars, new Date(TODAY.getTime() - days * DAY_MS)) - 1)
      // drawdown máximo e volatilidade 12m
      let peak = 0
      let mdd = 0
      for (const b of bars) {
        peak = Math.max(peak, b.close)
        mdd = Math.min(mdd, b.close / peak - 1)
      }
      const last252 = bars.slice(-252)
      const lr = last252.slice(1).map((b, i) => Math.log(b.close / last252[i].close))
      const mean = lr.reduce((a, b) => a + b, 0) / lr.length
      const vol12 = Math.sqrt(lr.reduce((a, b) => a + (b - mean) ** 2, 0) / lr.length) * Math.sqrt(252)
      const top5 = [...e.holdings].sort((a, b) => b.weight - a.weight).slice(0, 5).reduce((a, h) => a + h.weight, 0)
      const etfScore = Math.round(clamp(80 - e.expense * 4000 + (ret(365) ?? 0) * 40, 35, 92))
      const etfData = await prisma.etfData.create({
        data: {
          companyId: company.id, netAssets: e.netAssets, totalAssets: e.netAssets, netExpenseRatio: e.expense, dividendYield: e.dy,
          ytdReturn: r(e.price / (closeAtYearEnd(bars, CURRENT_YEAR - 1) ?? e.price) - 1), category: e.etfClass, etfClass: e.etfClass,
          benchmarkIndex: e.benchmark, return1m: ret(30), return3m: ret(91), return6m: ret(182), return1y: ret(365), return2y: ret(730),
          return3y: ret(1095), return5y: ret(1826), returnSinceInception: r(e.price / bars[0].close - 1),
          maxDrawdown: r(mdd), volatility12m: r(vol12), holdingsConcentrationTop5: r(top5, 4), holdingsUpdatedAt: new Date(),
          etfScore, scoreUpdatedAt: new Date(), aiAnalysisScore: etfScore - 3, aiAnalysisUpdatedAt: new Date(),
          aiAnalysisSummary: `ETF ${e.etfClass.toLowerCase()} com taxa de ${(e.expense * 100).toFixed(2).replace('.', ',')}% a.a. e boa aderência ao ${e.benchmark}. (Resumo ilustrativo do seed local.)`,
          lastScrapedAt: new Date(), dataSource: 'local-seed',
        },
      })
      await prisma.etfHolding.createMany({
        data: e.holdings.map((h) => ({ etfDataId: etfData.id, ticker: h.ticker, name: h.name, weight: h.weight, companyId: h.ticker ? companyIds.get(h.ticker) ?? null : null })),
      })
      await insertOscillations(company.id, bars)
      await insertTechnical(company.id, e.ticker, bars)
    }

    // ── Plano/ofertas ────────────────────────────────────────────────────────
    console.log('💳 Ofertas (preços de fallback do app)...')
    await prisma.offer.createMany({
      data: [
        { id: 'local-monthly', type: 'MONTHLY', price_in_cents: 1990, is_active: true, premium_duration_days: 30, checkout_url: null },
        { id: 'local-annual', type: 'ANNUAL', price_in_cents: 18990, is_active: true, premium_duration_days: 365, checkout_url: null },
      ],
    })

    // ── Usuários ─────────────────────────────────────────────────────────────
    console.log('👤 Usuários de teste...')
    const pwd = await bcrypt.hash('Local123!', 12)
    const longAgo = new Date(Date.now() - 400 * DAY_MS)
    const premium = await prisma.user.create({
      data: {
        email: 'premium@local.test', name: 'Paula Premium (local)', password: pwd, emailVerified: longAgo,
        subscriptionTier: 'PREMIUM', premiumExpiresAt: new Date(Date.now() + 365 * DAY_MS), firstPremiumAt: longAgo,
        lastPremiumAt: new Date(Date.now() - 30 * DAY_MS), premiumCount: 2, wasPremiumBefore: true,
        createdAt: longAgo, lastLoginAt: new Date(Date.now() - DAY_MS), lastOnboardingSeenAt: longAgo,
        onboardingAcquisitionSource: 'google', onboardingExperienceLevel: 'intermediario', onboardingInvestmentFocus: 'dividendos',
        acquisition: 'local-seed',
        notificationPreferences: { create: { emailNotificationsEnabled: false } },
        userSecurity: { create: { registrationIp: '127.0.0.1', lastLoginIp: '127.0.0.1' } },
      },
    })
    await prisma.user.create({
      data: {
        email: 'free@local.test', name: 'Fábio Free (local)', password: pwd, emailVerified: longAgo, subscriptionTier: 'FREE',
        // trial já utilizado e expirado (evita que o login inicie um trial automaticamente)
        trialStartedAt: new Date(Date.now() - 200 * DAY_MS), trialEndsAt: new Date(Date.now() - 193 * DAY_MS),
        createdAt: new Date(Date.now() - 210 * DAY_MS), lastLoginAt: new Date(Date.now() - 3 * DAY_MS), lastOnboardingSeenAt: new Date(Date.now() - 200 * DAY_MS),
        onboardingAcquisitionSource: 'instagram', onboardingExperienceLevel: 'iniciante', onboardingInvestmentFocus: 'crescimento',
        acquisition: 'local-seed',
        notificationPreferences: { create: { emailNotificationsEnabled: false } },
        userSecurity: { create: { registrationIp: '127.0.0.1', lastLoginIp: '127.0.0.1' } },
      },
    })

    // Radar do usuário premium (análises técnicas do dia já estão semeadas)
    await prisma.radarConfig.create({ data: { userId: premium.id, tickers: ['PETR4', 'WEGE3', 'TAEE11', 'ITUB4', 'HGLG11'] } })

    // Histórico de ranking
    await prisma.rankingHistory.create({
      data: { userId: premium.id, model: 'graham', params: { marginOfSafety: 0.3, limit: 10 }, resultCount: 6, createdAt: new Date(Date.now() - 5 * DAY_MS) },
    })

    // Carteira do usuário premium com transações confirmadas
    console.log('💼 Carteira de exemplo...')
    const alloc: Array<[string, number]> = [['TAEE11', 0.25], ['ITUB4', 0.25], ['BBSE3', 0.2], ['EGIE3', 0.15], ['HGLG11', 0.15]]
    const start = d(TODAY.getUTCFullYear() - 1, TODAY.getUTCMonth() + 1, 1)
    const portfolio = await prisma.portfolioConfig.create({
      data: {
        userId: premium.id, name: 'Carteira Dividendos', description: 'Carteira focada em renda passiva (seed local)',
        startDate: start, monthlyContribution: 1000, rebalanceFrequency: 'monthly', trackingStarted: true, isActive: true,
        assets: { create: alloc.map(([ticker, w]) => ({ ticker, targetAllocation: w })) },
      },
    })
    const txs: Array<Record<string, unknown>> = []
    let cash = 0
    const holdings = new Map<string, number>()
    const monthsCount = 12
    for (let m = 0; m < monthsCount; m++) {
      const date = d(start.getUTCFullYear(), start.getUTCMonth() + 1 + m, 5)
      if (date >= TODAY) break
      const amount = m === 0 ? 10000 : 1000
      txs.push({ portfolioId: portfolio.id, date, type: m === 0 ? 'CASH_CREDIT' : 'MONTHLY_CONTRIBUTION', status: 'CONFIRMED', amount, cashBalanceBefore: cash, cashBalanceAfter: cash + amount, confirmedAt: date })
      cash += amount
      const budget = cash
      for (const [ticker, w] of alloc) {
        const px = closeOnOrBefore(barsByTicker.get(ticker)!, date)
        const qty = Math.floor((budget * w) / px)
        if (qty <= 0) continue
        const cost = r(qty * px, 2)!
        txs.push({ portfolioId: portfolio.id, date, type: 'BUY', status: 'CONFIRMED', ticker, amount: cost, price: r(px, 4), quantity: qty, cashBalanceBefore: r(cash, 2), cashBalanceAfter: r(cash - cost, 2), confirmedAt: date })
        cash -= cost
        holdings.set(ticker, (holdings.get(ticker) ?? 0) + qty)
      }
      // dividendos do mês para as posições atuais
      for (const [ticker, qty] of holdings) {
        const dv = (divsByTicker.get(ticker) ?? []).filter((x) => x.paymentDate.getUTCFullYear() === date.getUTCFullYear() && x.paymentDate.getUTCMonth() === date.getUTCMonth() && x.paymentDate < TODAY)
        for (const x of dv) {
          const amt = r(x.amount * qty, 2)!
          if (amt <= 0) continue
          txs.push({ portfolioId: portfolio.id, date: x.paymentDate, type: 'DIVIDEND', status: 'CONFIRMED', ticker, amount: amt, cashBalanceBefore: r(cash, 2), cashBalanceAfter: r(cash + amt, 2), confirmedAt: x.paymentDate, dividendPaymentDate: x.paymentDate, notes: `${x.type} ${ticker}` })
          cash += amt
        }
      }
    }
    await prisma.portfolioTransaction.createMany({ data: txs as never })
    await prisma.portfolioConfig.update({ where: { id: portfolio.id }, data: { lastTransactionDate: (txs[txs.length - 1]?.date as Date) ?? start } })

    // ── Blog ─────────────────────────────────────────────────────────────────
    console.log('📝 Blog posts...')
    for (const [i, p] of BLOG_POSTS.entries()) {
      const pub = new Date(TODAY.getTime() - (i * 9 + 2) * DAY_MS)
      await prisma.blogPost.create({
        data: {
          slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category, readTime: p.readTime, featured: p.featured,
          image: p.image, imageAlt: p.imageAlt, content: p.content, tags: p.tags, status: 'PUBLISHED', publishDate: pub, lastModified: pub,
          seoTitle: p.title, seoDescription: p.excerpt, generatedBy: 'local-seed',
        },
      })
    }

    // ── P/L da Bolsa (histórico mensal, visão geral) ─────────────────────────
    console.log('📈 Histórico P/L da bolsa...')
    const plRng = mulberry32(hashStr('pl-bolsa'))
    const plRows: Array<{ date: Date; pl: number; averagePl: number; companyCount: number }> = []
    let pl = 11
    const plStart = 2010
    for (let y = plStart; y <= TODAY.getUTCFullYear(); y++) {
      for (let m = 1; m <= 12; m++) {
        const dt = d(y, m, 1)
        if (dt >= d(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + 1, 1)) break
        pl = clamp(pl + gauss(plRng) * 0.45 + (10.5 - pl) * 0.05, 5.5, 18)
        plRows.push({ date: dt, pl: r(pl, 4)!, averagePl: 0, companyCount: 280 + Math.round(plRng() * 60) })
      }
    }
    let acc = 0
    plRows.forEach((row, i) => {
      acc += row.pl
      row.averagePl = r(acc / (i + 1), 4)!
    })
    await prisma.plBolsaHistory.createMany({ data: plRows.map((x) => ({ ...x, sector: null, minScore: null, excludeUnprofitable: false })) })

    // ── Projeções IBOV (pré-calculadas: evita chamada on-demand ao Ben/Gemini) ─
    console.log('🔮 Projeções IBOV...')
    const ibovBase = 146000
    await prisma.ibovProjection.createMany({
      data: [
        { period: 'WEEKLY', projectedValue: ibovBase * 1.008, confidence: 62, validUntil: new Date(Date.now() + 30 * DAY_MS), reasoning: 'Projeção semanal ilustrativa (seed local): fluxo estrangeiro positivo e expectativa de estabilidade da Selic sustentam leve alta.', keyIndicators: { selic: 15, dolar: 5.35, weights: { fluxo: 0.4, juros: 0.35, commodities: 0.25 } } },
        { period: 'MONTHLY', projectedValue: ibovBase * 1.025, confidence: 55, validUntil: new Date(Date.now() + 30 * DAY_MS), reasoning: 'Projeção mensal ilustrativa (seed local): temporada de resultados e início do ciclo de cortes de juros podem favorecer o índice.', keyIndicators: { selic: 15, dolar: 5.35, weights: { resultados: 0.4, juros: 0.4, commodities: 0.2 } } },
        { period: 'ANNUAL', projectedValue: ibovBase * 1.12, confidence: 45, validUntil: new Date(Date.now() + 365 * DAY_MS), reasoning: 'Projeção anual ilustrativa (seed local): cenário-base com queda gradual da Selic e múltiplos abaixo da média histórica.', keyIndicators: { selic: 15, dolar: 5.35, weights: { juros: 0.5, lucros: 0.3, fluxo: 0.2 } } },
      ],
    })

    // ── Índices próprios (IPJ) ───────────────────────────────────────────────
    console.log('📊 Índices IPJ...')
    const indices = [
      { ticker: 'IPJ-VALUE', name: 'Índice Preço Justo Valor', color: '#2563eb', tickers: ['PETR4', 'VALE3', 'BBAS3', 'CMIG4', 'TAEE11', 'BBSE3', 'ITUB4', 'KLBN11'], description: 'Carteira teórica de ações descontadas com qualidade mínima (ROE, margem e endividamento).', methodology: 'Seleciona as ações com maior upside pelo preço justo, respeitando filtros de qualidade e liquidez. Rebalanceamento mensal.', config: { type: 'VALUE', universe: 'B3', assetTypes: ['STOCK'], quality: { roe: { gte: 0.1 }, margemLiquida: { gte: 0.05 }, dividaLiquidaEbitda: { lte: 3 } }, selection: { topN: 15, orderBy: 'upside', orderDirection: 'desc' }, weights: { type: 'overallScore', minWeight: 0.03, maxWeight: 0.12 }, rebalance: { threshold: 0.05, checkQuality: true } } },
      { ticker: 'IPJ-DIV', name: 'Índice Preço Justo Dividendos', color: '#16a34a', tickers: ['TAEE11', 'BBSE3', 'CMIG4', 'ITUB4', 'EGIE3', 'VIVT3', 'BBAS3'], description: 'Carteira teórica de pagadoras consistentes de dividendos.', methodology: 'Seleciona ações com dividend yield elevado e consistência de pagamentos nos últimos 5 anos.', config: { type: 'DIVIDEND', universe: 'B3', assetTypes: ['STOCK'], quality: { dy: { gte: 0.06 } }, selection: { topN: 10, orderBy: 'dy', orderDirection: 'desc' }, weights: { type: 'equal' }, rebalance: { threshold: 0.05, checkQuality: true } } },
    ]
    for (const idx of indices) {
      const w = 1 / idx.tickers.length
      const def = await prisma.indexDefinition.create({
        data: {
          ticker: idx.ticker, name: idx.name, description: idx.description, color: idx.color, methodology: idx.methodology, config: idx.config,
          createdAt: new Date(Date.now() - 400 * DAY_MS),
          composition: {
            create: idx.tickers.map((t) => ({ assetTicker: t, targetWeight: w, entryPrice: r(closeOnOrBefore(barsByTicker.get(t)!, new Date(TODAY.getTime() - 365 * DAY_MS)), 4)!, entryDate: new Date(TODAY.getTime() - 365 * DAY_MS) })),
          },
        },
      })
      // Série de pontos: média ponderada dos retornos diários dos componentes, base 100
      const startIdx = new Date(TODAY.getTime() - 365 * DAY_MS)
      const series = barsByTicker.get(idx.tickers[0])!.filter((b) => b.date >= startIdx).map((b) => b.date)
      let points = 100
      const hist: Array<{ indexId: string; date: Date; points: number; dailyChange: number; currentYield: number }> = []
      for (let i = 0; i < series.length; i++) {
        let ch = 0
        if (i > 0) {
          for (const t of idx.tickers) {
            const bars = barsByTicker.get(t)!
            const a = closeOnOrBefore(bars, series[i - 1])
            const b = closeOnOrBefore(bars, series[i])
            ch += w * (b / a - 1)
          }
        }
        points *= 1 + ch
        hist.push({ indexId: def.id, date: series[i], points: r(points, 4)!, dailyChange: r(ch * 100, 4)!, currentYield: idx.ticker === 'IPJ-DIV' ? 8.4 : 6.1 })
      }
      await prisma.indexHistoryPoints.createMany({ data: hist })
      await prisma.indexRebalanceLog.createMany({
        data: [
          { indexId: def.id, date: new Date(TODAY.getTime() - 60 * DAY_MS), action: 'ENTRY', ticker: idx.tickers[0], reason: 'Upside elevado e qualidade dentro dos critérios' },
          { indexId: def.id, date: new Date(TODAY.getTime() - 60 * DAY_MS), action: 'EXIT', ticker: 'ABEV3', reason: 'Upside abaixo do limite mínimo' },
        ],
      })
    }

    // Marcador de frescor do seed (lido por screenshots.ts para avisar quando os caches de IA vencerem)
    const stampPath = path.join(__dirname, '.last-seed.json')
    fs.writeFileSync(stampPath, JSON.stringify({ seededAt: new Date().toISOString(), localDate: ymd(TODAY) }, null, 2))

    const counts = {
      companies: await prisma.company.count(),
      financialData: await prisma.financialData.count(),
      dailyQuotes: await prisma.dailyQuote.count(),
      historicalPrices: await prisma.historicalPrice.count(),
      dividends: await prisma.dividendHistory.count(),
      aiReports: await prisma.aIReport.count(),
      technical: await prisma.assetTechnicalAnalysis.count(),
      users: await prisma.user.count(),
      portfolioTransactions: await prisma.portfolioTransaction.count(),
      blogPosts: await prisma.blogPost.count(),
      plBolsa: await prisma.plBolsaHistory.count(),
      indexPoints: await prisma.indexHistoryPoints.count(),
    }
    console.log('\n✅ Seed local concluído:', counts)
    console.log('   Logins: premium@local.test / Local123!  |  free@local.test / Local123!')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('❌ Falha no seed:', err)
  process.exit(1)
})
