/**
 * Busca FIIs em https://www.fundamentus.com.br/fii_resultado.php,
 * normaliza dados e faz upsert em companies + fii_data (assetType=FII).
 */
import * as dotenv from 'dotenv';
import { load } from 'cheerio';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

const FUNDAMENTUS_FII_URL = 'https://www.fundamentus.com.br/fii_resultado.php';

const MIN_LIQUIDITY_TIJOLO = 1_000_000;
const MIN_LIQUIDITY_PAPEL = 100_000;
const MIN_IMOVEIS_TIJOLO = 5;
const BLOCKLIST = new Set(['MALL11']);

/** Segmentos típicos de papel / renda fixa */
const PAPEL_SEGMENT_PATTERNS =
  /t[ií]tulos|val\.?\s*mob|cri|h[ií]brido|securitiz|receb[ií]veis|deb[eê]nt/i;

export function parseBrDecimal(raw: string): number | null {
  const s = raw.replace(/\s/g, '').replace('%', '').trim();
  if (!s || s === '-' || s === '—' || s === 'N/A') return null;
  if (s.includes(',')) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(s.replace(/\./g, ''));
  return Number.isFinite(n) ? n : null;
}

function parsePercent(raw: string): number | null {
  const n = parseBrDecimal(raw);
  return n === null ? null : n / 100;
}

function detectIsPapel(segment: string): boolean {
  return PAPEL_SEGMENT_PATTERNS.test(segment);
}

export interface ParsedFiiRow {
  ticker: string;
  segment: string;
  cotacao: number;
  ffoYield: number | null;
  dividendYield: number | null;
  pvp: number | null;
  valorMercado: number | null;
  liquidez: number | null;
  qtdImoveis: number | null;
  precoM2: number | null;
  aluguelM2: number | null;
  capRate: number | null;
  vacanciaMedia: number | null;
  isPapel: boolean;
}

function passesQuality(row: ParsedFiiRow): boolean {
  if (BLOCKLIST.has(row.ticker)) return false;
  if (!(row.cotacao > 0)) return false;
  const liq = row.liquidez ?? 0;
  if (row.isPapel) {
    if (liq < MIN_LIQUIDITY_PAPEL) return false;
  } else {
    if (liq < MIN_LIQUIDITY_TIJOLO) return false;
    const q = row.qtdImoveis ?? 0;
    if (q < MIN_IMOVEIS_TIJOLO) return false;
  }
  return true;
}

export async function fetchFundamentusFiiHtml(): Promise<string> {
  const res = await fetch(FUNDAMENTUS_FII_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar Fundamentus FIIs`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return new TextDecoder('iso-8859-1').decode(buf);
}

export function parseFundamentusFiiTable(html: string): ParsedFiiRow[] {
  const $ = load(html);
  const rows: ParsedFiiRow[] = [];
  $('table tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 13) return;

    const first = $(tds[0]);
    const link = first.find('a[href*="papel="]').attr('href') || '';
    const m = link.match(/papel=([A-Z0-9]+)/i) || first.text().match(/([A-Z]{4}11)/);
    const ticker = (m ? m[1] : first.text()).trim().toUpperCase();
    if (!/^[A-Z]{4}11$/.test(ticker)) return;

    const segment = $(tds[1]).text().trim();
    const cotacao = parseBrDecimal($(tds[2]).text());
    const ffoYield = parsePercent($(tds[3]).text());
    const dividendYield = parsePercent($(tds[4]).text());
    const pvp = parseBrDecimal($(tds[5]).text());
    const valorMercado = parseBrDecimal($(tds[6]).text());
    const liquidez = parseBrDecimal($(tds[7]).text());
    const qtdImoveis = parseBrDecimal($(tds[8]).text());
    const precoM2 = parseBrDecimal($(tds[9]).text());
    const aluguelM2 = parseBrDecimal($(tds[10]).text());
    const capRate = parsePercent($(tds[11]).text());
    const vacanciaMedia = parsePercent($(tds[12]).text());

    if (cotacao === null || cotacao <= 0) return;

    const isPapel = detectIsPapel(segment);

    rows.push({
      ticker,
      segment,
      cotacao,
      ffoYield,
      dividendYield,
      pvp,
      valorMercado,
      liquidez,
      qtdImoveis: qtdImoveis !== null ? Math.round(qtdImoveis) : null,
      precoM2,
      aluguelM2,
      capRate,
      vacanciaMedia,
      isPapel,
    });
  });
  return rows;
}

export async function upsertFiiFromRow(row: ParsedFiiRow): Promise<void> {
  if (!passesQuality(row)) return;

  const company = await prisma.company.upsert({
    where: { ticker: row.ticker },
    create: {
      ticker: row.ticker,
      name: row.ticker,
      assetType: 'FII',
      sector: 'Fundos Imobiliários',
      industry: row.segment || null,
    },
    update: {
      assetType: 'FII',
      sector: 'Fundos Imobiliários',
      industry: row.segment || undefined,
    },
  });

  const now = new Date();
  await prisma.fiiData.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      dividendYield: row.dividendYield,
      pvp: row.pvp,
      cotacao: row.cotacao,
      ffoYield: row.ffoYield,
      valorMercado: row.valorMercado,
      liquidez: row.liquidez,
      qtdImoveis: row.qtdImoveis,
      precoM2: row.precoM2,
      aluguelM2: row.aluguelM2,
      capRate: row.capRate,
      vacanciaMedia: row.vacanciaMedia,
      segment: row.segment,
      isPapel: row.isPapel,
      dataSource: 'fundamentus',
      lastFetchedAt: now,
    },
    update: {
      dividendYield: row.dividendYield,
      pvp: row.pvp,
      cotacao: row.cotacao,
      ffoYield: row.ffoYield,
      valorMercado: row.valorMercado,
      liquidez: row.liquidez,
      qtdImoveis: row.qtdImoveis,
      precoM2: row.precoM2,
      aluguelM2: row.aluguelM2,
      capRate: row.capRate,
      vacanciaMedia: row.vacanciaMedia,
      segment: row.segment,
      isPapel: row.isPapel,
      dataSource: 'fundamentus',
      lastFetchedAt: now,
    },
  });
}

export async function main(): Promise<void> {
  console.log('📥 Baixando tabela de FIIs do Fundamentus...');
  const html = await fetchFundamentusFiiHtml();
  const parsed = parseFundamentusFiiTable(html);
  console.log(`📊 Linhas parseadas: ${parsed.length}`);

  let ok = 0;
  for (const row of parsed) {
    try {
      await upsertFiiFromRow(row);
      ok++;
    } catch (e) {
      console.error(`❌ ${row.ticker}:`, e);
    }
  }
  console.log(`✅ Upserts concluídos (linhas processadas pós-filtro): ${ok}`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
