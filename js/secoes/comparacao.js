/* 1 · Comparação 1º × 2º turno (HANDOFF §3 e §6).
   A seção é montada uma vez. Os controles só atualizam o que mudam: a unidade reescreve as células de
   variação; o botão dos eliminados alterna `hidden`/`aria-expanded`. Assim o estado de um controle nunca
   é perdido por causa de outro, e o foco do teclado fica onde estava. */

import { slot, esc, corCand, corCandClaro, segmentado, composicao, notaNulosTecnicos, candidato } from '../comum.js';
import { pct, pctCandidato, inteiro, difPP, variacaoInteiro, votos as fVotos } from '../formato.js';
import { pctValidos, resultado } from '../regras.js';

const ESCALA_MAX = 60;   // eixo 0–60%; a marca de 50% fica em 83,33%
export const estado = { unidade: 'pp', eliminados: false };

/** Conteúdo da célula de variação: [principal, secundária] conforme a unidade. */
function variacao(v, pp) {
  if (v.fixo) return [variacaoInteiro(v.x2 - v.x1), v.rotuloFixo];
  const votos = variacaoInteiro(v.x2 - v.x1) + (v.sufixoVotos || '');
  return pp ? [difPP(v.r1, v.r2), votos] : [variacaoInteiro(v.x2 - v.x1), difPP(v.r1, v.r2)];
}

const celVar = (v) => {
  const [a, b] = variacao(v, estado.unidade === 'pp');
  return `<b>${a}</b><span>${b}</span>`;
};

export function renderComparacao({ meta, nacional }) {
  const t1 = nacional.turnos['1'], t2 = nacional.turnos['2'];
  const variacoes = [];   // { el, ...valores } — o que muda com a unidade
  const reg = (v) => { variacoes.push(v); return `data-var="${variacoes.length - 1}"`; };

  // Título a partir do dado: liderança mudou? abstenção caiu?
  const l1 = resultado(t1.votos, meta.ordem_candidatos['1']), l2 = resultado(t2.votos, meta.ordem_candidatos['2']);
  const mudou = l1.tipo === 'vencedor' && l2.tipo === 'vencedor' && l1.nr !== l2.nr;
  const caiu = t2.taxa_abstencao < t1.taxa_abstencao;
  slot('compTitulo').textContent = `Do 1º para o 2º turno, ${mudou ? 'a liderança mudou de lado' : 'a liderança se manteve'} e a abstenção ${caiu ? 'caiu' : 'subiu'}`;

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
    h += `<div class="linha">
      <div class="cand"><i style="background:${corCand(nr)}"></i><div><b>${esc(c.nome_urna)}</b><span>${nr} · ${esc(c.partido)} · ${esc(c.situacao_2t || c.situacao_1t)}</span></div></div>
      <div class="barras" role="img" aria-label="${esc(c.nome_urna)}: ${pct(p1)} no 1º turno, ${pct(p2)} no 2º turno">
        <div style="width:${w(p1)};background:${corCandClaro(nr)}"></div><div style="width:${w(p2)};background:${corCand(nr)}"></div></div>
      <div class="cel-dir cel-num num"><b>${pctCandidato(v1, p1)}</b><span>${fVotos(v1)}</span></div>
      <div class="cel-dir cel-num num"><b>${pctCandidato(v2, p2)}</b><span>${fVotos(v2)}</span></div>
      <div class="cel-var num" ${reg({ x1: v1, x2: v2, r1: p1, r2: p2, sufixoVotos: ' votos' })}></div></div>`;
  }
  const somaElim = eliminados.reduce((s, nr) => s + t1.votos[nr], 0);
  h += `<button type="button" class="alternar" aria-expanded="false" aria-controls="lista-eliminados">
      <span><span class="alternar__seta" aria-hidden="true">›</span><span class="alternar__acao">Mostrar</span> os ${eliminados.length} candidatos eliminados no 1º turno</span>
      <span class="num">juntos: ${fVotos(somaElim)} · ${pct(Math.round((somaElim / t1.validos) * 10000) / 100)} dos válidos</span></button>
    <div id="lista-eliminados" hidden>`;
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
  const botao = tab.querySelector('.alternar');
  botao.onclick = () => mostrarEliminados(!estado.eliminados);

  // ---- participação
  const linha = (nome, base, x1, x2, r1, r2) => {
    const fixo = r1 === undefined;
    return `<div class="linha"><div><b>${nome}</b><br><span class="base">${base}</span></div>
      <div class="cel-dir cel-num num"><b>${inteiro(x1)}</b><span>${fixo ? 'eleitores' : pct(r1)}</span></div>
      <div class="cel-dir cel-num num"><b>${inteiro(x2)}</b><span>${fixo ? 'eleitores' : pct(r2)}</span></div>
      <div class="cel-var num" ${reg({ fixo, x1, x2, r1, r2, rotuloFixo: 'eleitores' })}></div></div>`;
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

  for (const el of document.querySelectorAll('#comparacao [data-var]')) variacoes[+el.dataset.var].el = el;
  const atualizaVariacoes = () => { for (const v of variacoes) v.el.innerHTML = celVar(v); };

  segmentado(slot('unidade'), [['pp', 'Pontos percentuais'], ['votos', 'Votos']], estado.unidade,
    (id) => { estado.unidade = id; atualizaVariacoes(); });
  atualizaVariacoes();
  mostrarEliminados(estado.eliminados);

  slot('composicao').innerHTML = composicao(t1, '1º turno') + composicao(t2, '2º turno');
  slot('notasComp').innerHTML =
    `<p>Percentual de candidato: sobre votos válidos. Brancos e nulos: sobre o total de votos. Comparecimento e abstenção: sobre comparecimento + abstenção, como no relatório do TSE.</p>
     <p>${esc(notaNulosTecnicos(meta))}</p>`;
}

/** Abre ou fecha a lista de eliminados sem redesenhar nada. */
function mostrarEliminados(aberto) {
  estado.eliminados = aberto;
  const tab = slot('candidatos');
  const botao = tab.querySelector('.alternar');
  botao.setAttribute('aria-expanded', String(aberto));
  botao.querySelector('.alternar__acao').textContent = aberto ? 'Ocultar' : 'Mostrar';
  tab.querySelector('#lista-eliminados').hidden = !aberto;
}
