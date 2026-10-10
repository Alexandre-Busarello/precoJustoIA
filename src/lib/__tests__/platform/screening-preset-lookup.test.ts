import test from 'node:test'
import assert from 'node:assert/strict'

import { SCREENING_PRESETS, findPresetForScreeningParams } from '../../screening-presets'

test('parâmetros de um preset conhecido liberam o modo preset', () => {
  for (const preset of Object.values(SCREENING_PRESETS)) {
    const found = findPresetForScreeningParams(JSON.parse(JSON.stringify({ ...preset.params, includeBDRs: false })))
    assert.equal(found?.slug, preset.slug)
  }
})

test('presets com o mesmo sortBy são distinguidos pelos filtros', () => {
  const smallCaps = SCREENING_PRESETS['small-caps-crescimento-explosivo'].params
  const desconto = SCREENING_PRESETS['oportunidades-desconto-excessivo'].params
  assert.equal(smallCaps.sortBy, desconto.sortBy)
  assert.equal(findPresetForScreeningParams(desconto)?.slug, 'oportunidades-desconto-excessivo')
})

test('sortBy avulso não libera filtros Premium', () => {
  assert.equal(findPresetForScreeningParams({ sortBy: 'dy_desc', roeFilter: { enabled: true, min: 0.2 } }), null)
  assert.equal(findPresetForScreeningParams({ sortBy: 'qualquer' }), null)
  // Preset com um filtro alterado deixa de ser o preset
  const graham = SCREENING_PRESETS['as-acoes-mais-baratas-segundo-graham'].params
  assert.equal(findPresetForScreeningParams({ ...graham, plFilter: { enabled: true, max: 40 } }), null)
  assert.equal(findPresetForScreeningParams({ ...graham, sortBy: undefined }), null)
  assert.equal(findPresetForScreeningParams(null), null)
})
