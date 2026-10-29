/* Ponto de entrada. Carga imediata (HANDOFF §1): meta, nacional e uf. Mapas e exterior carregam sob demanda. */

import { slot, esc } from './comum.js';
import { iniciarNav } from './nav.js';
import { renderResultado } from './secoes/resultado.js';
import { renderComparacao } from './secoes/comparacao.js';
import { renderBrancos } from './secoes/brancos.js';
import { renderSobre, renderRodape } from './secoes/sobre.js';

const DADOS = 'dados/';

export async function lerJSON(caminho) {
  const r = await fetch(DADOS + caminho);
  if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
  return r.json();
}

async function carregar() {
  const carga = slot('carga');
  carga.hidden = false;
  carga.innerHTML = '<div class="leitura"><p class="carregando">Carregando os dados…</p></div>';
  try {
    const [meta, nacional, uf] = await Promise.all([lerJSON('meta.json'), lerJSON('nacional.json'), lerJSON('uf.json')]);
    const dados = { meta, nacional, ufs: uf.ufs };
    renderResultado(dados);
    renderComparacao(dados);
    renderBrancos(dados);
    renderSobre(dados);
    renderRodape(dados);
    carga.hidden = true;
    document.body.dataset.pronto = 'true';
  } catch (err) {
    carga.innerHTML = `<div class="leitura"><div class="erro" role="alert">
      <p>Não foi possível carregar os dados (${esc(err.message)}). Verifique a conexão e tente de novo.</p>
      <button type="button" class="botao">Tentar de novo</button></div></div>`;
    carga.querySelector('button').onclick = carregar;
  }
}

iniciarNav();
carregar();
