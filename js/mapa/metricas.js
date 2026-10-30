/* Métricas, cortes e cores dos mapas (HANDOFF §4.1). Puro, sem DOM: testado em tests/metricas.test.js.
   Precedência no preenchimento: sem votantes (hachura) > empate > classe da métrica. */

import { resultado, margemPP, classe } from '../regras.js';
import { pct, decimal, arredonda, variacaoPP, inteiro } from '../formato.js';

const v = (nome) => `var(--${nome})`;
export const NOME_CURTO = { 13: 'LULA', 22: 'FLAVIO' };

export const CORTES = {
  margem: [5, 15, 25, 35],
  abstBR: [16, 18, 20, 22, 24],
  abstExt: [40, 50, 60, 70, 80],
  div: [-6, -4, -2, 0, 2, 4, 6],
};
/** Domínio máximo de "% de um candidato" (só UF): 5 classes iguais de 0 a dmax. */
export const DMAX = { 13: 80, 22: 80, 55: 15, 70: 5, 14: 5 };
export const CANDIDATOS_PCT = ['13', '22', '55', '70', '14'];

export const METRICAS = {
  venc: { rotulo: 'Vencedor e margem', variacao: false, comLado: true },
  cand: { rotulo: '% de um candidato', variacao: false, comLado: false, soUF: true },
  abst: { rotulo: 'Abstenção', variacao: false, comLado: false },
  flip: { rotulo: 'Mudança de vencedor', variacao: true, comLado: true },
  dmarg: { rotulo: 'Deslocamento da margem', variacao: true, comLado: true },
  dabst: { rotulo: 'Variação da abstenção', variacao: true, comLado: false },
};

const rampa = (nr, i) => (nr === '13' || nr === '22' ? v(`rampa-${nr}-${i + 1}`) : v(`rampa-demais-${i + 1}`));
const cortesCand = (nr) => [1, 2, 3, 4].map((k) => (DMAX[nr] * k) / 5);

/** Estado especial de um bloco (ou par de blocos, nas métricas de variação). */
function semVotantes(...blocos) {
  return blocos.some((b) => !b || b.comparecimento === 0);
}

/**
 * Valor de uma unidade (UF, município, país) na métrica escolhida.
 * est = { turno: '1' | '2' | 'v', met, cand }. `ordem` = meta.ordem_candidatos.
 * Retorna { v, mag, cor, txt, especial?, virou?, lado? } — `v` ordena o ranking (positivo = LULA nas métricas com lado).
 */
export function valor(turnos, est, ordem, cortesAbst = CORTES.abstBR) {
  const t1 = turnos['1'], t2 = turnos['2'];
  const b = est.turno === 'v' ? null : turnos[est.turno];

  if (est.met === 'venc') {
    if (semVotantes(b)) return { v: 0, mag: 0, cor: null, especial: 'sem', txt: 'Sem votantes' };
    const r = resultado(b.votos, ordem[est.turno]);
    if (r.tipo === 'empate') {
      return { v: 0, mag: 0, cor: v('mapa-empate'), especial: 'empate', txt: `Empate: ${inteiro(r.votos)} × ${inteiro(r.votos)} votos` };
    }
    const m = margemPP(b);
    const sinal = r.nr === '13' ? 1 : -1;
    return { v: sinal * m, mag: m, cor: rampa(r.nr, classe(m, CORTES.margem)), lado: r.nr,
      txt: `${NOME_CURTO[r.nr] || r.nr} +${decimal(m)} p.p.` };
  }
  if (est.met === 'cand') {
    if (semVotantes(b)) return { v: 0, mag: 0, cor: null, especial: 'sem', txt: 'Sem votantes' };
    const p = b.pct_validos[est.cand];
    if (p === undefined || p === null) return { v: 0, mag: 0, cor: null, especial: 'sem-dado', txt: '—' };
    // o rótulo nomeia o candidato: "Acre: FLAVIO 64,56%" (antes, só "Acre: 64,56%" no leitor de tela)
    const nome = NOME_CURTO[est.cand] || `nº ${est.cand}`;
    return { v: p, mag: p, cor: rampa(est.cand, classe(p, cortesCand(est.cand))), txt: `${nome} ${pct(p)}` };
  }
  if (est.met === 'abst') {
    const a = b ? b.taxa_abstencao : null;
    if (a === null) return { v: 0, mag: 0, cor: null, especial: 'sem', txt: 'Sem votantes' };
    const ext = cortesAbst === CORTES.abstExt;
    return { v: a, mag: a, cor: v(`${ext ? 'abst-ext' : 'abst-br'}-${classe(a, cortesAbst) + 1}`), txt: pct(a) };
  }

  // métricas de variação entre turnos
  if (semVotantes(t1, t2)) return { v: 0, mag: 0, cor: null, especial: 'sem', txt: 'Sem votantes' };
  if (est.met === 'flip') {
    const r1 = resultado(t1.votos, ordem['1']), r2 = resultado(t2.votos, ordem['2']);
    if (r1.tipo !== 'vencedor' || r2.tipo !== 'vencedor') {
      return { v: 0, mag: 0, cor: v('mapa-empate'), especial: 'empate', txt: `Empate no ${r1.tipo !== 'vencedor' ? '1º' : '2º'} turno` };
    }
    const virou = r1.nr !== r2.nr;
    const w = r2.nr;
    return { v: (virou ? 2 : 1) * (w === '13' ? 1 : -1), mag: virou ? 1 : 0, virou, lado: w,
      cor: v(`${virou ? 'virou' : 'manteve'}-${w}`),
      txt: virou ? `virou para ${NOME_CURTO[w]}` : `manteve ${NOME_CURTO[w]}` };
  }
  if (est.met === 'dmarg') {
    const s = arredonda((t2.pct_validos['13'] - t2.pct_validos['22']) - (t1.pct_validos['13'] - t1.pct_validos['22']));
    return { v: s, mag: Math.abs(s), cor: v(`div-margem-${classe(s, CORTES.div) + 1}`), lado: s > 0 ? '13' : s < 0 ? '22' : null,
      txt: variacaoPP(s) };
  }
  // dabst
  if (t1.taxa_abstencao === null || t2.taxa_abstencao === null) return { v: 0, mag: 0, cor: null, especial: 'sem', txt: 'Sem votantes' };
  const d = arredonda(t2.taxa_abstencao - t1.taxa_abstencao);
  return { v: d, mag: Math.abs(d), cor: v(`div-abst-${classe(d, CORTES.div) + 1}`), txt: variacaoPP(d) };
}

const ROT_TURNO = { 1: '1º turno', 2: '2º turno', v: 'entre os turnos' };
const faixa = (cortes, sufixo = '') => {
  const f = (x) => (x > 0 && cortes[0] < 0 ? '+' : '') + String(x).replace('.', ',').replace('-', '−');
  const meio = cortes[0] < 0 ? ' a ' : '–';   // escala divergente: "−6 a −4", sem dois sinais colados
  return [`< ${f(cortes[0])}${sufixo}`, ...cortes.slice(0, -1).map((c, i) => `${f(c)}${meio}${f(cortes[i + 1])}${sufixo}`), `≥ ${f(cortes.at(-1))}${sufixo}`];
};

/** Legenda da métrica: título (métrica + turno), nota (domínio) e classes [cor, rótulo]. */
export function legenda(est, nomeCand, cortesAbst = CORTES.abstBR) {
  const tl = ROT_TURNO[est.turno];
  if (est.met === 'venc') {
    const lb = faixa(CORTES.margem);
    return { titulo: `Vencedor e margem, ${tl}`, nota: 'margem em p.p. de votos válidos sobre o 2º colocado',
      itens: [...[4, 3, 2, 1, 0].map((i) => [rampa('22', i), `FLAVIO ${lb[i]}`]), ...[0, 1, 2, 3, 4].map((i) => [rampa('13', i), `LULA ${lb[i]}`])] };
  }
  if (est.met === 'cand') {
    const c = [0, ...cortesCand(est.cand), DMAX[est.cand]];
    const f = (x) => String(arredonda(x, 1)).replace('.', ',');
    return { titulo: `${nomeCand}, % dos votos válidos, ${tl}`, nota: `escala de 0 a ${DMAX[est.cand]}%, igual nos dois turnos`,
      itens: [0, 1, 2, 3, 4].map((i) => [rampa(est.cand, i), i === 4 ? `≥ ${f(c[4])}%` : `${f(c[i])}–${f(c[i + 1])}%`]) };
  }
  if (est.met === 'abst') {
    const ext = cortesAbst === CORTES.abstExt;
    return { titulo: `Taxa de abstenção, ${tl}`, nota: ext ? 'escala própria do exterior' : 'escala fixa nos dois turnos; o exterior fica fora',
      itens: faixa(cortesAbst, '%').map((t, i) => [v(`${ext ? 'abst-ext' : 'abst-br'}-${i + 1}`), t]) };
  }
  if (est.met === 'flip') {
    return { titulo: 'Vencedor no 2º turno × líder no 1º', nota: 'contorno escuro = mudou de lado',
      itens: [[v('virou-22'), 'virou para FLAVIO'], [v('manteve-22'), 'manteve FLAVIO'], [v('manteve-13'), 'manteve LULA'], [v('virou-13'), 'virou para LULA']] };
  }
  const lb = faixa(CORTES.div, '');
  if (est.met === 'dmarg') {
    return { titulo: 'Deslocamento da margem LULA − FLAVIO, 2º − 1º turno', nota: 'p.p.; positivo = a favor de LULA',
      itens: lb.map((t, i) => [v(`div-margem-${i + 1}`), t]) };
  }
  return { titulo: 'Variação da abstenção, 2º − 1º turno', nota: 'p.p.; negativo = a abstenção caiu',
    itens: lb.map((t, i) => [v(`div-abst-${i + 1}`), t]) };
}

/** Ordens do ranking (HANDOFF §3): com lado → LULA / FLAVIO / sem candidato (|valor|); demais → maior / menor. */
export function ordens(met) {
  return METRICAS[met].comLado
    ? [['a', 'LULA primeiro'], ['b', 'FLAVIO primeiro'], ['abs', 'Sem candidato']]
    : [['a', 'Maior primeiro'], ['b', 'Menor primeiro']];
}

export function ordena(itens, ordem) {
  const especial = (x) => (x.val.especial ? 1 : 0);   // estados especiais vão para o fim
  return [...itens].sort((x, y) => especial(x) - especial(y) || (ordem === 'b' ? x.val.v - y.val.v
    : ordem === 'abs' ? y.val.mag - x.val.mag : y.val.v - x.val.v) || x.nome.localeCompare(y.nome, 'pt-BR'));
}
