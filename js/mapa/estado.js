/* Estado do mapa na URL (HANDOFF §1): #mapa?t=2&m=venc&c=13&rec=cap&uf=SP&mun=3547809. Puro: testado em tests/mapa.test.js.
   rec = recorte: cap (só capitais) | ncap (sem as capitais); ausente = todos os municípios. */

import { METRICAS, CANDIDATOS_PCT } from './metricas.js';

export const PADRAO = { turno: '2', met: 'venc', cand: '13', rec: 'todos', uf: null, mun: null };
export const RECORTES = { todos: 'Todos', cap: 'Capitais', ncap: 'Não capitais' };
const UFS = new Set(['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']);

/** Lê o estado do hash; valores inválidos voltam ao padrão, e combinações impossíveis são corrigidas. */
export function lerHash(hash, secao = 'mapa') {
  const est = { ...PADRAO };
  const [ancora, query = ''] = hash.replace(/^#/, '').split('?');
  if (ancora !== secao) return null;
  const q = new URLSearchParams(query);
  if (['1', '2', 'v'].includes(q.get('t'))) est.turno = q.get('t');
  if (METRICAS[q.get('m')]) est.met = q.get('m');
  if (CANDIDATOS_PCT.includes(q.get('c'))) est.cand = q.get('c');
  if (['cap', 'ncap'].includes(q.get('rec'))) est.rec = q.get('rec');
  if (UFS.has(q.get('uf'))) est.uf = q.get('uf');
  if (est.uf && /^\d{7}$/.test(q.get('mun') || '')) est.mun = Number(q.get('mun'));
  return corrige(est);
}

/** Turno e métrica coerentes (métricas de variação só em t=v; % de candidato só no nível UF e com candidato do turno). */
export function corrige(est) {
  const e = { ...est };
  if (e.turno === 'v' && !METRICAS[e.met].variacao) e.met = 'flip';
  if (e.turno !== 'v' && METRICAS[e.met].variacao) e.met = 'venc';
  if (e.met === 'cand' && e.uf) e.met = 'venc';
  if (e.met === 'cand' && e.turno === '2' && !['13', '22'].includes(e.cand)) e.cand = '13';
  if (!e.uf) e.mun = null;
  return e;
}

export function escreverHash(est, secao = 'mapa') {
  const q = new URLSearchParams({ t: est.turno, m: est.met });
  if (est.met === 'cand') q.set('c', est.cand);
  if (est.rec && est.rec !== 'todos') q.set('rec', est.rec);
  if (est.uf) q.set('uf', est.uf);
  if (est.mun) q.set('mun', String(est.mun));
  return `#${secao}?${q}`;
}

/** Mudança de nível (UF ou município) ou de recorte entra no histórico; o resto só substitui a entrada atual. */
export const mudouNivel = (a, b) => a.uf !== b.uf || a.mun !== b.mun || (a.rec || 'todos') !== (b.rec || 'todos');
