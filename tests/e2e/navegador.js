/* Apoio aos testes de navegador: servidor estático do site + Chrome headless controlado pelo DevTools Protocol.
   Sem dependências: Node 22+ (WebSocket nativo) e um Chrome/Chromium/Edge instalado.
   Caminho do navegador: variável CHROME, ou os locais padrão abaixo. */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

export const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p));

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export function servidor() {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const arq = normalize(join(RAIZ, p));
    if (!arq.startsWith(normalize(RAIZ)) || !existsSync(arq) || statSync(arq).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[extname(arq)] || 'application/octet-stream' });
    res.end(readFileSync(arq));
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ url: `http://127.0.0.1:${srv.address().port}/`, fecha: () => srv.close() })));
}

export async function navegador() {
  const perfil = mkdtempSync(join(tmpdir(), 'webreport-cdp-'));
  // porta 0: o Chrome escolhe uma porta livre e a grava em <perfil>/DevToolsActivePort. Com porta sorteada,
  // os arquivos de teste rodando em paralelo podiam colidir e travar à espera de uma conexão que nunca abria.
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0',
    `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
  let alvo;
  for (let i = 0; i < 150 && !alvo; i++) {
    try {
      const porta = readFileSync(join(perfil, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
      alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((t) => t.type === 'page');
    } catch { await espera(100); }
  }
  if (!alvo) { proc.kill(); throw new Error('o Chrome headless não abriu a porta de depuração'); }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r, falha) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', () => falha(new Error('falha ao conectar no Chrome headless')));
    setTimeout(() => falha(new Error('tempo esgotado conectando no Chrome headless')), 10000);
  });
  let id = 0;
  const pend = new Map();
  const erros = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); })
    .then((m) => { if (m.error) throw new Error(`${method}: ${m.error.message}`); return m.result; });
  await cmd('Runtime.enable');
  await cmd('Page.enable');

  const api = {
    erros,
    cmd,   // acesso direto ao DevTools Protocol (ex.: mouseMoved para hover)
    async largura(w, h = 900) {
      await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
    },
    async js(expr) {
      const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'erro no js');
      return r.result.value;
    },
    /** Abre a página e espera os dados carregarem (body[data-pronto]). */
    async abre(url) {
      await cmd('Page.navigate', { url });
      for (let i = 0; i < 100; i++) {
        // dados carregados e fontes prontas: sem isso o layout ainda pode se deslocar entre medir e clicar
        if (await api.js('document.body && document.body.dataset.pronto === "true" && document.fonts.status === "loaded"').catch(() => false)) {
          // a rolagem até a âncora é animada (scroll-behavior: smooth): espera assentar antes de medir e clicar
          let antes = -1;
          for (let j = 0; j < 40; j++) {
            const y = await api.js('scrollY');
            if (y === antes) return;
            antes = y;
            await espera(120);
          }
          return;
        }
        await espera(100);
      }
      throw new Error('a página não terminou de carregar');
    },
    /** Clique real do mouse no centro do elemento (rolagem instantânea antes de medir). */
    async clica(seletor) {
      // rola até o elemento, espera dois quadros (eventos de ponteiro e layout da rolagem) e só então mede
      const p = await api.js(`(async () => { const e = document.querySelector(${JSON.stringify(seletor)});
        e.scrollIntoView({ block: 'center', behavior: 'instant' });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 150));
        const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await cmd('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 });
      }
      await espera(50);
    },
    async tecla(key) {
      const cod = { Tab: 9, Enter: 13, ' ': 32 }[key];
      for (const type of ['keyDown', 'keyUp']) {
        await cmd('Input.dispatchKeyEvent', { type, key, code: key === ' ' ? 'Space' : key, windowsVirtualKeyCode: cod,
          ...(type === 'keyDown' && key === 'Enter' ? { text: '\r' } : {}) });
      }
      await espera(50);
    },
    async fecha() {
      ws.close();
      proc.kill();
      await espera(300);
      try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Chrome pode segurar arquivos por um instante */ }
    },
  };
  return api;
}
