/* Mobile (375 px, toque emulado no Chrome headless): folha inferior, aba Mapa/Lista, zoom por botões e pinça,
   recorte e exterior. D47: o toque na UF abre a folha; o drill-down só acontece pelo botão "Ver municípios". */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { CHROME, servidor, navegador } from './e2e/navegador.js';

const SEM_CHROME = CHROME ? false : 'Chrome não encontrado (defina a variável CHROME para rodar)';
let srv, nav;
before(async () => {
  if (SEM_CHROME) return;
  srv = await servidor();
  nav = await navegador();
  await nav.largura(375, 812);
});
after(async () => { await nav?.fecha(); srv?.fecha(); });

const ate = async (expr, ms = 8000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await nav.js(expr)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`tempo esgotado esperando: ${expr}`);
};
const folhaBR = `document.querySelector('.folha[aria-label="Detalhe do mapa do Brasil"]')`;
const escalaBR = () => nav.js(`(() => { const m = /scale\\(([\\d.]+)/.exec(document.querySelector('#mapa g.zoom').getAttribute('transform') || ''); return m ? +m[1] : 1; })()`);

test('toque na UF abre a folha com "Ver municípios"; o drill-down só acontece pelo botão', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}#mapa`);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  await nav.toca('.forma--uf[data-chave="MG"]');
  await ate(`!${folhaBR}.hidden`);
  assert.match(await nav.js(`${folhaBR}.textContent`), /Minas Gerais/);
  assert.ok(!(await nav.js('location.hash')).includes('uf='), 'o toque não faz drill-down');
  const forma = await nav.js(`(() => { const f = document.querySelector('.forma--uf[data-chave="MG"]').getBoundingClientRect(); return f.top + f.height / 2; })()`);
  const topoFolha = await nav.js(`${folhaBR}.getBoundingClientRect().top`);
  assert.ok(forma < topoFolha, 'a UF tocada fica acima da folha');
  await nav.toca(`.folha[aria-label="Detalhe do mapa do Brasil"] .botao--primario`);
  await ate(`location.hash.includes('uf=MG') && document.querySelectorAll('.forma--mun').length === 853`);
  assert.equal(await nav.js(`${folhaBR}.hidden`), true, 'a folha fecha ao abrir os municípios');
});

test('toque num município fixa e mostra o detalhe na folha; Esc fecha', { skip: SEM_CHROME }, async () => {
  await nav.js(`document.querySelector('[data-aba="lista"]').click()`);
  await ate(`getComputedStyle(document.querySelector('#mapa .mapa-col')).display === 'none'`);
  assert.equal(await nav.js(`getComputedStyle(document.querySelector('#mapa .ranking')).display !== 'none'`), true, 'aba Lista mostra a lista');
  await nav.toca('#mapa .ranking__lista button[data-chave="3106200"]');
  await ate(`location.hash.includes('mun=3106200') && !${folhaBR}.hidden`);
  assert.match(await nav.js(`${folhaBR}.textContent`), /Belo Horizonte/);
  await nav.tecla('Escape');
  await ate(`${folhaBR}.hidden`);
  await nav.js(`document.querySelector('[data-aba="mapa"]').click()`);
});

test('zoom por botões e por pinça; "enquadrar" volta ao enquadramento da UF', { skip: SEM_CHROME }, async () => {
  const base = await escalaBR();
  await nav.toca('#mapa .zoom-botoes [data-z="mais"]');
  await new Promise((r) => setTimeout(r, 400));
  const maior = await escalaBR();
  assert.ok(maior > base * 1.5, `+ aproxima (${base} → ${maior})`);
  await nav.toca('#mapa .zoom-botoes [data-z="enquadrar"]');
  await new Promise((r) => setTimeout(r, 500));
  assert.ok(Math.abs((await escalaBR()) - base) < 0.01, 'enquadrar volta');
  await nav.pinca('#mapa .mapa-svg');
  await new Promise((r) => setTimeout(r, 300));
  assert.ok((await escalaBR()) > base * 1.2, 'a pinça aproxima');
});

test('alvos de toque de pelo menos 44 px nos controles do mapa (incluindo o Recorte)', { skip: SEM_CHROME }, async () => {
  const pequenos = await nav.js(`[...document.querySelectorAll('#mapa button, #mapa input, #mapa .trilha a, .barra__nav a, .rodape a, #exterior button')]
    .filter((e) => e.offsetParent !== null && !e.closest('.ranking__lista') || e.closest('.ranking__lista button') === e)
    .filter((e) => e.offsetParent !== null)
    .map((e) => { const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after');
      const extra = a.content !== 'none' && a.position === 'absolute' ? Math.max(0, -parseFloat(a.top) || 0) + Math.max(0, -parseFloat(a.bottom) || 0) : 0;
      return { nome: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 30), h: Math.round(r.height + extra) }; })
    .filter((x) => x.h < 44)`);
  assert.deepEqual(pequenos, []);
  assert.equal(await nav.js(`document.querySelectorAll('[data-slot=mRecorte] button').length`), 3, 'Recorte no mobile');
  await nav.toca('[data-slot=mRecorte] button[data-id="cap"]');
  await ate(`location.hash.includes('rec=cap')`);
});

test('exterior no mobile: toque num país (pela lista) abre a folha com as cidades', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}?m=1#exterior?t=2&m=venc`);
  await ate(`document.querySelectorAll('[data-slot=eLista] button').length === 134`);
  await nav.js(`document.querySelectorAll('.abas-mapa')[1].querySelector('[data-aba="lista"]').click()`);
  await nav.toca('[data-slot=eLista] button[data-chave="PRT"]');
  await ate(`!document.querySelector('.folha[aria-label="Detalhe do país"]').hidden`);
  assert.match(await nav.js(`document.querySelector('.folha[aria-label="Detalhe do país"]').textContent`), /Portugal[\s\S]*LISBOA/);
  assert.ok((await nav.js('location.hash')).includes('pais=PRT'));
  assert.equal(await nav.js('document.documentElement.scrollWidth'), 375, 'sem rolagem horizontal');
  assert.deepEqual(nav.erros, []);
});
