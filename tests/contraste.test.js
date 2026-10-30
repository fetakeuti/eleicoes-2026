/* Checklist §7: contraste ≥ 4,5:1 no texto. Calculado a partir do tokens.css (WCAG 2.x, luminância relativa)
   para cada par texto × fundo que o site usa. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const tokens = Object.fromEntries([...readFileSync(new URL('css/tokens.css', raiz), 'utf8')
  .matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contraste = (a, b) => {
  const [x, y] = [lum(tokens[a]), lum(tokens[b])].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [texto, fundo, onde aparece]
const PARES = [
  ['cor-tinta', 'cor-fundo', 'texto principal'],
  ['cor-texto-2', 'cor-fundo', 'linhas finas, notas'],
  ['cor-apoio', 'cor-fundo', 'rótulos e legendas'],
  ['cor-apoio', 'cor-painel', 'rótulos em cartões, painel, folha'],
  ['cor-apoio', 'cor-realce', 'coluna Variação, avisos'],
  ['cor-texto-2', 'cor-realce', 'faixa do Exterior, avisos'],
  ['cor-tinta', 'cor-realce', 'linha em foco, aviso'],
  ['cor-link', 'cor-fundo', 'links'],
  ['cor-tinta', 'cat-validos', 'rótulo "Válidos" na barra de composição'],
  ['cor-painel', 'cor-tinta', 'botão ativo, chip ativo, tooltip, selo ZZ'],
  ['cor-rodape-texto', 'cor-rodape-fundo', 'rodapé e barra fixa'],
  ['cor-rodape-apoio', 'cor-rodape-fundo', 'rodapé e links da barra'],
  ['cand-13', 'cor-fundo', 'rótulo LULA na barra do Resultado'],
  ['cand-22', 'cor-fundo', 'rótulo FLAVIO na barra do Resultado'],
  ['cand-13', 'cor-painel', 'rótulo LULA sobre cartão'],
  ['cand-22', 'cor-painel', 'rótulo FLAVIO sobre cartão'],
  ['cor-tinta', 'cor-painel', 'siglas das UFs (texto contra o próprio halo)'],
];

for (const [texto, fundo, onde] of PARES) {
  test(`contraste ≥ 4,5: --${texto} sobre --${fundo} (${onde})`, () => {
    const c = contraste(texto, fundo);
    assert.ok(c >= 4.5, `${c.toFixed(2)}:1`);
  });
}

test('siglas das UFs usam halo (o contraste não depende da cor da UF)', () => {
  const css = readFileSync(new URL('css/app.css', raiz), 'utf8');
  const regra = /\.camada-siglas text \{([^}]*)\}/.exec(css)[1];
  assert.match(regra, /fill: var\(--cor-tinta\)/);
  assert.match(regra, /stroke: var\(--cor-painel\)/);
  assert.match(regra, /paint-order: stroke/);
});
