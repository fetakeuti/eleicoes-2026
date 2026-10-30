/* Lista navegável dos mapas (ranking do Brasil, lista de países): cada linha é um <button data-chave>.
   Tab entra e sai da lista numa parada só (tabindex itinerante); ↑/↓/Home/End movem o foco; o foco equivale
   ao hover (destaca no mapa); Enter/espaço/clique equivalem ao clique no mapa.
   focusin/focusout só funcionam via addEventListener (não existe a propriedade onfocusin). */

export function ligaLista(lista, { aoHover, aoEscolher }) {
  const chaveDe = (e) => e.target.closest('button')?.dataset.chave ?? null;
  lista.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch') aoHover(chaveDe(e), e.target); });
  lista.addEventListener('pointerleave', () => aoHover(null));
  lista.addEventListener('focusin', (e) => {
    for (const b of lista.querySelectorAll('button[tabindex="0"]')) if (b !== e.target) b.setAttribute('tabindex', '-1');
    e.target.setAttribute('tabindex', '0');
    aoHover(chaveDe(e), e.target);
  });
  lista.addEventListener('focusout', (e) => { if (!lista.contains(e.relatedTarget)) aoHover(null); });
  lista.addEventListener('keydown', (e) => {
    const botoes = [...lista.querySelectorAll('button')];
    const i = botoes.indexOf(document.activeElement);
    const destino = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: botoes.length - 1 }[e.key];
    if (destino === undefined || i < 0) return;
    e.preventDefault();
    botoes[Math.max(0, Math.min(botoes.length - 1, destino))].focus();
  });
  lista.addEventListener('click', (e) => { const c = chaveDe(e); if (c !== null) aoEscolher(c); });
}

/**
 * Redesenha as linhas preservando o foco: se o foco estava numa linha, volta para a mesma chave.
 * `linhas` = [{ chave, html, rotulo }]; `chaveTab` = a linha que recebe o Tab (a selecionada, ou a 1ª).
 */
export function desenhaLista(lista, linhas, chaveTab) {
  const focoAntes = lista.contains(document.activeElement) ? document.activeElement.dataset.chave : null;
  const alvo = String(focoAntes ?? chaveTab ?? linhas[0]?.chave ?? '');
  lista.innerHTML = linhas.map((l) =>
    `<button type="button" data-chave="${l.chave}" tabindex="${String(l.chave) === alvo ? 0 : -1}" aria-label="${l.rotulo}">${l.html}</button>`).join('');
  if (!lista.querySelector('[tabindex="0"]')) lista.querySelector('button')?.setAttribute('tabindex', '0');
  if (focoAntes !== null) lista.querySelector(`[data-chave="${focoAntes}"]`)?.focus({ preventScroll: true });
}

/** Chave do elemento com foco de teclado dentro de um dos contêineres (o mouse saindo não apaga o foco). */
export function chaveEmFoco(...conteineres) {
  const a = document.activeElement;
  if (!a || !conteineres.some((c) => c.contains(a))) return null;
  return a.closest('[data-chave]')?.dataset.chave ?? null;
}
