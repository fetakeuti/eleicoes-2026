/* Regras de dado que viram regra de interface (HANDOFF §2 e §4.1). Puro, sem DOM. */

import { arredonda } from './formato.js';

/**
 * Resultado de um bloco de turno decidido por VOTOS INTEIROS, nunca pelo % arredondado.
 * `ordem` (meta.ordem_candidatos[t]) só desempata a apresentação, não o resultado.
 * Retorna:
 *   { tipo: 'sem_votos' }                                    ninguém votou (validos = 0)
 *   { tipo: 'empate', nrs: ['13', '22'], votos: 1530 }       dois ou mais com o máximo de votos
 *   { tipo: 'vencedor', nr: '13', segundo: '22', margemVotos: 4430191 }
 */
export function resultado(votosPorNr, ordem = Object.keys(votosPorNr)) {
  const nrs = ordem.filter((nr) => nr in votosPorNr);
  const max = Math.max(0, ...nrs.map((nr) => votosPorNr[nr]));
  if (max === 0) return { tipo: 'sem_votos' };
  const topo = nrs.filter((nr) => votosPorNr[nr] === max);
  if (topo.length > 1) return { tipo: 'empate', nrs: topo, votos: max };
  const resto = nrs.filter((nr) => nr !== topo[0]);
  const segundo = resto.reduce((a, nr) => (a === null || votosPorNr[nr] > votosPorNr[a] ? nr : a), null);
  return { tipo: 'vencedor', nr: topo[0], segundo, margemVotos: max - (segundo ? votosPorNr[segundo] : 0) };
}

/** Margem em p.p. de válidos entre dois candidatos (|%a − %b|), a partir dos percentuais do contrato. */
export function margemPP(bloco, a = '13', b = '22') {
  const pa = bloco.pct_validos[a], pb = bloco.pct_validos[b];
  if (pa === null || pb === null || pa === undefined || pb === undefined) return null;
  return arredonda(Math.abs(pa - pb));
}

/** Índice da classe com limite inferior incluso (HANDOFF §4.1: v >= corte sobe de classe). */
export function classe(valor, cortes) {
  let i = 0;
  while (i < cortes.length && valor >= cortes[i]) i += 1;
  return i;
}

/** Brancos + nulos sobre o total de votos, recalculado dos inteiros (HANDOFF §6). */
export function pctBrancosNulos(bloco) {
  return bloco.total_votos ? arredonda(((bloco.brancos + bloco.nulos) / bloco.total_votos) * 100) : null;
}

/** % de válidos sobre o total de votos (tabela de participação). */
export function pctValidos(bloco) {
  return bloco.total_votos ? arredonda((bloco.validos / bloco.total_votos) * 100) : null;
}

/** Eleitores das seções não instaladas: aptos − comparecimento − abstenção (nota A do contrato). */
export function naoInstalados(bloco) {
  return bloco.aptos - bloco.comparecimento - bloco.abstencao;
}
