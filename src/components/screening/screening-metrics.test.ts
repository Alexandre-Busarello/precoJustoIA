import { test } from "node:test"
import assert from "node:assert/strict"
import {
  countActiveFiiFilters,
  countActiveStockFilters,
  formatDecimalInput,
  formatMetricValue,
  metricTone,
  parseDecimal,
  resultUpside,
  sortResults,
  STOCK_METRIC_ORDER,
  translateMetricName,
  visibleMetricKeys,
  type ScreeningResult,
} from "./screening-metrics"

function result(ticker: string, overrides: Partial<ScreeningResult> = {}): ScreeningResult {
  return {
    ticker,
    name: ticker,
    sector: null,
    currentPrice: 10,
    fairValue: null,
    upside: null,
    marginOfSafety: null,
    rational: "",
    ...overrides,
  }
}

test("translateMetricName cobre as chaves camelCase que a API envia", () => {
  assert.equal(translateMetricName("marketCap"), "Valor de mercado")
  assert.equal(translateMetricName("grahamUpside"), "Upside Graham")
  assert.equal(translateMetricName("fcdUpside"), "Upside FCD")
  assert.equal(translateMetricName("gordonUpside"), "Upside Gordon")
  assert.equal(translateMetricName("cagrReceitas"), "CAGR receitas 5a")
  assert.equal(translateMetricName("pjFiiScore"), "Score PJ-FII")
  // Fallback nunca devolve camelCase cru.
  assert.equal(translateMetricName("novaMetricaXpto"), "Nova metrica xpto")
})

/** Intl usa espaço não separável depois de "R$"; normaliza para comparar com texto simples. */
const plain = (text: string) => text.replace(/\u00a0/g, " ")

test("formatMetricValue respeita a unidade de cada campo", () => {
  assert.equal(plain(formatMetricValue("marketCap", 29_338_560_000_000)), "R$ 29,3 tri")
  assert.equal(plain(formatMetricValue("marketCap", 297_277_400_000)), "R$ 297,3 bi")
  assert.equal(formatMetricValue("pl", 9.046088), "9,0x")
  assert.equal(formatMetricValue("roe", 0.177049), "17,7%")
  assert.equal(formatMetricValue("dy", 0.086), "8,6%")
  assert.equal(formatMetricValue("grahamUpside", 24.63659), "+24,6%")
  assert.equal(formatMetricValue("fcdUpside", -12.5), "−12,5%")
  assert.equal(formatMetricValue("liquidezCorrente", 1.167326), "1,17")
  assert.equal(plain(formatMetricValue("liquidez", 9_500_000)), "R$ 9,5 mi")
  assert.equal(formatMetricValue("pjFiiScore", 92.6), "93")
  assert.equal(formatMetricValue("roic", null), "—")
})

test("metricTone só colore upside", () => {
  assert.equal(metricTone("grahamUpside", 10), "positive")
  assert.equal(metricTone("gordonUpside", -3), "negative")
  assert.equal(metricTone("roe", 0.3), "neutral")
  assert.equal(metricTone("grahamUpside", null), "neutral")
})

test("visibleMetricKeys segue a ordem e descarta chaves internas", () => {
  const rows = [result("A", { key_metrics: { marketCap: 1, pl: 2, fiiListingRef: 1, chaveDesconhecida: 3 } })]
  assert.deepEqual(visibleMetricKeys(rows, STOCK_METRIC_ORDER), ["pl", "marketCap"])
})

test("resultUpside usa fração a partir do preço justo", () => {
  assert.equal(resultUpside({ currentPrice: 75, fairValue: 100 })?.toFixed(4), "0.3333")
  assert.equal(resultUpside({ currentPrice: 10, fairValue: null }), null)
})

test("sortResults ordena sem mutar e manda ausentes para o fim", () => {
  const rows = [
    result("A", { key_metrics: { pl: 12 } }),
    result("B", { key_metrics: { pl: null } }),
    result("C", { key_metrics: { pl: 5 } }),
  ]
  assert.deepEqual(sortResults(rows, "pl").map((r) => r.ticker), ["C", "A", "B"])
  assert.deepEqual(rows.map((r) => r.ticker), ["A", "B", "C"])
  const byUpside = [result("X", { fairValue: 11 }), result("Y", { fairValue: 20 }), result("Z")]
  assert.deepEqual(sortResults(byUpside, "upside").map((r) => r.ticker), ["Y", "X", "Z"])
  assert.equal(sortResults(rows, "relevance"), rows)
})

test("countActiveStockFilters ignora filtros ligados sem valor", () => {
  assert.equal(countActiveStockFilters({ companySize: "all" }), 0)
  assert.equal(
    countActiveStockFilters({
      plFilter: { enabled: true, max: 10 },
      roeFilter: { enabled: true },
      companySize: "blue_chips",
      selectedSectors: ["Financeiro"],
    }),
    3
  )
})

test("countActiveFiiFilters", () => {
  assert.equal(countActiveFiiFilters({ tipoFii: "both" }), 0)
  assert.equal(countActiveFiiFilters({ tipoFii: "papel", minDY: 0.08, segmento: "Logística" }), 3)
})

test("parseDecimal e formatDecimalInput aceitam vírgula", () => {
  assert.equal(parseDecimal("8,5"), 8.5)
  assert.equal(parseDecimal("1.000,5"), 1000.5)
  assert.equal(parseDecimal("10"), 10)
  assert.equal(parseDecimal(""), undefined)
  assert.equal(parseDecimal("abc"), undefined)
  assert.equal(parseDecimal("8,"), 8)
  assert.equal(parseDecimal("1.5"), 1.5)
  assert.equal(parseDecimal("-5,5"), -5.5)
  assert.equal(parseDecimal("1,2,3"), undefined)
  assert.equal(formatDecimalInput(0.15 * 100), "15")
  assert.equal(formatDecimalInput(1.5), "1,5")
  assert.equal(formatDecimalInput(undefined), "")
})

test("parseDecimal trata pontos agrupados de três em três como milhar (placeholder 'Ex.: 1.000.000')", () => {
  assert.equal(parseDecimal("1.000.000"), 1000000)
  assert.equal(parseDecimal("1.000"), 1000)
  assert.equal(parseDecimal("500.000"), 500000)
  assert.equal(parseDecimal("1.000."), 1000)
  assert.equal(parseDecimal("1.000.000,50"), 1000000.5)
  assert.equal(parseDecimal("1000000"), 1000000)
  // Estados intermediários da digitação que não formam número não emitem valor.
  assert.equal(parseDecimal("1.000.0"), undefined)
  assert.equal(parseDecimal("1.00.000"), undefined)
  // Ponto único fora do padrão de milhar continua decimal.
  assert.equal(parseDecimal("1.00"), 1)
  assert.equal(parseDecimal("2.25"), 2.25)
})
