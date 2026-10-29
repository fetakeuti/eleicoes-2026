/* 1 · Comparação 1º × 2º turno (HANDOFF §3 e §6). */

import { slot, esc, corCand, corCandClaro, segmentado, composicao, notaNulosTecnicos, candidato } from '../comum.js';
import { pct, pctCandidato, inteiro, difPP, variacaoInteiro, votos as fVotos } from '../formato.js';
import { pctValidos, resultado } from '../regras.js';

const ESCALA_MAX = 60;   // eixo 0–60%; a marca de 50% fica em 83,33%
const estado = { unidade: 'pp', eliminados: false };

export function renderComparacao(dados) {
  const { meta, nacional } = dados;
  const t1 = nacional.turnos['1'], t2 = nacional.turnos['2'];
  const pp = estado.unidade === 'pp';
  const rerender = () => renderComparacao(dados);

  // Título a partir do dado: liderança mudou? abstenção caiu?
  const l1 = resultado(t1.votos, meta.ordem_candidatos['1']), l2 = resultado(t2.votos, meta.ordem_candidatos['2']);
  const mudou = l1.tipo === 'vencedor' && l2.tipo === 'vencedor' && l1.nr !== l2.nr;
  const caiu = t2.taxa_abstencao < t1.taxa_abstencao;
  slot('compTitulo').textContent = `Do 1º para o 2º turno, ${mudou ? 'a liderança mudou de lado' : 'a liderança se manteve'} e a abstenção ${caiu ? 'caiu' : 'subiu'}`;

  segmentado(slot('unidade'), [['pp', 'Pontos percentuais'], ['votos', 'Votos']], estado.unidade,
    (id) => { estado.unidade = id; rerender(); });

  // ---- candidatos
  const finalistas = meta.ordem_candidatos['2'];
  const eliminados = meta.ordem_candidatos['1'].filter((nr) => !finalistas.includes(nr));
  const w = (p) => `${(Math.max(0, p) / ESCALA_MAX) * 100}%`;
  let h = `<div class="linha linha--cab" aria-hidden="true"><span class="rotulo">Candidato</span>
    <span class="rotulo eixo"><span>0%</span><span>25%</span><span>50%</span><span></span></span>
    <span class="rotulo cel-dir">1º turno</span><span class="rotulo cel-dir">2º turno</span><span class="rotulo cel-dir">Variação</span></div>`;
  for (const nr of finalistas) {
    const c = candidato(meta, nr);
    const p1 = t1.pct_validos[nr], p2 = t2.pct_validos[nr], v1 = t1.votos[nr], v2 = t2.votos[nr];
    const varPrin = pp ? difPP(p1, p2) : variacaoInteiro(v2 - v1);
    const varSec = pp ? `${variacaoInteiro(v2 - v1)} votos` : difPP(p1, p2);
    h += `<div class="linha">
      <div class="cand"><i style="background:${corCand(nr)}"></i><div><b>${esc(c.nome_urna)}</b><span>${nr} · ${esc(c.partido)} · ${esc(c.situacao_2t || c.situacao_1t)}</span></div></div>
      <div class="barras" role="img" aria-label="${esc(c.nome_urna)}: ${pct(p1)} no 1º turno, ${pct(p2)} no 2º turno">
        <div style="width:${w(p1)};background:${corCandClaro(nr)}"></div><div style="width:${w(p2)};background:${corCand(nr)}"></div></div>
      <div class="cel-dir cel-num num"><b>${pctCandidato(v1, p1)}</b><span>${fVotos(v1)}</span></div>
      <div class="cel-dir cel-num num"><b>${pctCandidato(v2, p2)}</b><span>${fVotos(v2)}</span></div>
      <div class="cel-var num"><b>${varPrin}</b><span>${varSec}</span></div></div>`;
  }
  const somaElim = eliminados.reduce((s, nr) => s + t1.votos[nr], 0);
  h += `<button type="button" class="alternar" aria-expanded="${estado.eliminados}" aria-controls="lista-eliminados">
      <span><span class="alternar__seta" aria-hidden="true">›</span>${estado.eliminados ? 'Ocultar' : 'Mostrar'} os ${eliminados.length} candidatos eliminados no 1º turno</span>
      <span class="num">juntos: ${fVotos(somaElim)} · ${pct(Math.round((somaElim / t1.validos) * 10000) / 100)} dos válidos</span></button>
    <div id="lista-eliminados"${estado.eliminados ? '' : ' hidden'}>`;
  for (const nr of eliminados) {
    const c = candidato(meta, nr);
    h += `<div class="linha linha--elim">
      <div class="cand"><i style="background:${corCand(nr)}"></i><div><b>${esc(c.nome_urna)}</b><span>${nr} · ${esc(c.partido)}</span></div></div>
      <div class="barras barras--elim" aria-hidden="true"><div style="width:${w(t1.pct_validos[nr])}"></div></div>
      <div class="cel-dir cel-num num"><b>${pctCandidato(t1.votos[nr], t1.pct_validos[nr])}</b><span>${fVotos(t1.votos[nr])}</span></div>
      <div class="cel-dir nao-disputou">não disputou</div><div class="cel-dir nao-disputou">—</div></div>`;
  }
  h += '</div>';
  const tab = slot('candidatos');
  tab.innerHTML = h;
  tab.querySelector('.alternar').onclick = () => {
    estado.eliminados = !estado.eliminados;
    rerender();
    slot('candidatos').querySelector('.alternar').focus();
  };

  // ---- participação
  const linha = (nome, base, x1, x2, r1, r2) => {
    const fixo = r1 === undefined;
    const prin = fixo ? variacaoInteiro(x2 - x1) : pp ? difPP(r1, r2) : variacaoInteiro(x2 - x1);
    const sec = fixo ? 'eleitores' : pp ? `${variacaoInteiro(x2 - x1)}` : difPP(r1, r2);
    return `<div class="linha"><div><b>${nome}</b><br><span class="base">${base}</span></div>
      <div class="cel-dir cel-num num"><b>${inteiro(x1)}</b><span>${fixo ? 'eleitores' : pct(r1)}</span></div>
      <div class="cel-dir cel-num num"><b>${inteiro(x2)}</b><span>${fixo ? 'eleitores' : pct(r2)}</span></div>
      <div class="cel-var num"><b>${prin}</b><span>${sec}</span></div></div>`;
  };
  slot('participacao').innerHTML =
    `<div class="linha linha--cab"><span class="rotulo">Métrica</span><span class="rotulo cel-dir">1º turno</span>
     <span class="rotulo cel-dir">2º turno</span><span class="rotulo cel-dir">Variação</span></div>` +
    linha('Eleitorado apto', 'soma dos arquivos do TSE (ver rodapé)', t1.aptos, t2.aptos) +
    linha('Comparecimento', '% de comparecimento + abstenção', t1.comparecimento, t2.comparecimento, t1.taxa_comparecimento, t2.taxa_comparecimento) +
    linha('Abstenção', '% de comparecimento + abstenção', t1.abstencao, t2.abstencao, t1.taxa_abstencao, t2.taxa_abstencao) +
    linha('Votos válidos', '% do total de votos', t1.validos, t2.validos, pctValidos(t1), pctValidos(t2)) +
    linha('Brancos', '% do total de votos', t1.brancos, t2.brancos, t1.pct_brancos, t2.pct_brancos) +
    linha('Nulos', '% do total de votos · inclui nulos técnicos no 1º turno', t1.nulos, t2.nulos, t1.pct_nulos, t2.pct_nulos);

  slot('composicao').innerHTML = composicao(t1, '1º turno') + composicao(t2, '2º turno');
  slot('notasComp').innerHTML =
    `<p>Percentual de candidato: sobre votos válidos. Brancos e nulos: sobre o total de votos. Comparecimento e abstenção: sobre comparecimento + abstenção, como no relatório do TSE.</p>
     <p>${esc(notaNulosTecnicos(meta))}</p>`;
}
