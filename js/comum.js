/* Utilidades de DOM e componentes compartilhados entre seções. */

import { pct, decimal, razaoPct } from './formato.js';

export const slot = (nome) => document.querySelector(`[data-slot="${nome}"]`);

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const tok = (nome) => `var(--${nome})`;

/** Cor fixa por número de candidato (checklist: LULA sempre --cand-13, FLAVIO sempre --cand-22). */
export const corCand = (nr) => (nr === '13' || nr === '22' ? tok(`cand-${nr}`) : tok('cand-demais'));
export const corCandClaro = (nr) => (nr === '13' || nr === '22' ? tok(`cand-${nr}-claro`) : tok('cand-demais'));

/** Controle segmentado (HANDOFF §3): botões com aria-pressed. Monta os botões uma vez; o clique só troca
    aria-pressed, para o botão escolhido continuar com o foco do teclado. `desabilitados`: ids com aria-disabled. */
export function segmentado(alvo, opcoes, atual, aoEscolher, desabilitados = []) {
  alvo.innerHTML = opcoes.map(([id, rot]) =>
    `<button type="button" data-id="${esc(id)}" aria-pressed="${id === atual}"${desabilitados.includes(id) ? ' aria-disabled="true"' : ''}>${esc(rot)}</button>`).join('');
  alvo.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-disabled') === 'true') return;
    marcaPressionado(alvo, b.dataset.id);
    aoEscolher(b.dataset.id);
  };
}

/** Sincroniza aria-pressed (e aria-disabled) de um grupo de botões sem recriá-los. */
export function marcaPressionado(alvo, atual, desabilitados) {
  for (const x of alvo.querySelectorAll('button')) {
    x.setAttribute('aria-pressed', String(x.dataset.id === atual));
    if (desabilitados) {
      if (desabilitados.includes(x.dataset.id)) x.setAttribute('aria-disabled', 'true');
      else x.removeAttribute('aria-disabled');
    }
  }
}

const DADOS = 'dados/';
const cacheJSON = new Map();
/** Lê um JSON de dados/ (com cache; uma falha não fica em cache, para o "Tentar de novo" funcionar). */
export function lerJSON(caminho) {
  if (!cacheJSON.has(caminho)) {
    const p = fetch(DADOS + caminho).then((r) => {
      if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cacheJSON.delete(caminho));
    cacheJSON.set(caminho, p);
  }
  return cacheJSON.get(caminho);
}

/** Barra de composição (HANDOFF §3): válidos / brancos / nulos / abstenção, sobre comparecimento + abstenção. */
export function composicao(t, rotulo) {
  const den = t.comparecimento + t.abstencao;
  const p = (x) => razaoPct(x, den);
  const w = (x) => `${((x / den) * 100).toFixed(4)}%`;
  const partes = [
    ['Válidos', t.validos, 'cat-validos'], ['Brancos', t.brancos, 'cat-brancos'],
    ['Nulos', t.nulos, 'cat-nulos'], ['Abstenção', t.abstencao, 'hachura-abst'],
  ];
  const resumo = partes.map(([n, x]) => `${n} ${pct(p(x))}`).join(', ');
  return `<div class="composicao">
    <b>${esc(rotulo)}</b>
    <div class="composicao__barra num" role="img" aria-label="${esc(rotulo)}: ${esc(resumo)}">
      <div class="cat-validos" style="width:${w(t.validos)}"><span class="rot-dentro">Válidos ${decimal(p(t.validos))}%</span></div>
      <div class="cat-brancos" style="width:${w(t.brancos)}"></div>
      <div class="cat-nulos" style="width:${w(t.nulos)}"></div>
      <div class="hachura-abst"><span class="rot-dentro">Abstenção ${decimal(p(t.abstencao))}%</span></div>
    </div>
    <div class="composicao__legenda num" aria-hidden="true">${partes.map(([n, x, c]) =>
      `<span><i class="${c}"></i>${n} ${pct(p(x))}</span>`).join('')}</div>
  </div>`;
}

/** KPI (HANDOFF §3): rótulo caixa alta, número grande, linha de variação; sem cor de bom/ruim. */
export const kpi = (rotulo, valor, variacao) =>
  `<div class="kpi"><span class="rotulo">${rotulo}</span><span class="kpi__valor">${valor}</span><span class="kpi__var num">${variacao}</span></div>`;

/** Nota dos nulos técnicos, com o número tirado de meta.definicoes.nulos. */
export function notaNulosTecnicos(meta) {
  const m = /(\d{1,3}(?:\.\d{3})+) votos/.exec(meta.definicoes.nulos);
  return `Os nulos do 1º turno incluem ${m ? m[1] : 'os'} nulos técnicos: votos no candidato nº 28 (Leonardo Alves de Araujo), cuja candidatura terminou em renúncia.`;
}

export const candidato = (meta, nr) => meta.candidatos.find((c) => c.nr === nr);
