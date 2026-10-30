/* Zoom dos mapas (HANDOFF §3 "Controles de zoom"): botões +, − e enquadrar (44 × 44) e pinça no toque.
   Regras para não sequestrar a rolagem da página:
   - roda do mouse só com Ctrl/⌘ (sem isso a página rola normalmente);
   - no toque, um dedo rola a página enquanto o mapa está enquadrado; dois dedos fazem pinça;
     depois de aproximar, um dedo arrasta o mapa (touch-action passa a "none"). */

/* global d3 */
import { esc } from '../comum.js';

export function criaZoom({ svg, g, largura, altura, kMax = 12, aoMudar = () => {}, aoTerminar = () => {}, rotulo = 'mapa' }) {
  let base = d3.zoomIdentity;          // enquadramento do nível atual (Brasil, UF ou mundo)
  let atual = d3.zoomIdentity;
  const aproximado = () => atual.k > base.k * 1.01;
  const sel = d3.select(svg);

  const zoom = d3.zoom()
    .scaleExtent([1, kMax])
    .translateExtent([[0, 0], [largura, altura]])
    .filter((e) => {
      if (e.type === 'wheel') return e.ctrlKey || e.metaKey;
      if (e.type === 'touchstart') return e.touches.length > 1 || aproximado();
      if (e.type === 'mousedown') return aproximado() && !e.button;
      return !e.button;
    })
    .on('zoom', (e) => {
      // só avisa quando a transformação muda de fato: o enquadramento inicial (identidade → identidade)
      // não pode esconder um tooltip que acabou de abrir
      const mudou = e.transform.k !== atual.k || e.transform.x !== atual.x || e.transform.y !== atual.y;
      if (!mudou) return;
      atual = e.transform;
      g.attr('transform', atual.toString());
      svg.style.touchAction = aproximado() ? 'none' : 'pan-x pan-y';
      svg.classList.toggle('mapa-svg--aproximado', aproximado());
      aoMudar(atual);
    })
    .on('end', () => aoTerminar(atual));
  sel.call(zoom).on('dblclick.zoom', null);
  svg.style.touchAction = 'pan-x pan-y';

  const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anima = (t, ms = 300) => sel.transition().duration(reduzido() ? 0 : ms).call(zoom.transform, t);

  // botões sobre o mapa
  const caixa = svg.parentElement;
  const botoes = document.createElement('div');
  botoes.className = 'zoom-botoes';
  botoes.setAttribute('role', 'group');
  botoes.setAttribute('aria-label', `Zoom do ${esc(rotulo)}`);
  botoes.innerHTML = `<button type="button" data-z="mais" aria-label="Aproximar o ${esc(rotulo)}">+</button>
    <button type="button" data-z="menos" aria-label="Afastar o ${esc(rotulo)}">−</button>
    <button type="button" data-z="enquadrar" aria-label="Enquadrar o ${esc(rotulo)}"><span aria-hidden="true">⤢</span></button>`;
  caixa.appendChild(botoes);
  botoes.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.z === 'enquadrar') anima(base);
    else sel.transition().duration(reduzido() ? 0 : 250).call(zoom.scaleBy, b.dataset.z === 'mais' ? 1.6 : 1 / 1.6, [largura / 2, altura / 2]);
  });

  return {
    /** Define o enquadramento do nível (e vai até ele). */
    enquadra(t, ms = 450) {
      base = t;
      zoom.scaleExtent([Math.min(1, t.k), Math.max(kMax, t.k * 8)]);
      return anima(t, ms);
    },
    get transform() { return atual; },
    get base() { return base; },
  };
}
