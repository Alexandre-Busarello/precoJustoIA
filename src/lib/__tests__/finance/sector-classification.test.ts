import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCyclicalCommodity, isFinancial, isUtility, sectorClass } from '../../finance/sector-classification'

test('isFinancial: nomes B3', () => {
  assert.equal(isFinancial('Financeiro', 'Bancos'), true)
  assert.equal(isFinancial('Financeiro', 'Previdência e Seguros'), true)
  assert.equal(isFinancial('Financeiro', 'Serviços Financeiros Diversos'), true)
  assert.equal(isFinancial('Financeiro', 'Holdings Diversificadas'), true)
  assert.equal(isFinancial('Financeiro e Outros', 'Intermediários Financeiros'), true)
})

test('isFinancial: nomes do Yahoo traduzidos e em inglês, sem depender de acento ou caixa', () => {
  assert.equal(isFinancial('Serviços Financeiros', 'Bancos - Regionais'), true)
  assert.equal(isFinancial('Financial Services', 'Insurance - Diversified'), true)
  assert.equal(isFinancial('SERVICOS FINANCEIROS', 'Seguradoras'), true)
  assert.equal(isFinancial(null, 'Banks—Diversified'), true)
  assert.equal(isFinancial('Financeiro', 'Previdencia e Seguros'), true)
})

test('isFinancial: imobiliário e demais setores ficam de fora', () => {
  assert.equal(isFinancial('Financeiro', 'Exploração de Imóveis'), false)
  assert.equal(isFinancial('Fundos Imobiliários', 'Títulos e Val. Mob.'), false)
  assert.equal(isFinancial('Real Estate', 'REIT—Diversified'), false)
  assert.equal(isFinancial('Utilidade Pública', 'Energia Elétrica'), false)
  assert.equal(isFinancial('Bens Industriais', 'Serviços de Segurança'), false)
  assert.equal(isFinancial(null, null), false)
})

test('isUtility: energia elétrica, saneamento e gás', () => {
  assert.equal(isUtility('Utilidade Pública', 'Energia Elétrica'), true)
  assert.equal(isUtility('Utilidade Pública', 'Água e Saneamento'), true)
  assert.equal(isUtility('Utilidade Pública', 'Gás'), true)
  assert.equal(isUtility('Utilidades Públicas', 'Serviços Públicos - Elétricos Regulados'), true)
  assert.equal(isUtility('Serviços Públicos', null), true)
  assert.equal(isUtility('Utilities', 'Utilities—Regulated Water'), true)
  assert.equal(isUtility(null, 'Energia Renovável'), true)
})

test('isUtility não confunde petróleo e gás nem equipamentos elétricos', () => {
  assert.equal(isUtility('Energia', 'Petróleo, Gás e Biocombustíveis'), false)
  assert.equal(isUtility('Bens Industriais', 'Equipamentos Elétricos'), false)
  assert.equal(isUtility('Consumo Cíclico', 'Aparelhos Elétricos'), false)
  assert.equal(isUtility('Financeiro', 'Bancos'), false)
})

test('isCyclicalCommodity: petróleo, mineração, siderurgia, papel e celulose, agro', () => {
  assert.equal(isCyclicalCommodity('Energia', 'Petróleo, Gás e Biocombustíveis'), true)
  assert.equal(isCyclicalCommodity('Materiais Básicos', 'Mineração'), true)
  assert.equal(isCyclicalCommodity('Materiais Básicos', 'Siderurgia e Metalurgia'), true)
  assert.equal(isCyclicalCommodity('Materiais Básicos', 'Madeira e Papel'), true)
  assert.equal(isCyclicalCommodity('Materiais Básicos', 'Papel e Celulose'), true)
  assert.equal(isCyclicalCommodity('Consumo Não Cíclico', 'Agropecuária'), true)
  assert.equal(isCyclicalCommodity('Consumo Não Cíclico', 'Açúcar e Álcool'), true)
  assert.equal(isCyclicalCommodity('Materiais Básicos', 'Aço'), true)
  assert.equal(isCyclicalCommodity('Energy', 'Oil & Gas Integrated'), true)
  assert.equal(isCyclicalCommodity('Basic Materials', 'Steel'), true)
})

test('isCyclicalCommodity: demais setores ficam de fora', () => {
  assert.equal(isCyclicalCommodity('Consumo Não Cíclico', 'Bebidas'), false)
  assert.equal(isCyclicalCommodity('Utilidade Pública', 'Energia Elétrica'), false)
  assert.equal(isCyclicalCommodity('Financeiro', 'Ações e Transações'), false)
  assert.equal(isCyclicalCommodity('Tecnologia da Informação', 'Programas e Serviços'), false)
})

test('sectorClass segue a precedência financeira → utility → commodity → outra', () => {
  assert.equal(sectorClass('Financeiro', 'Bancos'), 'financial')
  assert.equal(sectorClass('Utilidade Pública', 'Energia Elétrica'), 'utility')
  assert.equal(sectorClass('Materiais Básicos', 'Mineração'), 'cyclicalCommodity')
  assert.equal(sectorClass('Saúde', 'Serviços Médico-Hospitalares'), 'other')
})

test('não confunde indústrias que só usam commodities nem fintechs com bancos', () => {
  assert.equal(isCyclicalCommodity('Bens Industriais', 'Máquinas Agrícolas'), false)
  assert.equal(sectorClass('Bens Industriais', 'Máquinas Agrícolas'), 'other')
  assert.equal(isCyclicalCommodity('Bens Industriais', 'Artefatos de Ferro e Aço'), false)
  assert.equal(isCyclicalCommodity('Materiais Básicos', 'Artefatos de Cobre'), false)
  assert.equal(isCyclicalCommodity('Bens Industriais', 'Agricultural Machinery'), false)
  assert.equal(isFinancial('Tecnologia da Informação', 'Tecnologia financeira'), false)
  assert.equal(isFinancial('Serviços Financeiros', 'Tecnologia Financeira'), false)
  assert.equal(isFinancial('Financial Services', 'Software - Infrastructure'), false)
  assert.equal(sectorClass(null, 'Fintech'), 'other')
  // Holdings financeiras sem indústria específica continuam financeiras.
  assert.equal(isFinancial('Financeiro', 'Holdings Diversificadas'), true)
})
