/* Checklist de aceite (HANDOFF §7) verificado no navegador (Chrome headless). */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { CHROME, servidor, navegador } from './e2e/navegador.js';

const SEM_CHROME = CHROME ? false : 'Chrome não encontrado (defina a variável CHROME para rodar)';
const LARGURAS = [320, 375, 768, 1024, 1440];
let srv, nav;
before(async () => {
  if (SEM_CHROME) return;
  srv = await servidor();
  nav = await navegador();
});
after(async () => { await nav?.fecha(); srv?.fecha(); });

const ate = async (expr, ms = 8000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await nav.js(expr)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`tempo esgotado esperando: ${expr}`);
};

// Cor de candidato: todo elemento colorido dentro de um rótulo de um só candidato usa a cor (ou rampa) dele.
const CORES = `(() => {
  const erros = []; let conferidos = 0;
  const ROTULOS = '.cand, .detalhe__linha, .rc-placar, .pilulas button, .resultado-barra__rot span, .legenda__grupo, .legenda__circulos span';
  for (const c of document.querySelectorAll(ROTULOS)) {
    const txt = c.textContent;
    const lula = /LULA/.test(txt), flavio = /FLAVIO/.test(txt);
    if (lula === flavio) continue;
    const coloridos = [c, ...c.querySelectorAll('*')].filter((e) => /--(cand|rampa)-(13|22)/.test(e.getAttribute('style') || ''));
    for (const e of coloridos) {
      conferidos += 1;
      const s = e.getAttribute('style');
      if (lula && /-(22)\\b/.test(s)) erros.push('LULA com cor 22: ' + txt.trim().slice(0, 40));
      if (flavio && /-(13)\\b/.test(s)) erros.push('FLAVIO com cor 13: ' + txt.trim().slice(0, 40));
    }
  }
  // no mapa (vencedor e margem), a rampa do polígono acompanha o vencedor do rótulo acessível
  for (const p of document.querySelectorAll('.forma--uf, .forma--mun')) {
    const f = p.style.fill, rot = p.getAttribute('aria-label') || '';
    if (!/rampa-(13|22)/.test(f)) continue;
    conferidos += 1;
    if (/rampa-13/.test(f) && !/LULA/.test(rot)) erros.push('polígono rampa-13 sem LULA: ' + rot);
    if (/rampa-22/.test(f) && !/FLAVIO/.test(rot)) erros.push('polígono rampa-22 sem FLAVIO: ' + rot);
  }
  return { erros, conferidos };
})()`;

test('LULA sempre --cand-13 e FLAVIO sempre --cand-22, em todas as larguras e visões', { skip: SEM_CHROME }, async () => {
  for (const w of [1440, 375]) {
    await nav.largura(w, 900);
    for (const h of ['#mapa?t=2&m=venc', '#mapa?t=1&m=venc&uf=SP', '#mapa?t=1&m=cand&c=22', '#mapa?t=2&m=venc&rec=cap']) {
      await nav.abre(`${srv.url}?c=${w}${encodeURIComponent(h)}${h}`);
      await ate(`document.querySelectorAll('.forma--uf').length === 27 && document.querySelector('.legenda__cab')`);
      if (h.includes('uf=')) await ate(`document.querySelectorAll('.forma--mun').length > 0`);
      // regressão: a barrinha do ranking se chamava .barra, como a barra fixa, e grudava no topo da página
      assert.equal(await nav.js(`document.querySelectorAll('.barra').length`), 1, 'só a barra fixa usa a classe .barra');
      const r = await nav.js(CORES);
      assert.deepEqual(r.erros, [], `${w}px ${h}`);
      assert.ok(r.conferidos > 20, `poucos elementos conferidos em ${w}px ${h}: ${r.conferidos}`);
    }
  }
});

test('tooltip nunca cobre a forma apontada (27 UFs)', { skip: SEM_CHROME }, async () => {
  await nav.largura(1440, 900);
  await nav.abre(`${srv.url}?t=1#mapa`);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  await nav.js(`document.querySelector('.mapa-caixa').scrollIntoView({ block: 'center', behavior: 'instant' })`);
  const cobertas = [];
  for (const uf of await nav.js(`[...document.querySelectorAll('.forma--uf')].map((p) => p.dataset.chave)`)) {
    // um ponto dentro do polígono (o centro do bbox pode cair fora, em UFs irregulares)
    const p = await nav.js(`(() => { const e = document.querySelector('.forma--uf[data-chave="${uf}"]'); const r = e.getBoundingClientRect();
      for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) { const x = r.left + r.width * i / 12, y = r.top + r.height * j / 12;
        if (document.elementFromPoint(x, y) === e) return [x, y]; } return null; })()`);
    if (!p) continue;
    await nav.cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
    try {
      await ate(`!document.querySelector('[data-slot=mTooltip]').hidden && document.querySelector('[data-slot=mTooltip]').textContent.startsWith(document.querySelector('.forma--uf[data-chave="${uf}"]').getAttribute('aria-label').split(':')[0])`);
    } catch {
      throw new Error(`${uf}: tooltip não apareceu (hover: ${await nav.js(`matchMedia('(hover: hover)').matches`)}, ` +
        `alvo: ${await nav.js(`document.elementFromPoint(${p[0]}, ${p[1]})?.dataset?.chave`)}, tooltip: "${await nav.js(`document.querySelector('[data-slot=mTooltip]').textContent`)}")`);
    }
    const cobre = await nav.js(`(() => { const t = document.querySelector('[data-slot=mTooltip]').getBoundingClientRect();
      const f = document.querySelector('.forma--uf[data-chave="${uf}"]').getBoundingClientRect();
      return !(t.right <= f.left || t.left >= f.right || t.bottom <= f.top || t.top >= f.bottom); })()`);
    if (cobre) cobertas.push(uf);
  }
  assert.deepEqual(cobertas, []);
});

test('teclado: Tab percorre controles, listas e polígonos, sempre com foco visível', { skip: SEM_CHROME }, async () => {
  await nav.largura(1440, 900);
  await nav.abre(`${srv.url}?k=1`);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  await nav.js(`document.getElementById('exterior').scrollIntoView({ behavior: 'instant' })`);
  await ate(`document.querySelectorAll('[data-slot=eLista] button').length === 134`);
  await nav.js(`window.scrollTo(0, 0); document.activeElement.blur()`);
  const vistos = [];
  for (let i = 0; i < 260; i++) {
    await nav.tecla('Tab');
    const f = await nav.js(`(() => { const e = document.activeElement; if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      const contorno = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const poligono = e.matches('.forma');
      const destaque = poligono && document.querySelectorAll('#mapa .camada-destaque g').length > 0;
      return { tipo: poligono ? 'poligono' : e.closest('.ranking__lista') ? 'lista' : e.tagName, id: e.dataset.chave || e.dataset.id || e.dataset.z || (e.textContent || '').trim().slice(0, 20),
        visivel: contorno || destaque }; })()`);
    if (!f) break;
    vistos.push(f);
    if (vistos.length > 5 && f.id === vistos[0].id && f.tipo === vistos[0].tipo) break;   // deu a volta
  }
  const invisiveis = vistos.filter((f) => !f.visivel);
  assert.deepEqual(invisiveis, [], 'todo elemento focado tem foco visível');
  const poligonos = vistos.filter((f) => f.tipo === 'poligono').length;
  assert.equal(poligonos, 27, 'os 27 polígonos de UF entram no Tab');
  const listas = vistos.filter((f) => f.tipo === 'lista').length;
  assert.equal(listas, 2, 'cada lista (ranking do Brasil e países) é uma parada só');
  for (const id of ['cap', 'ncap', 'todos', 'mais', 'menos', 'enquadrar', 'vot']) assert.ok(vistos.some((f) => f.id === id), `controle ${id} no Tab`);
});

test('nada estoura a largura e o rodapé está completo em 320, 375, 768, 1024 e 1440 px', { skip: SEM_CHROME }, async () => {
  for (const w of LARGURAS) {
    await nav.largura(w, 900);
    await nav.abre(`${srv.url}?w=${w}`);
    await ate(`document.querySelectorAll('.forma--uf').length === 27`);
    const r = await nav.js(`(() => {
      const rod = document.querySelector('.rodape'); const b = rod.getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, texto: rod.textContent,
        dentro: b.left >= 0 && b.right <= document.documentElement.clientWidth + 0.5 && rod.scrollWidth <= rod.clientWidth + 0.5 };
    })()`);
    assert.equal(r.sw, r.cw, `rolagem horizontal em ${w}px`);
    assert.ok(r.dentro, `rodapé estoura em ${w}px`);
    for (const trecho of ['Fonte: Tribunal Superior Eleitoral', 'Dados processados em', '158.745.502 nos arquivos do TSE',
      '158.745.463', '39 registros estão duplicados', 'Malhas: IBGE', 'Natural Earth', 'não expressa posição sobre fronteiras']) {
      assert.ok(r.texto.includes(trecho), `rodapé sem "${trecho}" em ${w}px`);
    }
  }
  assert.deepEqual(nav.erros, []);
});
