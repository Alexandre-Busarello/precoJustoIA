import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMoneyInput,
  formatPercentInput,
  maskMoneyDigits,
  parseMoneyText,
  parseQuantityText,
  roundTo,
  sanitizeQuantityText,
} from '../../../components/portfolio-money-input';

test('maskMoneyDigits lê os dígitos como centavos', () => {
  assert.equal(maskMoneyDigits(''), '');
  assert.equal(maskMoneyDigits('1'), '0,01');
  assert.equal(maskMoneyDigits('12'), '0,12');
  assert.equal(maskMoneyDigits('123'), '1,23');
  assert.equal(maskMoneyDigits('150000'), '1.500,00');
  assert.equal(maskMoneyDigits('123456789'), '1.234.567,89');
  // Digitar sobre um valor já mascarado continua funcionando.
  assert.equal(maskMoneyDigits('1.500,005'), '15.000,05');
  // Apagar o último dígito.
  assert.equal(maskMoneyDigits('1.500,0'), '150,00');
  assert.equal(maskMoneyDigits('0,00'), '0,00');
  assert.equal(maskMoneyDigits('abc'), '');
});

test('parseMoneyText aceita pt-BR, ponto decimal e prefixo R$', () => {
  assert.equal(parseMoneyText('1.234,56'), 1234.56);
  assert.equal(parseMoneyText('R$ 1.234,56'), 1234.56);
  assert.equal(parseMoneyText('32,5'), 32.5);
  assert.equal(parseMoneyText('32.5'), 32.5);
  assert.equal(parseMoneyText('1234.56'), 1234.56);
  assert.equal(parseMoneyText('1.500'), 1500);
  assert.equal(parseMoneyText('1.500.000'), 1500000);
  assert.equal(parseMoneyText(''), undefined);
  assert.equal(parseMoneyText('R$'), undefined);
});

test('formatMoneyInput e ida e volta com a máscara', () => {
  assert.equal(formatMoneyInput(1234.5), '1.234,50');
  assert.equal(formatMoneyInput(0), '0,00');
  assert.equal(formatMoneyInput(undefined), '');
  assert.equal(formatMoneyInput(null), '');
  assert.equal(formatMoneyInput(Number.NaN), '');
  for (const value of [0.01, 9.99, 1500, 32.5, 1234567.89]) {
    assert.equal(parseMoneyText(maskMoneyDigits(formatMoneyInput(value))), value);
  }
});

test('roundTo evita ruído de ponto flutuante', () => {
  assert.equal(roundTo(0.1 + 0.2), 0.3);
  assert.equal(roundTo(10 * 32.555), 325.55);
});

test('quantidade: só dígitos por padrão, vírgula opcional', () => {
  assert.equal(sanitizeQuantityText('1a2b3'), '123');
  assert.equal(sanitizeQuantityText('10,5'), '105');
  assert.equal(sanitizeQuantityText('10,5', true), '10,5');
  assert.equal(sanitizeQuantityText('10.5', true), '10,5');
  assert.equal(sanitizeQuantityText('1,2,3', true), '1,23');
  assert.equal(parseQuantityText('150'), 150);
  assert.equal(parseQuantityText('10,5'), 10.5);
  assert.equal(parseQuantityText(''), undefined);
  assert.equal(parseQuantityText(','), undefined);
});

test('formatPercentInput mostra a alocação com vírgula e sem ruído de ponto flutuante', () => {
  assert.equal(formatPercentInput(undefined), '');
  assert.equal(formatPercentInput(20), '20');
  assert.equal(formatPercentInput(12.5), '12,5');
  assert.equal(formatPercentInput(0.07 * 100), '7');
  assert.equal(formatPercentInput(100 / 3), '33,3333');
});

test('preço com 4 casas mantém o total coerente com o campo exibido', () => {
  // Compra de 7 por R$ 274,88: preço salvo 39,2686; o campo mostra 39,2686 e 10 × 39,2686 = 392,69.
  const price = roundTo(274.88 / 7, 4);
  assert.equal(formatMoneyInput(price, 4), '39,2686');
  assert.equal(roundTo(price * 10), 392.69);
  assert.equal(maskMoneyDigits('392686', 4), '39,2686');
});
