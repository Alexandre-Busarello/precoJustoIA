/**
 * Textos institucionais compartilhados. Use estas constantes em vez de repetir números na UI,
 * para que home, planos, rodapé e metadados digam a mesma coisa.
 *
 * Cobertura confirmada pelo dono (out/2026): bem mais de 350 empresas e, com BDRs e FIIs, mais de 600 ativos da B3.
 */
export const COVERED_ASSETS_LABEL = 'mais de 600 ativos'
/** Fundamentos e cotações via BRAPI (scripts/fetch-data-ward.ts) e Yahoo Finance (src/lib/quote-service.ts); macro via BCB SGS. */
export const DATA_SOURCES_LABEL = 'Dados da B3 e da CVM via BRAPI e Yahoo Finance'
/** Não há horário fixo no código: a cotação do dia é buscada no Yahoo Finance (cache de 15 min) e gravada uma vez por dia. */
export const UPDATE_FREQUENCY_LABEL = 'Cotações atualizadas diariamente'

/**
 * Modelos de valuation de ações exibidos ao usuário: os 10 da página de ativo
 * (`src/components/asset/valuation-models.ts`) mais o Barsi, que existe como ranking (`src/lib/ranking-models.ts`).
 * A síntese com IA não entra na conta (não é modelo de valuation). O teste
 * `src/lib/__tests__/site-constants.test.ts` falha se os registros mudarem e este número não.
 * Mantido como literal para não puxar os registros para bundles de cliente.
 */
export const STOCK_VALUATION_MODELS_COUNT = 11
/** Só o Número de Graham é gratuito entre os modelos de ações. */
export const PREMIUM_STOCK_MODELS_COUNT = STOCK_VALUATION_MODELS_COUNT - 1
/** Ex.: "11 modelos de valuation". */
export const VALUATION_MODELS_SHORT_LABEL = `${STOCK_VALUATION_MODELS_COUNT} modelos de valuation`
/** Ex.: "11 modelos de valuation para ações, além de score e preço-teto para FIIs e score para ETFs". */
export const VALUATION_MODELS_LABEL = `${STOCK_VALUATION_MODELS_COUNT} modelos de valuation para ações, além de score e preço-teto para FIIs e score para ETFs`
export const VALUATION_MODELS_EXAMPLES = 'Graham, fluxo de caixa descontado, Gordon, Bazin, Barsi, Peter Lynch e Fórmula Mágica'
export const LEGAL_NOTICE =
  'O Preço Justo AI é uma ferramenta de apoio à análise. Não oferecemos consultoria financeira nem recomendação de investimento. ' +
  'Todo investimento envolve riscos e rentabilidade passada não garante resultados futuros.'
