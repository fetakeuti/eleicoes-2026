import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capitaisVencidas } from '../js/mapa/recortes.js';
import { arredonda } from '../js/formato.js';

const ler = (p) => JSON.parse(readFileSync(new URL(`../dados/${p}`, import.meta.url), 'utf8'));
const meta = ler('meta.json');
const nacional = ler('nacional.json');
const ufs = ler('uf.json').ufs;
const br = ufs.filter((u) => u.uf !== 'ZZ');
const INTEIROS = ['aptos', 'comparecimento', 'abstencao', 'total_votos', 'validos', 'brancos', 'nulos'];

const soma = (blocos, t) => {
  const tot = Object.fromEntries(INTEIROS.map((k) => [k, 0]));
  const votos = {};
  for (const b of blocos) {
    for (const k of INTEIROS) tot[k] += b[t][k];
    for (const [nr, v] of Object.entries(b[t].votos)) votos[nr] = (votos[nr] || 0) + v;
  }
  return { tot, votos };
};

test('27 capitais, uma por UF, marcadas nos arquivos por UF e iguais às de uf.json', () => {
  const caps = br.flatMap((u) => ler(`municipio/${u.uf}.json`).municipios.filter((m) => m.capital));
  assert.equal(caps.length, 27);
  assert.deepEqual(caps.map((m) => m.uf).sort(), br.map((u) => u.uf).sort());
  for (const m of caps) assert.equal(m.cd_ibge, br.find((u) => u.uf === m.uf).recortes.capital.cd_ibge);
  assert.ok(caps.some((m) => m.cd_ibge === 5300108), 'Brasília');
  assert.ok(caps.some((m) => m.cd_ibge === 3550308), 'São Paulo');
  assert.equal(ler('municipio/indice.json').municipios.filter((m) => m.capital).length, 27);
});

test('capital + não capital = UF, em cada UF, turno e campo inteiro (e votos por candidato)', () => {
  for (const u of br) {
    const partes = [u.recortes.capital.turnos, ...(u.recortes.nao_capital ? [u.recortes.nao_capital.turnos] : [])];
    for (const t of ['1', '2']) {
      const { tot, votos } = soma(partes, t);
      for (const k of INTEIROS) assert.equal(tot[k], u.turnos[t][k], `${u.uf} T${t} ${k}`);
      assert.deepEqual(votos, u.turnos[t].votos, `${u.uf} T${t} votos`);
    }
  }
});

test('capitais + não capitais + exterior = nacional', () => {
  const zz = ufs.find((u) => u.uf === 'ZZ');
  for (const t of ['1', '2']) {
    const { tot, votos } = soma([nacional.recortes.capitais.turnos, nacional.recortes.nao_capitais.turnos, zz.turnos], t);
    for (const k of INTEIROS) assert.equal(tot[k], nacional.turnos[t][k], `T${t} ${k}`);
    assert.deepEqual(votos, nacional.turnos[t].votos);
  }
  assert.equal(nacional.recortes.capitais.n_municipios + nacional.recortes.nao_capitais.n_municipios, 5571);
});

test('DF: recorte não capital vazio e explícito (null); exterior sem recortes', () => {
  const df = br.find((u) => u.uf === 'DF');
  assert.equal(df.recortes.nao_capital, null);
  assert.equal(df.recortes.capital.nome, 'Brasília');
  assert.equal(ufs.find((u) => u.uf === 'ZZ').recortes, null);
  assert.equal(br.filter((u) => u.recortes.nao_capital === null).length, 1, 'só o DF');
});

test('taxas dos recortes recalculadas das somas, nunca média de taxas', () => {
  const blocos = [nacional.recortes.capitais.turnos, nacional.recortes.nao_capitais.turnos,
    ...br.flatMap((u) => [u.recortes.capital.turnos, u.recortes.nao_capital?.turnos].filter(Boolean))];
  for (const b of blocos) {
    for (const t of ['1', '2']) {
      const x = b[t];
      const den = x.comparecimento + x.abstencao;
      assert.equal(x.taxa_abstencao, arredonda((x.abstencao / den) * 100));
      assert.equal(x.pct_brancos, arredonda((x.brancos / x.total_votos) * 100));
      for (const [nr, v] of Object.entries(x.votos)) assert.equal(x.pct_validos[nr], arredonda((v / x.validos) * 100));
    }
  }
});

test('capitais vencidas somam 27 em cada turno', () => {
  for (const t of ['1', '2']) {
    const c = capitaisVencidas(ufs, t, meta.ordem_candidatos);
    assert.equal(Object.values(c).reduce((a, b) => a + b, 0), 27);
  }
});
