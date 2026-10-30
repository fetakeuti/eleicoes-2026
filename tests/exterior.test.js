import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { valorExt, avisos, raio, lerHashExt, escreverHashExt, NOTA_TRIPOLI } from '../js/mundo/regras.js';
import { CORTES } from '../js/mapa/metricas.js';
import { normaliza } from '../js/mapa/busca.js';

const ler = (p) => JSON.parse(readFileSync(new URL(`../dados/${p}`, import.meta.url), 'utf8'));
const meta = ler('meta.json');
const paises = ler('exterior_pais.json').paises;
const O = meta.ordem_candidatos;
const pais = (iso) => paises.find((p) => p.iso3 === iso);
const topo = ler('malhas/mundo.json');

test('todo país do dado tem polígono ou ponto na malha mundial', () => {
  const geo = new Set([...topo.objects.paises.geometries, ...topo.objects.pontos.geometries].map((g) => g.properties.iso3));
  assert.deepEqual(paises.map((p) => p.iso3).filter((i) => !geo.has(i)), []);
  assert.ok(geo.has('GUF') && !topo.objects.paises.geometries.some((g) => g.properties.iso3 === 'ATA'));
});

test('sem votantes, dois sabores: Paquistão (não instalada) e Líbia no 2º turno (instalada)', () => {
  const pak = avisos(pais('PAK'), '1', O);
  assert.equal(pak[0].tipo, 'sem');
  assert.match(pak[0].texto, /não foi instalada \(18 eleitores aptos\)\. Abstenção —/);
  const lby = avisos(pais('LBY'), '2', O, meta.cidades_baixa_confianca);
  assert.match(lby[0].texto, /nenhum dos 30 eleitores aptos votou\. Abstenção de 100%/);
  assert.equal(valorExt(pais('LBY').turnos, { turno: '2', met: 'abst' }, O).especial, 'sem', 'hachura vence a classe de 100%');
});

test('Líbia: base pequena no 1º turno e nota fixa de Trípoli', () => {
  const a = avisos(pais('LBY'), '1', O, meta.cidades_baixa_confianca);
  assert.deepEqual(a.map((x) => x.tipo), ['base', 'tripoli']);
  assert.equal(a[0].texto, 'Base muito pequena: 2 votantes.');
  assert.ok(a[1].texto.endsWith(NOTA_TRIPOLI));
  const tripoli = pais('LBY').cidades[0];
  assert.equal(avisos(tripoli, '1', O)[1].texto, NOTA_TRIPOLI, 'na cidade, sem prefixo');
});

test('base pequena: 12 países em cada turno', () => {
  for (const t of ['1', '2']) {
    assert.equal(paises.filter((p) => avisos(p, t, O).some((a) => a.tipo === 'base')).length, 12);
  }
});

test('Guiné-Bissau, 1º turno: empate em votos inteiros (17 × 17)', () => {
  const v = valorExt(pais('GNB').turnos, { turno: '1', met: 'venc' }, O);
  assert.equal(v.especial, 'empate');
  assert.ok(avisos(pais('GNB'), '1', O).some((a) => a.tipo === 'empate' && a.texto === 'Empate: 17 × 17 votos.'));
});

test('confiança baixa: aviso resumido, nunca o texto técnico', () => {
  const guf = avisos(pais('GUF'), '2', O, meta.cidades_baixa_confianca).find((a) => a.tipo === 'confianca');
  assert.match(guf.texto, /^ST GEORGES DE LOYAPOCK: O país desta cidade não pôde ser confirmado/);
  assert.ok(!/seção \(|fase3|ZZ/.test(guf.texto));
  const baixas = paises.flatMap((p) => avisos(p, '2', O, meta.cidades_baixa_confianca)).filter((a) => ['confianca', 'tripoli'].includes(a.tipo));
  assert.equal(baixas.length, 4, 'Chuy, Saint Johns, St Georges e Trípoli');
});

test('abstenção do exterior usa a escala própria', () => {
  const v = valorExt(pais('USA').turnos, { turno: '2', met: 'abst' }, O);
  assert.match(v.cor, /^var\(--abst-ext-[1-6]\)$/);
  assert.equal(CORTES.abstExt[0], 40);
});

test('círculos: área proporcional, EUA no 2º turno com raio 30, mínimo 1,5', () => {
  assert.equal(raio(87407), 30);
  assert.equal(raio(0), 0);
  assert.equal(raio(1), 1.5);
  assert.ok(Math.abs(raio(87407 / 4) - 15) < 1e-9, '1/4 dos votantes = metade do raio');
  const v = valorExt(pais('USA').turnos, { turno: '2', met: 'vot' }, O);
  assert.equal(v.raio, 30);
  assert.match(v.cor, /cand-(13|22)/);
});

test('estado na URL do exterior', () => {
  assert.deepEqual(lerHashExt('#exterior?t=2&m=abst&pais=LBY'), { turno: '2', met: 'abst', pais: 'LBY' });
  assert.equal(escreverHashExt({ turno: '1', met: 'vot', pais: null }), '#exterior?t=1&m=vot');
  assert.equal(lerHashExt('#mapa?t=2'), null);
  assert.deepEqual(lerHashExt('#exterior?t=9&m=x&pais=ly'), { turno: '2', met: 'venc', pais: null });
});

test('busca de país e cidade normaliza acento', () => {
  assert.equal(normaliza('Guiné-Bissau'), 'guine bissau');
  assert.equal(normaliza('TRÍPOLI'), 'tripoli');
});
