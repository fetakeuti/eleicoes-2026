/* Mapa-múndi no navegador (Chrome headless): carga sob demanda, tooltip com cidades, avisos, link direto,
   Voltar do navegador e modo círculos. */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { CHROME, servidor, navegador } from './e2e/navegador.js';

const SEM_CHROME = CHROME ? false : 'Chrome não encontrado (defina a variável CHROME para rodar)';
let srv, nav;
before(async () => {
  if (SEM_CHROME) return;
  srv = await servidor();
  nav = await navegador();
  await nav.largura(1440);
});
after(async () => { await nav?.fecha(); srv?.fecha(); });

const ate = async (expr, ms = 8000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await nav.js(expr)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`tempo esgotado esperando: ${expr}`);
};
const pedidos = () => nav.js(`performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /exterior_pais|mundo\.json/.test(n)).length`);

test('carga sob demanda: nada do exterior antes de a seção chegar perto da tela', { skip: SEM_CHROME }, async () => {
  await nav.abre(srv.url);
  await new Promise((r) => setTimeout(r, 800));
  assert.equal(await pedidos(), 0);
  await nav.js(`document.getElementById('exterior').scrollIntoView({ behavior: 'instant' })`);
  await ate(`document.querySelectorAll('[data-slot=eLista] button').length === 134`);
  assert.equal(await pedidos(), 2);
  assert.equal(await nav.js(`document.querySelectorAll('.camada-pontos circle').length`), 8, 'os 8 países pequenos como ponto');
  assert.equal(await nav.js(`!!document.querySelector('.forma--pais[data-chave="GUF"]')`), true, 'Guiana Francesa separada');
  assert.equal(await nav.js(`document.querySelector('.forma--pais[data-chave="ATA"]')`), null, 'sem Antártida');
});

test('tooltip com as cidades, fora da forma apontada', { skip: SEM_CHROME }, async () => {
  const p = await nav.js(`(() => { const e = document.querySelector('.camada-paises [data-chave="AUS"]'); e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await nav.cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
  await ate(`!document.querySelector('[data-slot=eTooltip]').hidden`);
  const r = await nav.js(`(() => { const t = document.querySelector('[data-slot=eTooltip]').getBoundingClientRect();
    const f = document.querySelector('.camada-paises [data-chave="AUS"]').getBoundingClientRect();
    return { texto: document.querySelector('[data-slot=eTooltip]').textContent, sobrepoe: !(t.right <= f.left || t.left >= f.right || t.bottom <= f.top || t.top >= f.bottom) }; })()`);
  assert.match(r.texto, /Austrália/);
  assert.match(r.texto, /CAMBERRA/);
  assert.match(r.texto, /SYDNEY/);
  assert.equal(r.sobrepoe, false, 'o tooltip não cobre o país');
});

test('link direto #exterior?t=2&m=abst&pais=LBY e Voltar do navegador', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}?l=1#exterior?t=2&m=abst&pais=LBY`);
  await ate(`document.querySelector('[data-slot=eDetalhe] .detalhe__nome')?.textContent === 'Líbia'`);
  const det = await nav.js(`document.querySelector('[data-slot=eDetalhe]').textContent`);
  assert.match(det, /nenhum dos 30 eleitores aptos votou/);
  assert.match(det, /Embaixada do Brasil em Túnis, na Tunísia\. O voto é contado na Líbia\./);
  assert.equal(await nav.js(`document.querySelector('.camada-paises [data-chave="LBY"]').style.fill`), 'url("#hachura-ext")');
  await nav.clica('[data-slot=eLista] button[data-chave="JPN"]');
  await ate(`location.hash === '#exterior?t=2&m=abst&pais=JPN'`);
  // tira o ponteiro de cima da lista: parado sobre a linha do Japão, o hover (por definição) mostraria o Japão
  await nav.cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
  await nav.js('history.back()');
  await ate(`document.querySelector('[data-slot=eDetalhe] .detalhe__nome').textContent === 'Líbia'`);
});

test('modo círculos: área proporcional, maior círculo nos EUA', { skip: SEM_CHROME }, async () => {
  await nav.clica('[data-slot=eMetrica] button[data-id="vot"]');
  await ate(`document.querySelectorAll('.camada-circulos circle').length > 0`);
  const r = await nav.js(`(() => { const c = [...document.querySelectorAll('.camada-circulos circle')];
    const maior = c.reduce((a, b) => (+b.getAttribute('r') > +a.getAttribute('r') ? b : a)); return [c.length, maior.dataset.chave, +maior.getAttribute('r')]; })()`);
  assert.deepEqual(r, [101, 'USA', 30]);
  assert.deepEqual(nav.erros, []);
});
