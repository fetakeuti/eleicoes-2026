/* Regressão: o estado aberto/fechado da lista de eliminados se mantém ao trocar a unidade da variação,
   a seção não é redesenhada e o foco do teclado fica no controle usado. Roda no Chrome headless. */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { CHROME, servidor, navegador } from './e2e/navegador.js';

const SEM_CHROME = CHROME ? false : 'Chrome não encontrado (defina a variável CHROME para rodar)';
let srv, nav;

before(async () => {
  if (SEM_CHROME) return;
  srv = await servidor();
  nav = await navegador();
});
after(async () => {
  await nav?.fecha();
  srv?.fecha();
});

const estado = () => nav.js(`(() => {
  const b = document.querySelector('[data-slot="candidatos"] .alternar');
  return {
    expandido: b.getAttribute('aria-expanded'),
    listaVisivel: !document.getElementById('lista-eliminados').hidden,
    rotulo: b.querySelector('.alternar__acao').textContent,
    unidade: document.querySelector('[data-slot="unidade"] [aria-pressed="true"]').dataset.id,
    variacaoLula: document.querySelector('#comparacao .cel-var b').textContent,
    foco: document.activeElement.dataset.id || document.activeElement.className,
  };
})()`);

for (const largura of [1440, 375]) {
  test(`eliminados: aberto/fechado preservado ao trocar a unidade (${largura} px)`, { skip: SEM_CHROME }, async () => {
    await nav.largura(largura);
    await nav.abre(srv.url);
    // marca um nó da seção: se a seção for redesenhada, a marca some
    await nav.js(`document.querySelector('[data-slot="candidatos"] .linha:not(.linha--cab)').dataset.marca = 'original'`);

    let e = await estado();
    assert.equal(e.expandido, 'false');
    assert.equal(e.listaVisivel, false);

    await nav.clica('[data-slot="candidatos"] .alternar');
    e = await estado();
    assert.deepEqual([e.expandido, e.listaVisivel, e.rotulo], ['true', true, 'Ocultar']);

    await nav.clica('[data-slot="unidade"] button[data-id="votos"]');
    e = await estado();
    assert.deepEqual([e.expandido, e.listaVisivel, e.rotulo], ['true', true, 'Ocultar'], 'lista fechou ao trocar para Votos');
    assert.equal(e.unidade, 'votos');
    assert.match(e.variacaoLula, /^\+10\.376\.694$/, 'a variação passou para votos');
    assert.equal(e.foco, 'votos', 'o foco saiu do botão Votos');

    await nav.clica('[data-slot="unidade"] button[data-id="pp"]');
    e = await estado();
    assert.deepEqual([e.expandido, e.listaVisivel], ['true', true], 'lista fechou ao voltar para p.p.');
    assert.equal(e.variacaoLula, '+6,63 p.p.');

    // fechar e trocar de novo: continua fechada
    await nav.clica('[data-slot="candidatos"] .alternar');
    await nav.clica('[data-slot="unidade"] button[data-id="votos"]');
    e = await estado();
    assert.deepEqual([e.expandido, e.listaVisivel, e.rotulo], ['false', false, 'Mostrar'], 'lista abriu sozinha');

    const marca = await nav.js(`document.querySelector('[data-slot="candidatos"] .linha:not(.linha--cab)').dataset.marca`);
    assert.equal(marca, 'original', 'a seção foi redesenhada');
    assert.deepEqual(nav.erros, []);
  });
}

test('eliminados: teclado (Enter no botão) abre e mantém o foco', { skip: SEM_CHROME }, async () => {
  await nav.largura(1440);
  await nav.abre(srv.url);
  await nav.js(`document.querySelector('[data-slot="candidatos"] .alternar').focus()`);
  await nav.tecla('Enter');
  const e = await estado();
  assert.deepEqual([e.expandido, e.listaVisivel], ['true', true]);
  assert.match(e.foco, /alternar/);
});
