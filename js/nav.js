/* Barra fixa: scroll-spy (aria-current no link da seção visível) e compensação da altura da barra nas âncoras. */

export function iniciarNav() {
  const barra = document.querySelector('.barra');
  const links = [...barra.querySelectorAll('.barra__nav a')];
  const porId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));

  // âncoras não ficam escondidas sob a barra (52 px no desktop; barra + faixa de chips no mobile)
  const ajustaRecuo = () => {
    document.documentElement.style.scrollPaddingTop = `${barra.offsetHeight}px`;
  };
  ajustaRecuo();
  new ResizeObserver(ajustaRecuo).observe(barra);

  const ativa = (id) => {
    for (const [k, a] of porId) {
      if (k === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    // no mobile, mantém o chip ativo visível na faixa com rolagem horizontal
    const a = porId.get(id);
    const nav = barra.querySelector('.barra__nav');
    if (a && nav.scrollWidth > nav.clientWidth) {
      const r = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
      if (r.left < n.left || r.right > n.right) nav.scrollBy({ left: r.left - n.left - 16, behavior: 'smooth' });
    }
  };

  // a seção ativa é a que cruza a faixa logo abaixo da barra
  const visiveis = new Set();
  const obs = new IntersectionObserver((ents) => {
    ents.forEach((en) => (en.isIntersecting ? visiveis.add(en.target.id) : visiveis.delete(en.target.id)));
    const ordem = [...porId.keys()].filter((id) => visiveis.has(id));
    if (ordem.length) ativa(ordem[0]);
  }, { rootMargin: '-30% 0px -60% 0px' });
  for (const id of porId.keys()) {
    const s = document.getElementById(id);
    if (s) obs.observe(s);
  }
  // fim da página: a última seção pode não alcançar a faixa
  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) ativa('sobre');
  }, { passive: true });
  ativa((location.hash || '#resultado').slice(1).split('?')[0]);
}
