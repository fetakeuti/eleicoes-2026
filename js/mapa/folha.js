/* Folha inferior do mobile (HANDOFF §3): substitui hover e tooltip abaixo de 768 px.
   Raio 16 no topo, alça 40 × 4. Abre em meia altura; arrastar a alça para cima = tela cheia com rolagem;
   para baixo = volta à meia altura ou fecha. Esc e o botão Fechar também fecham.
   O mapa rola para a área tocada ficar acima da folha. */

let n = 0;

export const ehMobile = () => matchMedia('(max-width: 767px)').matches;

export function criaFolha({ rotulo, aoFechar = () => {} }) {
  const id = `folha-${++n}`;
  const el = document.createElement('div');
  el.className = 'folha';
  el.id = id;
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-label', rotulo);
  el.innerHTML = `<button type="button" class="folha__alca" aria-label="Expandir a folha"><span aria-hidden="true"></span></button>
    <button type="button" class="folha__fechar" aria-label="Fechar">×</button>
    <div class="folha__corpo" tabindex="-1"></div>`;
  document.body.appendChild(el);
  const corpo = el.querySelector('.folha__corpo');
  const alca = el.querySelector('.folha__alca');
  let quemAbriu = null;

  const estado = (s) => {
    el.dataset.estado = s;
    alca.setAttribute('aria-label', s === 'cheia' ? 'Recolher a folha' : 'Expandir a folha');
  };
  const fecha = () => {
    if (el.hidden) return;
    el.hidden = true;
    document.body.classList.remove('com-folha');
    aoFechar();
    if (quemAbriu && document.contains(quemAbriu) && quemAbriu.matches(':focus-visible, button, a')) quemAbriu.focus({ preventScroll: true });
  };

  el.querySelector('.folha__fechar').addEventListener('click', fecha);
  alca.addEventListener('click', () => estado(el.dataset.estado === 'cheia' ? 'meia' : 'cheia'));
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); fecha(); } });

  // arrastar pela alça
  let y0 = null;
  alca.addEventListener('pointerdown', (e) => { y0 = e.clientY; alca.setPointerCapture(e.pointerId); });
  alca.addEventListener('pointerup', (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    y0 = null;
    if (dy < -40) estado('cheia');
    else if (dy > 60) { if (el.dataset.estado === 'cheia') estado('meia'); else fecha(); }
  });

  return {
    el,
    corpo,
    get aberta() { return !el.hidden; },
    /** Abre (ou atualiza) a folha com o conteúdo; `forma` é o elemento tocado, que deve ficar acima da folha. */
    abre(html, forma) {
      if (el.hidden) quemAbriu = document.activeElement;
      corpo.innerHTML = html;
      if (el.hidden) estado('meia');
      el.hidden = false;
      document.body.classList.add('com-folha');
      corpo.focus({ preventScroll: true });
      if (forma) {
        const r = forma.getBoundingClientRect();
        const limite = window.innerHeight - el.getBoundingClientRect().height - 16;
        const barra = document.querySelector('.barra')?.offsetHeight || 0;
        if (r.top + r.height / 2 > limite) window.scrollBy({ top: r.top + r.height / 2 - limite, behavior: 'instant' });
        else if (r.top < barra) window.scrollBy({ top: r.top - barra - 16, behavior: 'instant' });
      }
    },
    fecha,
  };
}

/** Aba "Mapa | Lista" do mobile: alterna entre o mapa (com a legenda) e a lista, dentro do mesmo layout. */
export function criaAbas(layout, aoTrocar = () => {}) {
  const abas = document.createElement('div');
  abas.className = 'abas-mapa segmentado';
  abas.setAttribute('role', 'group');
  abas.setAttribute('aria-label', 'Ver como mapa ou como lista');
  abas.innerHTML = '<button type="button" data-aba="mapa" aria-pressed="true">Mapa</button><button type="button" data-aba="lista" aria-pressed="false">Lista</button>';
  layout.before(abas);
  layout.dataset.aba = 'mapa';
  abas.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.getAttribute('aria-pressed') === 'true') return;
    for (const x of abas.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    layout.dataset.aba = b.dataset.aba;
    aoTrocar(b.dataset.aba);
  });
  return abas;
}
