/* 0 · Resultado (HANDOFF §6: manchete, barra, diferença em votos, KPIs). */

import { slot, esc, corCand, kpi, candidato } from '../comum.js';
import { pct, decimal, inteiro, difPP, nomeProprio } from '../formato.js';
import { resultado, pctBrancosNulos } from '../regras.js';

export function renderResultado({ meta, nacional }) {
  const t1 = nacional.turnos['1'], t2 = nacional.turnos['2'];
  const ordem2 = meta.ordem_candidatos['2'];
  const r2 = resultado(t2.votos, ordem2);
  const [a, b] = r2.tipo === 'vencedor' ? [r2.nr, r2.segundo] : ordem2;
  const ca = candidato(meta, a), cb = candidato(meta, b);
  const eleito = meta.candidatos.find((c) => c.situacao_2t === 'ELEITO');

  slot('manchete').textContent = eleito
    ? `${nomeProprio(eleito.nome_urna)} é eleito com ${pct(t2.pct_validos[eleito.nr])} dos votos válidos`
    : 'Resultado do 2º turno';

  // "No 1º turno a ordem foi a inversa": compara o líder de cada turno, por votos inteiros
  const r1 = resultado(t1.votos, meta.ordem_candidatos['1']);
  let primeiro = '';
  if (r1.tipo === 'vencedor' && r1.nr !== a) {
    const l1 = candidato(meta, r1.nr);
    primeiro = ` No 1º turno a ordem foi a inversa: ${esc(l1.nome_urna)} liderou com ${pct(t1.pct_validos[r1.nr])}, contra ${pct(t1.pct_validos[a])} de ${esc(ca.nome_urna)}.`;
  }
  slot('linhaFina').innerHTML =
    `${esc(ca.nome_urna)} (${esc(ca.partido)}) recebeu <span class="num">${inteiro(t2.votos[a])}</span> votos, ` +
    `<span class="num">${inteiro(t2.votos[a] - t2.votos[b])}</span> a mais que ${esc(cb.nome_urna)} (${esc(cb.partido)}), ` +
    `que teve <span class="num">${inteiro(t2.votos[b])}</span>.${primeiro}`;

  // Barra de resultado: duas cores fixas, gap 2px, marca de 50%, rótulos acima
  slot('barraResultado').innerHTML = `
    <div class="resultado-barra__rot">
      <span style="color:${corCand(a)}">${esc(ca.nome_urna)} · ${pct(t2.pct_validos[a])}</span>
      <span style="color:${corCand(b)}">${esc(cb.nome_urna)} · ${pct(t2.pct_validos[b])}</span>
    </div>
    <div class="resultado-barra__barra" role="img"
         aria-label="${esc(ca.nome_urna)} ${pct(t2.pct_validos[a])}, ${esc(cb.nome_urna)} ${pct(t2.pct_validos[b])} dos votos válidos">
      <div style="width:${t2.pct_validos[a]}%;background:${corCand(a)}"></div>
      <div style="flex:1;background:${corCand(b)}"></div>
    </div>
    <div class="resultado-barra__nota">marca: 50% dos válidos</div>`;

  const bn1 = pctBrancosNulos(t1), bn2 = pctBrancosNulos(t2);
  slot('kpisResultado').innerHTML =
    kpi('Comparecimento', pct(t2.taxa_comparecimento),
      `${difPP(t1.taxa_comparecimento, t2.taxa_comparecimento)} sobre o 1º turno`) +
    kpi('Abstenção', pct(t2.taxa_abstencao),
      `${difPP(t1.taxa_abstencao, t2.taxa_abstencao)} · ${inteiro(t2.abstencao)} eleitores`) +
    kpi('Brancos e nulos', `${decimal(bn2)}%`, `${difPP(bn1, bn2)} · sobre o total de votos`);
}
