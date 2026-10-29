import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const IGNORA = new Set(['node_modules', 'dados', 'handoff-webreport-2026', 'tests', '.git']);

function arquivos(dir, ext) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (IGNORA.has(n)) return [];
    if (statSync(p).isDirectory()) return arquivos(p, ext);
    return ext.some((e) => n.endsWith(e)) ? [p] : [];
  });
}

test('css/tokens.css é cópia fiel do tokens.css do handoff', () => {
  const norm = (s) => s.replace(/\r\n/g, '\n');
  assert.equal(norm(readFileSync(join(RAIZ, 'css/tokens.css'), 'utf8')),
    norm(readFileSync(join(RAIZ, 'handoff-webreport-2026/tokens.css'), 'utf8')));
});

test('nenhum hex, rgb() ou hsl() fora do tokens.css (checklist §7)', () => {
  const cor = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;
  const achados = [];
  for (const f of arquivos(RAIZ, ['.css', '.js', '.html'])) {
    if (f.endsWith(join('css', 'tokens.css'))) continue;
    readFileSync(f, 'utf8').split('\n').forEach((linha, i) => {
      // ignora referências a âncoras e ids em HTML/JS (href="#mapa", '#resultado')
      const semAncora = linha.replace(/(["'`(])#[a-z][\w-]*/g, '$1');
      for (const m of semAncora.matchAll(cor)) achados.push(`${relative(RAIZ, f)}:${i + 1} ${m[0]}`);
    });
  }
  assert.deepEqual(achados, []);
});
