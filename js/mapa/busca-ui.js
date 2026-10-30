/* Campo de busca de município (HANDOFF §3): input 44 px com label visível, sugestões a partir de 2 letras
   (até 6), role="listbox", setas + Enter, Esc fecha. O índice (municipio/indice.json) carrega no primeiro foco. */

import { esc, lerJSON } from '../comum.js';
import { inteiro } from '../formato.js';
import { preparaIndice, busca } from './busca.js';

let n = 0;

export function iniciarBusca(alvo, aoEscolher) {
  const id = `busca-${++n}`;
  alvo.innerHTML = `<label class="rotulo" for="${id}">Buscar município</label>
    <div class="busca">
      <input id="${id}" type="search" autocomplete="off" spellcheck="false" placeholder="Ex.: Xique-Xique"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-lista">
      <ul id="${id}-lista" class="busca__lista" role="listbox" aria-label="Municípios encontrados" hidden></ul>
      <p class="busca__vazio" role="status" aria-live="polite"></p>
    </div>`;
  const input = alvo.querySelector('input');
  const lista = alvo.querySelector('ul');
  const status = alvo.querySelector('.busca__vazio');
  let indice = null;
  let achados = [];
  let ativo = -1;

  const carrega = () => {
    if (!indice) {
      indice = lerJSON('municipio/indice.json').then((d) => preparaIndice(d.municipios));
      indice.catch(() => { indice = null; });
    }
    return indice;
  };
  const fecha = () => {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    ativo = -1;
  };
  const marca = (i) => {
    ativo = i;
    lista.querySelectorAll('[role="option"]').forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    if (i >= 0) input.setAttribute('aria-activedescendant', `${id}-op-${i}`);
    else input.removeAttribute('aria-activedescendant');
  };
  const escolhe = (i) => {
    const m = achados[i];
    if (!m) return;
    input.value = `${m.nome} (${m.uf})`;
    fecha();
    status.textContent = `${m.nome}, ${m.uf}, selecionado no mapa.`;
    aoEscolher(m);
  };
  const atualiza = async () => {
    const texto = input.value;
    status.textContent = '';
    if (texto.trim().length < 2) { fecha(); return; }
    let ind;
    try {
      ind = await carrega();
    } catch {
      status.textContent = 'Não foi possível carregar a lista de municípios. Tente de novo.';
      return;
    }
    if (input.value !== texto) return;   // o usuário continuou digitando
    achados = busca(ind, texto);
    if (!achados.length) {
      fecha();
      status.textContent = 'Nenhum município com esse nome. Confira a grafia ou tente só o começo do nome.';
      return;
    }
    lista.innerHTML = achados.map((m, i) => `<li id="${id}-op-${i}" role="option" aria-selected="false" data-i="${i}">
      <b>${esc(m.nome)}</b><span>${m.uf} · ${inteiro(m.aptos)} eleitores${m.nome_tse ? ` · no TSE: ${esc(m.nome_tse)}` : ''}</span></li>`).join('');
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    marca(-1);
  };

  input.addEventListener('focus', () => { carrega(); });
  input.addEventListener('input', atualiza);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && achados.length && !lista.hidden) { e.preventDefault(); marca((ativo + 1) % achados.length); }
    else if (e.key === 'ArrowUp' && achados.length && !lista.hidden) { e.preventDefault(); marca((ativo - 1 + achados.length) % achados.length); }
    else if (e.key === 'Enter' && !lista.hidden) { e.preventDefault(); escolhe(ativo >= 0 ? ativo : 0); }
    else if (e.key === 'Escape') { if (!lista.hidden) { e.preventDefault(); fecha(); } }
  });
  lista.addEventListener('pointerdown', (e) => e.preventDefault());   // não tira o foco do input antes do clique
  lista.addEventListener('click', (e) => { const li = e.target.closest('[role="option"]'); if (li) escolhe(+li.dataset.i); });
  input.addEventListener('blur', () => setTimeout(fecha, 120));
}
