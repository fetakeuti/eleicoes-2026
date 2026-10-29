import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as f from '../js/formato.js';

const M = '−';

test('milhar com ponto', () => {
  assert.equal(f.inteiro(158745502), '158.745.502');
  assert.equal(f.inteiro(999), '999');
  assert.equal(f.inteiro(1000), '1.000');
  assert.equal(f.inteiro(0), '0');
  assert.equal(f.inteiro(-870302), `${M}870.302`);
});

test('decimal com vírgula', () => {
  assert.equal(f.decimal(47.03), '47,03');
  assert.equal(f.decimal(2.9), '2,90');
  assert.equal(f.decimal(1234.5), '1.234,50');
  assert.equal(f.decimal(1.005), '1,01', 'meio arredonda para longe do zero, sem ruído binário');
  assert.equal(f.decimal(-0.004), '0,00', 'zero arredondado não leva sinal');
});

test('% com 2 casas', () => {
  assert.equal(f.pct(47.03), '47,03%');
  assert.equal(f.pct(100), '100,00%');
  assert.equal(f.pct(0), '0,00%');
  assert.equal(f.pct(19.2), '19,20%');
});

test('"—" para null, nunca 0%', () => {
  assert.equal(f.pct(null), '—');
  assert.equal(f.pct(undefined), '—');
  assert.equal(f.inteiro(null), '—');
  assert.equal(f.variacaoPP(null), '—');
  assert.equal(f.difPP(null, 3), '—');
  assert.equal(f.pctCandidato(5, null), '—');
});

test('"< 0,01%" e "0 voto" no percentual de candidato', () => {
  assert.equal(f.pctCandidato(3, 0.0), '< 0,01%', 'votos > 0 com % que chega como 0.0');
  assert.equal(f.pctCandidato(3, 0.004), '< 0,01%');
  assert.equal(f.pctCandidato(0, 0.0), '0 voto');
  assert.equal(f.pctCandidato(0, null), '0 voto');
  assert.equal(f.pctCandidato(12, 0.01), '0,01%');
  assert.equal(f.pctCandidato(64256232, 51.79), '51,79%');
});

test('sinal de menos U+2212 em toda variação negativa', () => {
  assert.equal(f.variacaoInteiro(-870302), `${M}870.302`);
  assert.equal(f.variacaoPP(-1.86), `${M}1,86 p.p.`);
  for (const s of [f.variacaoInteiro(-1), f.variacaoPP(-0.5), f.inteiro(-3), f.decimal(-2)]) {
    assert.ok(!s.includes('-'), `hífen em "${s}"`);
    assert.ok(s.startsWith(M), `sem U+2212 em "${s}"`);
  }
});

test('"+1,86 p.p." e variações', () => {
  assert.equal(f.variacaoPP(1.86), '+1,86 p.p.');
  assert.equal(f.variacaoPP(0), '0,00 p.p.');
  assert.equal(f.variacaoPP(0.004), '0,00 p.p.', 'arredonda a zero: sem sinal');
  assert.equal(f.difPP(78.92, 80.78), '+1,86 p.p.', 'comparecimento real, 1º → 2º turno');
  assert.equal(f.difPP(21.08, 19.22), `${M}1,86 p.p.`);
  assert.equal(f.variacaoInteiro(2960239), '+2.960.239');
  assert.equal(f.variacaoInteiro(0), '0');
});

test('votos no singular e no plural', () => {
  assert.equal(f.votos(1), '1 voto');
  assert.equal(f.votos(1530), '1.530 votos');
  assert.equal(f.votos(0), '0 votos');
});

test('percentual recalculado dos inteiros', () => {
  assert.equal(f.razaoPct(1, 3), 33.33);
  assert.equal(f.razaoPct(5, 0), null);
});

test('nome próprio a partir do nome de urna', () => {
  assert.equal(f.nomeProprio('LULA'), 'Lula');
  assert.equal(f.nomeProprio('FLAVIO BOLSONARO'), 'Flavio Bolsonaro');
});
