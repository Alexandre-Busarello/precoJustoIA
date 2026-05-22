/**
 * Script de DESCOBERTA (dev-time apenas, não roda na Vercel).
 * Usa Playwright para navegar etf1.com.br e interceptar todas as chamadas XHR/fetch,
 * revelando os endpoints da API interna com URLs, headers e estrutura de response.
 *
 * Resultado: copie os endpoints descobertos para src/lib/etf-scrapers/etf1-endpoints.ts
 *
 * Uso: npx ts-node scripts/discover-etf1-api.ts
 * Pré-requisito: npx playwright install chromium
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

const ETF_SAMPLES = ['BOVA11', 'NSDV11', 'IVVB11'];
const BASE_URL = 'https://etf1.com.br';
const OUTPUT_FILE = 'scripts/etf1-api-discovery.json';

interface CapturedRequest {
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  status: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
}

async function discoverForTicker(
  ticker: string,
  browser: Awaited<ReturnType<typeof chromium.launch>>
): Promise<CapturedRequest[]> {
  const page = await browser.newPage();
  const captured: CapturedRequest[] = [];

  page.on('response', async (response) => {
    const url = response.url();
    // Filtra apenas chamadas de API (XHR/fetch que retornam JSON)
    const ct = response.headers()['content-type'] ?? '';
    if (!ct.includes('json') && !url.includes('/api/')) return;
    if (url.includes('_next/static') || url.includes('analytics') || url.includes('gtag')) return;

    try {
      const body = await response.json().catch(() => null);
      if (!body) return;

      captured.push({
        url,
        method: response.request().method(),
        requestHeaders: response.request().headers(),
        status: response.status(),
        responseHeaders: response.headers(),
        responseBody: body,
      });

      console.log(`  📡 [${ticker}] ${response.status()} ${response.request().method()} ${url}`);
    } catch {
      // ignora responses que não parsam
    }
  });

  try {
    console.log(`\n🌐 Navegando: ${BASE_URL}/etf/${ticker}`);
    await page.goto(`${BASE_URL}/etf/${ticker}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // aguarda chamadas lazy
  } catch (err) {
    console.error(`  ⚠️  Timeout ou erro para ${ticker}:`, err instanceof Error ? err.message : err);
  } finally {
    await page.close();
  }

  return captured;
}

async function main() {
  console.log('🔍 Iniciando descoberta da API interna do etf1.com.br...\n');

  const browser = await chromium.launch({ headless: true });
  const allResults: Record<string, CapturedRequest[]> = {};

  try {
    for (const ticker of ETF_SAMPLES) {
      allResults[ticker] = await discoverForTicker(ticker, browser);
    }
  } finally {
    await browser.close();
  }

  // Agrupa endpoints únicos por URL pattern
  const uniqueEndpoints = new Map<string, CapturedRequest>();
  for (const [ticker, requests] of Object.entries(allResults)) {
    for (const req of requests) {
      // Normaliza URL substituindo o ticker pelo placeholder
      const normalizedUrl = req.url.replace(new RegExp(ticker, 'gi'), '{ticker}');
      if (!uniqueEndpoints.has(normalizedUrl)) {
        uniqueEndpoints.set(normalizedUrl, { ...req, url: normalizedUrl });
      }
    }
  }

  const output = {
    discoveredAt: new Date().toISOString(),
    sampledTickers: ETF_SAMPLES,
    totalRequestsCaptured: Object.values(allResults).flat().length,
    uniqueEndpoints: Array.from(uniqueEndpoints.values()).map((r) => ({
      url: r.url,
      method: r.method,
      status: r.status,
      responseStructure: summarizeStructure(r.responseBody),
      sampleResponse: r.responseBody,
    })),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Descoberta concluída!`);
  console.log(`   ${output.uniqueEndpoints.length} endpoints únicos encontrados`);
  console.log(`   Resultado salvo em: ${OUTPUT_FILE}`);
  console.log(`\n📋 Endpoints descobertos:`);

  for (const ep of output.uniqueEndpoints) {
    console.log(`   ${ep.method} ${ep.url} → ${ep.status}`);
  }

  console.log(`\n➡️  Próximo passo: copie os endpoints para src/lib/etf-scrapers/etf1-endpoints.ts`);
}

function summarizeStructure(obj: unknown, depth = 0): unknown {
  if (depth > 2) return '...';
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.length > 0 ? [summarizeStructure(obj[0], depth + 1), `...+${obj.length - 1}`] : [];
  }
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).slice(0, 10).map(([k, v]) => [k, summarizeStructure(v, depth + 1)])
    );
  }
  return typeof obj;
}

main().catch(console.error);
