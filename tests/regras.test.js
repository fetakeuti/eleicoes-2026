import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resultado, classe, margemPP, pctBrancosNulos } from '../js/regras.js';

const ler = (p) => JSON.parse(readFileSync(new URL(`../dados/${p}`, import.meta.url), 'utf8'));
const meta = ler('meta.json');

test('empate real: Marquinho (PR), 2º turno, 1.530 × 1.530', () => {
  const m = ler('municipio/PR.json').municipios.find((x) => x.nome === 'MARQUINHO');
  const t = m.turnos['2'];
  assert.deepEqual(t.votos, { 13: 1530, 22: 1530 });
  const r = resultado(t.votos, meta.ordem_candidatos['2']);
  assert.equal(r.tipo, 'empate');
  assert.deepEqual(r.nrs, ['13', '22']);
  assert.equal(r.votos, 1530);
});

test('empate real: Guiné-Bissau, 1º turno, 17 × 17 (12 candidatos)', () => {
  const p = ler('exterior_pais.json').paises.find((x) => x.iso3 === 'GNB');
  const t = p.turnos['1'];
  const r = resultado(t.votos, meta.ordem_candidatos['1']);
  assert.equal(r.tipo, 'empate');
  assert.deepEqual(r.nrs, ['22', '13']);
  assert.equal(r.votos, 17);
});

test('vencedor por votos inteiros, não pelo % arredondado', () => {
  // 50,00% × 50,00% arredondado, mas 1 voto de diferença: há vencedor
  const r = resultado({ 13: 100001, 22: 100000 });
  assert.equal(r.tipo, 'vencedor');
  assert.equal(r.nr, '13');
  assert.equal(r.margemVotos, 1);
  // % iguais por arredondamento não viram empate
  assert.equal(resultado({ 13: 200001, 22: 200000 }).tipo, 'vencedor');
});

test('nacional: LULA vence o 2º turno, FLAVIO lidera o 1º', () => {
  const n = ler('nacional.json');
  const r2 = resultado(n.turnos['2'].votos, meta.ordem_candidatos['2']);
  assert.equal(r2.tipo, 'vencedor');
  assert.equal(r2.nr, '13');
  assert.equal(r2.margemVotos, 64256232 - 59826041);
  assert.equal(resultado(n.turnos['1'].votos, meta.ordem_candidatos['1']).nr, '22');
});

test('sem votantes: nenhum voto não é empate', () => {
  assert.deepEqual(resultado({ 13: 0, 22: 0 }), { tipo: 'sem_votos' });
});

test('nenhum empate escondido: todo município e país com máximo repetido é marcado como empate', () => {
  const ufs = ler('uf.json').ufs.map((u) => u.uf).filter((u) => u !== 'ZZ');
  let empates = 0;
  for (const uf of ufs) {
    for (const m of ler(`municipio/${uf}.json`).municipios) {
      for (const t of ['1', '2']) {
        const v = Object.values(m.turnos[t].votos).sort((a, b) => b - a);
        const r = resultado(m.turnos[t].votos, meta.ordem_candidatos[t]);
        assert.equal(r.tipo === 'empate', v[0] === v[1] && v[0] > 0, `${m.nome}/${uf} T${t}`);
        if (r.tipo === 'empate') empates += 1;
      }
    }
  }
  assert.ok(empates >= 1);
});

test('classe com limite inferior incluso', () => {
  const cortes = [5, 15, 25, 35];
  assert.equal(classe(4.99, cortes), 0);
  assert.equal(classe(5, cortes), 1);
  assert.equal(classe(35, cortes), 4);
  assert.equal(classe(-6, [-6, -4, -2, 0, 2, 4, 6]), 1);
  assert.equal(classe(-6.01, [-6, -4, -2, 0, 2, 4, 6]), 0);
});

test('margem e brancos + nulos recalculados', () => {
  const n = ler('nacional.json');
  assert.equal(margemPP(n.turnos['2']), 3.58);
  const t = n.turnos['1'];
  assert.equal(pctBrancosNulos(t), Math.round(((t.brancos + t.nulos) / t.total_votos) * 10000) / 100);
});
