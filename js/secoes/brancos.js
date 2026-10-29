/* 3 · Brancos e nulos (HANDOFF §3 e §6). Percentuais sobre o total de votos. */

import { slot, esc, kpi, composicao, notaNulosTecnicos } from '../comum.js';
import { pct, decimal, inteiro, difPP, variacaoInteiro } from '../formato.js';
import { pctBrancosNulos } from '../regras.js';

const EIXO_MAX = 5;   // vista ampliada: 0–5% do total de votos

export function renderBrancos({ meta, nacional }) {
  const t1 = nacional.turnos['1'], t2 = nacional.turnos['2'];
  const bn1 = pctBrancosNulos(t1), bn2 = pctBrancosNulos(t2);
  const s1 = t1.brancos + t1.nulos, s2 = t2.brancos + t2.nulos;

  slot('bnTitulo').textContent = `No 2º turno, ${decimal(bn2)}% dos votos não foram para nenhum candidato`;
  const menos = s1 - s2, maisVotantes = t2.comparecimento - t1.comparecimento;
  slot('bnFina').textContent = `Eram ${decimal(bn1)}% no 1º turno. Foram ${inteiro(Math.abs(menos))} brancos e nulos ${menos >= 0 ? 'a menos' : 'a mais'}`
    + (maisVotantes > 0 ? `, mesmo com ${inteiro(maisVotantes)} eleitores a mais votando.` : '.');

  const k = (rot, p1, p2, v1, v2) => kpi(rot, `${decimal(p2)}%<small>era ${decimal(p1)}%</small>`,
    `${inteiro(v2)} votos · ${variacaoInteiro(v2 - v1)} · ${difPP(p1, p2)}`);
  slot('bnKpis').innerHTML = k('Brancos', t1.pct_brancos, t2.pct_brancos, t1.brancos, t2.brancos)
    + k('Nulos', t1.pct_nulos, t2.pct_nulos, t1.nulos, t2.nulos)
    + k('Brancos + nulos', bn1, bn2, s1, s2);

  const w = (p) => `${(p / EIXO_MAX) * 100}%`;
  const linha = (rot, p1, p2, v1, v2) => `<div class="linha"><b>${rot}</b>
    <div class="bn-barras" role="img" aria-label="${esc(rot.replace('¹', ''))}: ${pct(p1)} no 1º turno, ${pct(p2)} no 2º turno">
      <span class="trilho"><i class="t1" style="width:${w(p1)}"></i></span><span class="num">${pct(p1)} · ${inteiro(v1)}</span>
      <span class="trilho"><i class="t2" style="width:${w(p2)}"></i></span><span class="num"><b>${pct(p2)} · ${inteiro(v2)}</b></span></div>
    <div class="cel-var num"><b>${difPP(p1, p2)}</b><span>${variacaoInteiro(v2 - v1)} votos</span></div></div>`;
  slot('bnZoom').innerHTML = `<div class="linha linha--cab"><span class="rotulo">% do total de votos</span>
      <span class="rotulo eixo">${[0, 1, 2, 3, 4, 5].map((x) => `<span>${x}%</span>`).join('')}</span><span></span>
      <span class="rotulo cel-dir">Variação</span></div>`
    + linha('Brancos', t1.pct_brancos, t2.pct_brancos, t1.brancos, t2.brancos)
    + linha('Nulos¹', t1.pct_nulos, t2.pct_nulos, t1.nulos, t2.nulos)
    + linha('Brancos + nulos', bn1, bn2, s1, s2);

  slot('bnComposicao').innerHTML = composicao(t1, '1º turno') + composicao(t2, '2º turno');
  slot('bnNotas').innerHTML =
    `<p>Percentuais sobre o total de votos (válidos + brancos + nulos, igual ao comparecimento), como no relatório do TSE.</p>
     <p>¹ ${esc(notaNulosTecnicos(meta))}</p>`;
}
