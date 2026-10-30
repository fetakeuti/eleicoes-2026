import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { valor, legenda, CORTES, ordena } from '../js/mapa/metricas.js';
import { lerHash, escreverHash, corrige } from '../js/mapa/estado.js';
import { normaliza, preparaIndice, busca } from '../js/mapa/busca.js';

const ler = (p) => JSON.parse(readFileSync(new URL(`../dados/${p}`, import.meta.url), 'utf8'));
const meta = ler('meta.json');
const ufs = ler('uf.json').ufs.filter((u) => u.uf !== 'ZZ');
const O = meta.ordem_candidatos;
const val = (u, turno, met, cand = '13') => valor(u.turnos, { turno, met, cand }, O);

test('handoff §4.1: faixas reais das UFs', () => {
  const dm = ufs.map((u) => [u.uf, val(u, 'v', 'dmarg').v]).sort((a, b) => a[1] - b[1]);
  assert.deepEqual([dm[0], dm.at(-1)], [['RO', 2.34], ['RJ', 7.4]]);
  const da = ufs.map((u) => [u.uf, val(u, 'v', 'dabst').v]).sort((a, b) => a[1] - b[1]);
  assert.deepEqual([da[0], da.at(-1)], [['BA', -3.26], ['AP', 8.06]]);
  const ab = ufs.flatMap((u) => ['1', '2'].map((t) => val(u, t, 'abst').v));
  assert.deepEqual([Math.min(...ab), Math.max(...ab)], [13.89, 26.08]);
});

test('mudança de vencedor: só MG virou entre as UFs; em SP, 32 viraram e Trabiju é empate', () => {
  assert.deepEqual(ufs.filter((u) => val(u, 'v', 'flip').virou).map((u) => u.uf), ['MG']);
  const sp = ler('municipio/SP.json').municipios;
  // O handoff fala em 33: conta Trabiju, empatado no 1º turno (574 × 574). A precedência do próprio handoff
  // (sem votantes > empate > classe) pinta Trabiju como empate. Ver DECISOES.md (D38).
  assert.equal(sp.filter((m) => val(m, 'v', 'flip').virou).length, 32);
  const trabiju = sp.find((m) => m.nome === 'TRABIJU');
  assert.equal(val(trabiju, 'v', 'flip').especial, 'empate');
});

test('precedência: sem votantes > empate > classe', () => {
  const marq = ler('municipio/PR.json').municipios.find((m) => m.nome === 'MARQUINHO');
  const e = val(marq, '2', 'venc');
  assert.equal(e.especial, 'empate');
  assert.equal(e.cor, 'var(--mapa-empate)');
  const zero = { aptos: 10, comparecimento: 0, abstencao: 10, votos: { 13: 0, 22: 0 }, pct_validos: { 13: null, 22: null }, taxa_abstencao: 100 };
  const sem = valor({ 1: zero, 2: zero }, { turno: '2', met: 'venc' }, O);
  assert.equal(sem.especial, 'sem');
  assert.equal(valor({ 1: zero, 2: zero }, { turno: 'v', met: 'flip' }, O).especial, 'sem');
});

test('classes: limite inferior incluso e cor do vencedor', () => {
  const sp = ufs.find((u) => u.uf === 'SP');
  const r = val(sp, '2', 'venc');
  assert.equal(r.lado, '22');
  assert.match(r.cor, /^var\(--rampa-22-[1-5]\)$/);
  // margem exatamente no corte sobe de classe
  const b = { comparecimento: 1, votos: { 13: 60, 22: 40 }, pct_validos: { 13: 52.5, 22: 47.5 } };
  assert.equal(valor({ 2: b }, { turno: '2', met: 'venc' }, O).cor, 'var(--rampa-13-2)');
  assert.equal(CORTES.margem[0], 5);
});

test('% de candidato usa a rampa dos demais para eliminados', () => {
  const go = ufs.find((u) => u.uf === 'GO');
  assert.match(val(go, '1', 'cand', '55').cor, /rampa-demais/);
  assert.match(val(go, '1', 'cand', '22').cor, /rampa-22/);
});

test('legenda tem 10 classes no vencedor e 8 nas divergentes', () => {
  assert.equal(legenda({ turno: '2', met: 'venc' }).itens.length, 10);
  assert.equal(legenda({ turno: 'v', met: 'dmarg' }).itens.length, 8);
  assert.equal(legenda({ turno: '1', met: 'abst' }).itens.length, 6);
});

test('ranking: LULA primeiro, FLAVIO primeiro, sem candidato', () => {
  const itens = ufs.map((u) => ({ nome: u.nome, val: val(u, '2', 'venc') }));
  assert.equal(ordena(itens, 'a')[0].val.lado, '13');
  assert.equal(ordena(itens, 'b')[0].val.lado, '22');
  const abs = ordena(itens, 'abs');
  assert.ok(abs[0].val.mag >= abs[1].val.mag);
});

test('estado na URL: ida e volta, e correções', () => {
  const e = lerHash('#mapa?t=2&m=venc&uf=SP&mun=3547809');
  assert.deepEqual(e, { turno: '2', met: 'venc', cand: '13', rec: 'todos', uf: 'SP', mun: 3547809 });
  assert.equal(escreverHash(e), '#mapa?t=2&m=venc&uf=SP&mun=3547809');
  assert.equal(lerHash('#resultado'), null);
  assert.equal(lerHash('#mapa?t=v&m=venc').met, 'flip', 'variação exige métrica de variação');
  assert.equal(lerHash('#mapa?t=1&m=cand&uf=SP').met, 'venc', '% de candidato só no nível UF');
  assert.equal(lerHash('#mapa?t=2&m=venc&mun=3547809').mun, null, 'município sem UF');
  assert.equal(lerHash('#mapa?t=9&m=xx&uf=XX').turno, '2');
  assert.equal(corrige({ turno: '2', met: 'cand', cand: '55', uf: null, mun: null }).cand, '13');
});

test('busca: normaliza acento, caixa, hífen e apóstrofo', () => {
  assert.equal(normaliza('Xique-Xique'), 'xique xique');
  assert.equal(normaliza("Pingo-d'Água"), 'pingo d agua');
  assert.equal(normaliza('  SÃO   Tomé '), 'sao tome');
  const ind = preparaIndice(ler('municipio/indice.json').municipios);
  assert.equal(busca(ind, 'xique xique')[0].nome, 'Xique-Xique');
  assert.equal(busca(ind, "pingo d agua")[0].nome, "Pingo-d'Água");
  assert.equal(busca(ind, 'boa saude')[0].nome, 'Januário Cicco', 'nome do TSE também acha');
  assert.equal(busca(ind, 'sao paulo')[0].cd_ibge, 3550308, 'maior eleitorado primeiro');
  assert.equal(busca(ind, 'santo andre')[0].uf, 'SP');
  assert.ok(busca(ind, 'sao').length <= 6);
  assert.deepEqual(busca(ind, 's'), [], 'menos de 2 letras');
  assert.deepEqual(busca(ind, 'zzzzqq'), []);
});

test('recorte na URL: rec=cap | rec=ncap; ausente = todos', () => {
  assert.equal(lerHash('#mapa?t=2&m=venc').rec, 'todos');
  assert.equal(lerHash('#mapa?t=2&m=venc&rec=cap').rec, 'cap');
  assert.equal(lerHash('#mapa?t=1&m=abst&rec=ncap&uf=SP').rec, 'ncap');
  assert.equal(lerHash('#mapa?t=2&m=venc&rec=xyz').rec, 'todos', 'valor inválido volta ao padrão');
  assert.equal(escreverHash({ ...lerHash('#mapa?t=2&m=venc'), rec: 'cap' }), '#mapa?t=2&m=venc&rec=cap');
  assert.equal(escreverHash(lerHash('#mapa?t=2&m=venc')), '#mapa?t=2&m=venc', 'todos não aparece na URL');
  assert.equal(escreverHash(lerHash('#mapa?t=2&m=venc&rec=ncap&uf=SP&mun=3547809')), '#mapa?t=2&m=venc&rec=ncap&uf=SP&mun=3547809');
});
