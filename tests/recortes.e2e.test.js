/* Recorte capitais × não capitais no mapa do Brasil (Chrome headless): teclado, URL, Voltar, DF e drill-down. */

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
const pressionado = () => nav.js(`document.querySelector('[data-slot=mRecorte] [aria-pressed="true"]').dataset.id`);

test('controle Recorte por teclado: Tab até o grupo, Enter e espaço escolhem, aria-pressed acompanha', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}#mapa`);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  assert.equal(await pressionado(), 'todos');
  // foco no último botão do controle anterior (Métrica) e Tab até "Todos"
  await nav.js(`[...document.querySelectorAll('[data-slot=mMetrica] button')].at(-1).focus()`);
  await nav.tecla('Tab');
  assert.equal(await nav.js(`document.activeElement.closest('[data-slot=mRecorte]') && document.activeElement.dataset.id`), 'todos');
  await nav.tecla('Tab');
  await nav.tecla('Enter');
  await ate(`location.hash.includes('rec=cap')`);
  assert.equal(await pressionado(), 'cap');
  assert.equal(await nav.js('document.activeElement.dataset.id'), 'cap', 'o foco fica no botão escolhido');
  assert.match(await nav.js(`document.querySelector('.legenda__cab').textContent`), /Vencedor e margem · 2º turno · só capitais/);
  assert.match(await nav.js(`document.querySelector('[data-slot=mRankTitulo]').textContent`), /só capitais/);
  assert.match(await nav.js(`document.querySelector('[data-slot=mZZ]').textContent`), /não se aplica ao exterior/);
  await nav.tecla('Tab');
  await nav.tecla(' ');
  await ate(`location.hash.includes('rec=ncap')`);
  assert.equal(await pressionado(), 'ncap');
});

test('DF em "Não capitais": sem municípios no recorte, sem drill-down, com explicação', { skip: SEM_CHROME }, async () => {
  assert.equal(await nav.js(`document.querySelector('.forma--uf[data-chave="DF"]').classList.contains('vazio')`), true);
  assert.equal(await nav.js(`document.querySelector('.ranking__lista button[data-chave="DF"]').getAttribute('aria-disabled')`), 'true');
  await nav.clica('.ranking__lista button[data-chave="DF"]');
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(!(await nav.js('location.hash')).includes('uf=DF'), 'o DF não abre drill-down neste recorte');
  assert.match(await nav.js(`document.querySelector('[data-slot=mDetalhe]').textContent`), /um só município, Brasília, que é a capital/);
});

test('Voltar do navegador desfaz a troca de recorte', { skip: SEM_CHROME }, async () => {
  await nav.js('history.back()');
  await ate(`document.querySelector('[data-slot=mRecorte] [aria-pressed="true"]').dataset.id === 'cap'`);
  await nav.js('history.back()');
  await ate(`document.querySelector('[data-slot=mRecorte] [aria-pressed="true"]').dataset.id === 'todos'`);
  assert.ok(!(await nav.js('location.hash')).includes('rec='));
});

test('drill-down de SP em "Não capitais": a capital fica apagada e fora da lista', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}?r=1#mapa?t=2&m=venc&rec=ncap&uf=SP`);
  await ate(`document.querySelectorAll('.forma--mun').length === 645`);
  assert.equal(await nav.js(`document.querySelectorAll('.ranking__lista button').length`), 644);
  assert.equal(await nav.js(`!!document.querySelector('.ranking__lista button[data-chave="3550308"]')`), false);
  assert.equal(await nav.js(`document.querySelector('.forma--mun[data-chave="3550308"]').classList.contains('fora-recorte')`), true);
  // em "Capitais", a lista tem só a capital
  await nav.clica('[data-slot=mRecorte] button[data-id="cap"]');
  await ate(`document.querySelectorAll('.ranking__lista button').length === 1`);
  assert.equal(await nav.js(`document.querySelector('.ranking__lista button').dataset.chave`), '3550308');
  assert.deepEqual(nav.erros, []);
});
