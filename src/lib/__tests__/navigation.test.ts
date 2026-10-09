import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getActiveSection, navigation, type NavSection } from '../navigation'

test('getActiveSection destaca Descobrir nos índices', () => {
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

function menuLinks(sections: NavSection[]): Array<{ label: string; href: string }> {
  return sections.flatMap((section) => (section.href ? [{ label: section.label, href: section.href }] : (section.items ?? [])))
}

test('cada rota aparece uma única vez em cada menu', () => {
  for (const [name, sections] of Object.entries(navigation)) {
    const hrefs = menuLinks(sections).map((link) => link.href)
    const duplicated = hrefs.filter((href, index) => hrefs.indexOf(href) !== index)
    assert.deepEqual(duplicated, [], `rotas repetidas no menu ${name}`)
  }
})

test('a mesma rota tem o mesmo rótulo no menu de marketing e no do app', () => {
  const marketing = new Map(menuLinks(navigation.marketing).map((link) => [link.href, link.label]))
  for (const link of menuLinks(navigation.app)) {
    const label = marketing.get(link.href)
    if (label !== undefined) assert.equal(link.label, label, link.href)
  }
})

test('Backtest e Meu radar ficam no grupo esperado do app', () => {
  const groupOf = (href: string) => navigation.app.find((section) => section.items?.some((item) => item.href === href))?.label
  assert.equal(groupOf('/backtest'), 'Carteiras')
  assert.equal(groupOf('/agenda-proventos'), 'Carteiras')
  assert.equal(groupOf('/radar'), 'Alertas')
})
