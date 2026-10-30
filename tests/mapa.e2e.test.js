/* Mapa do Brasil no navegador (Chrome headless): drill-down, estado na URL, Voltar do navegador, busca e
   estado de erro com "Tentar de novo". */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHROME, servidor, navegador } from './e2e/navegador.js';
import { inteiro, variacaoInteiro } from '../js/formato.js';

const SEM_CHROME = CHROME ? false : 'Chrome não encontrado (defina a variável CHROME para rodar)';
const AC = fileURLToPath(new URL('../dados/municipio/AC.json', import.meta.url));
let srv, nav;

before(async () => {
  if (SEM_CHROME) return;
  srv = await servidor();
  nav = await navegador();
  await nav.largura(1440);
});
after(async () => {
  await nav?.fecha();
  srv?.fecha();
});

const ate = async (expr, ms = 8000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await nav.js(expr)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`tempo esgotado esperando: ${expr}`);
};
const estado = () => nav.js(`({ hash: location.hash, mun: document.querySelectorAll('.forma--mun').length,
  voltar: !document.querySelector('[data-slot=mVoltar]').hidden, detalhe: document.querySelector('.detalhe__nome')?.textContent,
  trilha: [...document.querySelectorAll('[data-slot=mTrilha] li')].map((li) => li.textContent.trim()) })`);

test('drill-down pela lista, estado na URL e Voltar do navegador desfazendo', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}#mapa`);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  await nav.clica('.ranking__lista button[data-chave="SP"]');
  await ate(`document.querySelectorAll('.forma--mun').length === 645`);
  let e = await estado();
  assert.equal(e.hash, '#mapa?t=2&m=venc&uf=SP');
  assert.deepEqual(e.trilha, ['Brasil', 'São Paulo']);
  assert.equal(e.voltar, true);

  await nav.clica('.ranking__lista button[data-chave="3547809"]');
  e = await estado();
  assert.equal(e.hash, '#mapa?t=2&m=venc&uf=SP&mun=3547809');
  assert.equal(e.detalhe, 'Santo André');

  await nav.js('history.back()');
  await ate(`!location.hash.includes('mun=')`);
  e = await estado();
  assert.equal(e.hash, '#mapa?t=2&m=venc&uf=SP', 'o 1º Voltar solta o município');
  await nav.js('history.back()');
  await ate(`document.querySelectorAll('.forma--mun').length === 0`);
  e = await estado();
  assert.equal(e.voltar, false, 'o 2º Voltar sai da UF');
  assert.deepEqual(e.trilha, ['Brasil']);
  assert.deepEqual(nav.erros, []);
});

test('abrir direto pela URL restaura turno, métrica, UF e município', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}?u=1#mapa?t=v&m=flip&uf=SP&mun=3547809`);
  await ate(`document.querySelectorAll('.forma--mun').length === 645`);
  const e = await estado();
  assert.equal(e.detalhe, 'Santo André');
  const pressionados = await nav.js(`[...document.querySelectorAll('#mapa [aria-pressed="true"]')].map((b) => b.dataset.id)`);
  assert.ok(pressionados.includes('v') && pressionados.includes('flip'));
  assert.equal(await nav.js(`document.querySelectorAll('.camada-virou path').length`), 32, '32 municípios de SP viraram');
});

test('variação entre turnos: painel com votos e eleitores do 1º e do 2º turno e a diferença, sem mudar de altura', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}#mapa?t=v&m=dmarg&uf=SP`);
  await ate(`document.querySelectorAll('.forma--mun').length === 645`);
  const sp = JSON.parse(readFileSync(fileURLToPath(new URL('../dados/uf.json', import.meta.url)), 'utf8')).ufs.find((u) => u.uf === 'SP').turnos;
  const linhas = await nav.js(`[...document.querySelectorAll('[data-slot=mDetalhe] .detalhe__linha .num')]
    .map((n) => [n.querySelector('.detalhe__abs').textContent, n.querySelectorAll('small')[1].textContent])`);
  const esperado = (a, b, un) => [`${inteiro(a)} → ${inteiro(b)}`, `${variacaoInteiro(b - a)} ${un}`];
  assert.deepEqual(linhas, [
    esperado(sp['1'].votos['13'], sp['2'].votos['13'], 'votos'),
    esperado(sp['1'].votos['22'], sp['2'].votos['22'], 'votos'),
    esperado(sp['1'].abstencao, sp['2'].abstencao, 'eleitores'),
  ]);
  // a altura mínima cobre o pior caso (nome de município em 2 linhas): o ranking logo abaixo não pula no hover
  const altura = () => nav.js(`document.querySelector('[data-slot=mDetalhe]').getBoundingClientRect().height`);
  await nav.abre(`${srv.url}#mapa?t=v&m=dmarg`);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  const hBrasil = await altura();
  await nav.abre(`${srv.url}#mapa?t=v&m=dmarg&uf=MT&mun=5105507`);
  await ate(`document.querySelector('.detalhe__nome')?.textContent === 'Vila Bela da Santíssima Trindade'`);
  assert.equal(await altura(), hBrasil);
  assert.deepEqual(nav.erros, []);
});

test('busca normalizada troca a UF sozinha', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}?b=1#mapa`);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  await nav.js(`(() => { const i = document.querySelector('.busca input'); i.focus(); i.value = 'xique xique'; i.dispatchEvent(new Event('input')); })()`);
  await ate(`document.querySelectorAll('.busca__lista li').length > 0`);
  await nav.tecla('Enter');
  await ate(`location.hash.includes('mun=2933604') && document.querySelectorAll('.forma--mun').length === 417`);
  assert.equal((await estado()).detalhe, 'Xique-Xique');
});

test('erro ao carregar municípios: mensagem, mapa por UF continua e "Tentar de novo" recupera', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}?e=1#mapa`);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  renameSync(AC, `${AC}.teste`);
  try {
    await nav.clica('.ranking__lista button[data-chave="AC"]');
    await ate(`!!document.querySelector('[data-slot=mEstado] .erro')`);
    assert.equal(await nav.js(`document.querySelectorAll('.forma--uf').length`), 27);
  } finally {
    renameSync(`${AC}.teste`, AC);
  }
  await nav.clica('[data-slot=mEstado] button');
  await ate(`document.querySelectorAll('.forma--mun').length === 22`);
});

test('lista do drill-down: todos os municípios, setas movem o foco e o foco destaca o polígono', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}?l=1#mapa?t=2&m=venc&uf=MG`);
  await ate(`document.querySelectorAll('.forma--mun').length === 853`);
  assert.equal(await nav.js(`document.querySelectorAll('.ranking__lista button').length`), 853, 'lista completa, não um top N');
  assert.equal(await nav.js(`document.querySelectorAll('.ranking__lista button[tabindex="0"]').length`), 1, 'uma parada só no Tab');

  await nav.js(`document.querySelector('.ranking__lista button[tabindex="0"]').focus()`);
  for (let i = 0; i < 3; i++) await nav.tecla('ArrowDown');
  const quarto = await nav.js(`(() => { const b = [...document.querySelectorAll('.ranking__lista button')]; return { i: b.indexOf(document.activeElement), chave: document.activeElement.dataset.chave, nome: document.activeElement.querySelector('b').textContent }; })()`);
  assert.equal(quarto.i, 3);
  assert.equal(await nav.js(`document.querySelector('.detalhe__nome').textContent`), quarto.nome, 'o painel mostra o município em foco');
  assert.equal(await nav.js(`document.querySelectorAll('.camada-destaque g').length`), 1, 'contorno duplo no polígono em foco');
  assert.equal(await nav.js(`document.querySelectorAll('.ranking__lista button[tabindex="0"]').length`), 1);

  await nav.tecla('End');
  assert.equal(await nav.js(`[...document.querySelectorAll('.ranking__lista button')].indexOf(document.activeElement)`), 852);
  await nav.tecla('Home');
  await nav.tecla('ArrowDown');
  const chave = await nav.js(`document.activeElement.dataset.chave`);
  await nav.tecla('Enter');
  await ate(`location.hash.includes('mun=${chave}')`);
  assert.equal(await nav.js(`location.hash.endsWith('mun=' + document.activeElement.dataset.chave)`), true, 'Enter fixa e o foco continua na mesma linha');
  assert.equal(await nav.js(`document.activeElement.dataset.chave`), chave);
});
