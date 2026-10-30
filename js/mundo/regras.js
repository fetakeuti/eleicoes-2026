/* Regras do mapa-múndi (HANDOFF §2 e §4): métricas, círculos, avisos e estado na URL.
   Puro, sem DOM: testado em tests/exterior.test.js. */

import { valor, CORTES, NOME_CURTO } from '../mapa/metricas.js';
import { resultado } from '../regras.js';
import { inteiro } from '../formato.js';

export const METRICAS_EXT = {
  venc: 'Vencedor e margem',
  abst: 'Abstenção',
  vot: 'Votantes (círculos)',
};
export const PADRAO_EXT = { turno: '2', met: 'venc', pais: null };
export const MAX_VOTANTES = 87407;   // EUA, 2º turno: o maior círculo (raio 30 no viewBox de 1000)
export const BASE_PEQUENA = 30;

export function lerHashExt(hash) {
  const [ancora, query = ''] = hash.replace(/^#/, '').split('?');
  if (ancora !== 'exterior') return null;
  const q = new URLSearchParams(query);
  return {
    turno: ['1', '2'].includes(q.get('t')) ? q.get('t') : PADRAO_EXT.turno,
    met: METRICAS_EXT[q.get('m')] ? q.get('m') : PADRAO_EXT.met,
    pais: /^[A-Z]{3}$/.test(q.get('pais') || '') ? q.get('pais') : null,
  };
}

export function escreverHashExt(est) {
  const q = new URLSearchParams({ t: est.turno, m: est.met });
  if (est.pais) q.set('pais', est.pais);
  return `#exterior?${q}`;
}

/** Raio do círculo de área proporcional (HANDOFF §4.1): √(c / 87.407) × 30, mínimo 1,5; 0 sem votantes. */
export function raio(comparecimento) {
  return comparecimento > 0 ? Math.max(1.5, Math.sqrt(comparecimento / MAX_VOTANTES) * 30) : 0;
}

/** Valor de um país na métrica. Precedência: sem votantes (hachura) > empate > classe. */
export function valorExt(turnos, est, ordem) {
  const b = turnos[est.turno];
  if (b.sem_comparecimento) return { v: -1, mag: 0, cor: null, especial: 'sem', txt: 'Sem votantes' };
  if (est.met === 'abst') return valor(turnos, { turno: est.turno, met: 'abst' }, ordem, CORTES.abstExt);
  if (est.met === 'venc') return valor(turnos, { turno: est.turno, met: 'venc' }, ordem);
  // votantes: tamanho = comparecimento, cor = vencedor (empate com a cor de empate)
  const r = resultado(b.votos, ordem[est.turno]);
  const cor = r.tipo === 'empate' ? 'var(--mapa-empate)' : `var(--cand-${r.nr})`;
  return { v: b.comparecimento, mag: b.comparecimento, cor, raio: raio(b.comparecimento), lado: r.nr ?? null,
    empate: r.tipo === 'empate',   // no modo votantes o empate só muda a cor; a ordem continua pelos votantes
    txt: `${inteiro(b.comparecimento)} votantes${r.tipo === 'vencedor' ? ` · ${NOME_CURTO[r.nr] || r.nr}` : ' · empate'}` };
}

/** Resumo público do motivo de confiança baixa (meta.cidades_baixa_confianca[].motivo é técnico). */
const RESUMO_CONFIANCA = {
  CHUY: 'O país desta cidade não pôde ser confirmado pelo local de votação: Chuy (Uruguai) faz divisa com Chuí (RS). Contada no Uruguai.',
  'SAINT JOHNS': 'O país desta cidade não pôde ser confirmado pelo local de votação: há St. John\'s em Antígua e Barbuda e no Canadá. Contada em Antígua e Barbuda, onde há embaixada brasileira.',
  'ST GEORGES DE LOYAPOCK': 'O país desta cidade não pôde ser confirmado pelo local de votação. Saint-Georges-de-l\'Oyapock fica na Guiana Francesa.',
};
export const NOTA_TRIPOLI = 'Os eleitores desta seção votaram na Embaixada do Brasil em Túnis, na Tunísia. O voto é contado na Líbia.';

/**
 * Avisos de um país ou cidade no turno (HANDOFF §2): sem votantes (dois sabores), base pequena, empate,
 * confiança baixa e a nota fixa de Trípoli. Retorna [{ tipo, texto }].
 */
export function avisos(item, turno, ordem, cidadesBaixa = []) {
  const b = item.turnos[turno];
  const lista = [];
  if (b.sem_comparecimento) {
    lista.push({ tipo: 'sem', texto: b.taxa_abstencao === null
      ? `Sem votantes: a seção não foi instalada (${inteiro(b.aptos)} ${b.aptos === 1 ? 'eleitor apto' : 'eleitores aptos'}). Abstenção —.`
      : `Sem votantes: a seção funcionou, mas nenhum dos ${inteiro(b.aptos)} eleitores aptos votou. Abstenção de 100%.` });
  } else if (b.comparecimento < BASE_PEQUENA) {
    lista.push({ tipo: 'base', texto: `Base muito pequena: ${inteiro(b.comparecimento)} ${b.comparecimento === 1 ? 'votante' : 'votantes'}.` });
  }
  if (!b.sem_comparecimento) {
    const r = resultado(b.votos, ordem[turno]);
    if (r.tipo === 'empate') lista.push({ tipo: 'empate', texto: `Empate: ${inteiro(r.votos)} × ${inteiro(r.votos)} votos.` });
  }
  const cidades = item.cidades ?? [item];
  for (const c of cidades) {
    if (c.confianca !== 'baixa') continue;
    const prefixo = item.cidades ? `${c.nome}: ` : '';
    if (c.nome === 'TRÍPOLI') lista.push({ tipo: 'tripoli', texto: prefixo + NOTA_TRIPOLI });
    else {
      const meta = cidadesBaixa.find((x) => x.cidade === c.nome);
      lista.push({ tipo: 'confianca', texto: prefixo + (RESUMO_CONFIANCA[c.nome] || meta?.motivo || 'País não confirmado pelo local de votação.') });
    }
  }
  return lista;
}
