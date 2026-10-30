/* Bloco "Capitais × não capitais" (Fase D2), abaixo do mapa do Brasil. Só municípios brasileiros.
   Tudo vem dos agregados do pipeline (somas de inteiros, taxas recalculadas); o front só conta as capitais
   vencidas, por votos inteiros. Sem cor de bom/ruim: só as cores fixas dos candidatos. */

import { slot, esc, corCand, corCandClaro, candidato, kpi } from '../comum.js';
import { pct, pctCandidato, inteiro, decimal, difPP } from '../formato.js';
import { resultado } from '../regras.js';

const ESCALA_MAX = 60;   // como na Comparação: eixo 0–60%, marca de 50% em 83,33%

/** Quantas das 27 capitais cada candidato venceu no turno (empate por votos inteiros conta à parte). */
export function capitaisVencidas(ufs, turno, ordem) {
  const conta = { empate: 0 };
  for (const u of ufs) {
    if (!u.recortes) continue;
    const r = resultado(u.recortes.capital.turnos[turno].votos, ordem[turno]);
    if (r.tipo === 'empate') conta.empate += 1;
    else if (r.tipo === 'vencedor') conta[r.nr] = (conta[r.nr] || 0) + 1;
  }
  return conta;
}

export function renderRecortes({ meta, nacional, ufs }) {
  const rc = nacional.recortes;
  const O = meta.ordem_candidatos;
  const finalistas = O['2'];
  const aptosCap = rc.capitais.turnos['1'].aptos;
  const aptosBR = aptosCap + rc.nao_capitais.turnos['1'].aptos;
  const w = (p) => `${(Math.max(0, p ?? 0) / ESCALA_MAX) * 100}%`;

  const coluna = (t) => {
    const cap = rc.capitais.turnos[t], nc = rc.nao_capitais.turnos[t];
    const linhaCand = (nr, nome, cor, corClara, pc, pn, vc, vn) => `<div class="rc-cand">
      <div class="cand"><i style="background:${cor}"></i><b>${esc(nome)}</b></div>
      <div class="barras" role="img" aria-label="${esc(nome)}: ${pc} nas capitais, ${pn} fora delas">
        <div style="width:${w(vc)};background:${cor}"></div><div style="width:${w(vn)};background:${corClara}"></div></div>
      <div class="rc-valores num"><span><b>${pc}</b> capitais</span><span>${pn} não capitais</span>
        <span class="rc-dif">${difPP(vn, vc)}</span></div></div>`;
    let h = finalistas.map((nr) => linhaCand(nr, candidato(meta, nr).nome_urna, corCand(nr), corCandClaro(nr),
      pctCandidato(cap.votos[nr], cap.pct_validos[nr]), pctCandidato(nc.votos[nr], nc.pct_validos[nr]),
      cap.pct_validos[nr], nc.pct_validos[nr])).join('');
    if (t === '1') {
      const outros = Object.keys(cap.votos).filter((nr) => !finalistas.includes(nr));
      const soma = (b) => outros.reduce((s, nr) => s + b.votos[nr], 0);
      const pc = (soma(cap) / cap.validos) * 100, pn = (soma(nc) / nc.validos) * 100;
      h += linhaCand('demais', `Demais ${outros.length} candidatos`, 'var(--cand-demais)', 'var(--cand-demais)',
        `${decimal(pc)}%`, `${decimal(pn)}%`, pc, pn);
    }
    const venc = capitaisVencidas(ufs, t, O);
    const placar = finalistas.map((nr) => `<span class="rc-placar"><i style="background:${corCand(nr)}"></i>${esc(candidato(meta, nr).nome_urna)} <b class="num">${venc[nr] || 0}</b></span>`).join('')
      + (venc.empate ? `<span class="rc-placar">empate <b class="num">${venc.empate}</b></span>` : '');
    return `<div class="rc-coluna">
      <h4 class="rotulo">${t}º turno · % dos votos válidos</h4>
      ${h}
      <div class="kpis kpis--rc">
        ${kpi('Capitais vencidas', `<span class="rc-placares">${placar}</span>`, `das 27 capitais, por votos inteiros${venc.empate ? '' : '; nenhum empate'}`)}
        ${kpi('Comparecimento', `${decimal(cap.taxa_comparecimento)}%<small>não capitais ${decimal(nc.taxa_comparecimento)}%</small>`, `capitais ${difPP(nc.taxa_comparecimento, cap.taxa_comparecimento)} em relação às não capitais`)}
        ${kpi('Abstenção', `${decimal(cap.taxa_abstencao)}%<small>não capitais ${decimal(nc.taxa_abstencao)}%</small>`, `capitais ${difPP(nc.taxa_abstencao, cap.taxa_abstencao)} em relação às não capitais`)}
      </div></div>`;
  };

  slot('mRecortesBloco').innerHTML = `
    <div class="secao__cab secao__cab--leve">
      <h3 id="h-recortes" class="subtitulo">Capitais × não capitais <small>só municípios brasileiros; o exterior fica fora</small></h3>
      <p class="linha-fina">As 27 capitais (26 capitais estaduais e Brasília) têm ${inteiro(aptosCap)} eleitores aptos,
        ${pct(Math.round((aptosCap / aptosBR) * 10000) / 100)} do eleitorado do Brasil. Os outros ${inteiro(rc.nao_capitais.n_municipios)} municípios têm ${inteiro(aptosBR - aptosCap)}.</p>
      <div class="legenda-turnos" aria-hidden="true"><span><i class="amostra amostra--cheia"></i>capitais (barra cheia)</span><span><i class="amostra amostra--clara"></i>não capitais (barra clara)</span></div>
    </div>
    <div class="rc-colunas">${coluna('1')}${coluna('2')}</div>
    <p class="notas">Percentuais de candidato sobre os votos válidos de cada grupo; comparecimento e abstenção sobre comparecimento + abstenção. Todos calculados a partir da soma dos votos e eleitores do grupo, nunca como média de taxas. A diferença em p.p. é capitais menos não capitais.</p>`;
}
