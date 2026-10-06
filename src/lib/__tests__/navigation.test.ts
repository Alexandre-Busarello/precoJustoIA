import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getActiveSection, navigation } from '../navigation'

test('getActiveSection destaca um único item de topo quando o link aparece em dois grupos', () => {
  assert.equal(getActiveSection('/indices/ipj-value', navigation.app)?.label, 'Descobrir')
  assert.equal(getActiveSection('/indices', navigation.marketing)?.label, 'Descobrir')
})

test('getActiveSection escolhe o link mais específico', () => {
  assert.equal(getActiveSection('/dashboard', navigation.app)?.label, 'Início')
  assert.equal(getActiveSection('/dashboard/subscriptions', navigation.app)?.label, 'Alertas')
  assert.equal(getActiveSection('/carteira', navigation.app)?.label, 'Carteiras')
})

test('getActiveSection sem correspondência', () => {
  assert.equal(getActiveSection('/acao/petr4', navigation.app), undefined)
  assert.equal(getActiveSection(null, navigation.marketing), undefined)
})
