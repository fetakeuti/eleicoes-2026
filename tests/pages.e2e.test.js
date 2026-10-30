/* Publicação no GitHub Pages (Chrome headless): o site numa subpasta (/<repositório>/), só com os arquivos
   versionados no git e nomes que batem exatamente, como no Pages. Pega caminho absoluto, arquivo esquecido
   fora do commit e diferença de maiúsculas que o Windows esconde. */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CHROME, servidor, navegador } from './e2e/navegador.js';

const SEM_CHROME = CHROME ? false : 'Chrome não encontrado (defina a variável CHROME para rodar)';
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
let srv, nav;
before(async () => {
  if (SEM_CHROME) return;
  srv = await servidor({ pages: 'eleicao-2026' });
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

test('arquivos versionados: .nojekyll e os dados das 27 UFs com o nome exato', () => {
  const git = new Set(execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8' }).split('\n'));
  // sem .nojekyll o Pages passa o site pelo Jekyll, que descarta arquivos e pastas começados por "_"
  for (const a of ['.nojekyll', 'index.html', 'dados/meta.json', 'dados/nacional.json', 'dados/uf.json', 'dados/exterior_pais.json',
    'dados/municipio/indice.json', 'dados/malhas/br_uf.json', 'dados/malhas/mundo.json']) assert.ok(git.has(a), a);
  for (const uf of UFS) {
    assert.ok(git.has(`dados/municipio/${uf}.json`), `municipio/${uf}.json`);
    assert.ok(git.has(`dados/malhas/municipios/${uf}.json`), `malhas/municipios/${uf}.json`);
  }
});

test('página na subpasta: carrega sem erro e sem 404', { skip: SEM_CHROME }, async () => {
  await nav.abre(srv.url);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  assert.deepEqual(srv.naoAchados, []);
  assert.deepEqual(nav.erros, []);
});

test('drill-down e link direto mantêm a subpasta', { skip: SEM_CHROME }, async () => {
  await nav.abre(`${srv.url}#mapa`);
  await ate(`document.querySelectorAll('.forma--uf').length === 27`);
  await nav.clica('.ranking__lista button[data-chave="SP"]');
  await ate(`document.querySelectorAll('.forma--mun').length === 645`);
  assert.equal(await nav.js('location.pathname'), '/eleicao-2026/');
  assert.equal(await nav.js('location.hash'), '#mapa?t=2&m=venc&uf=SP');

  await nav.abre(`${srv.url}#mapa?t=1&m=venc&uf=BA`);
  await ate(`document.querySelectorAll('.forma--mun').length === 417`);
  assert.deepEqual(srv.naoAchados, []);
  assert.deepEqual(nav.erros, []);
});

test('mapa-múndi carrega sob demanda na subpasta', { skip: SEM_CHROME }, async () => {
  await nav.abre(srv.url);
  await nav.js(`document.getElementById('exterior').scrollIntoView({ behavior: 'instant' })`);
  await ate(`document.querySelectorAll('[data-slot=eLista] button').length === 134`);
  assert.deepEqual(srv.naoAchados, []);
  assert.deepEqual(nav.erros, []);
});
