/* 2 · Mapa do Brasil (HANDOFF §3 e §4): choropleth por UF com drill-down para municípios, em SVG com d3-geo.
   O SVG é montado uma vez por nível; hover, foco, seleção e troca de métrica só mudam atributos
   (preenchimento, classes, camada de destaque), sem redesenhar os polígonos. */

/* global d3, topojson */
import { slot, esc, segmentado, marcaPressionado, lerJSON, corCand, candidato } from '../comum.js';
import { pct, pctCandidato, inteiro, difPP, decimal, votos as fVotos } from '../formato.js';
import { resultado } from '../regras.js';
import { valor, legenda, ordens, ordena, METRICAS, CANDIDATOS_PCT, NOME_CURTO } from './metricas.js';
import { lerHash, escreverHash, corrige, mudouNivel, PADRAO, RECORTES } from './estado.js';
import { iniciarBusca } from './busca-ui.js';
import { ligaLista, desenhaLista, chaveEmFoco as focoEm } from './lista.js';
import { renderRecortes } from './recortes.js';
import { criaZoom } from './zoom.js';
import { criaFolha, criaAbas, ehMobile } from './folha.js';

const W = 800, H = 720;
const MIN_PX2 = 6;                    // município com bbox menor que isso na tela vira ponto (HANDOFF §4.2)

let D;                                // { meta, nacional, ufs }
let est = { ...PADRAO };
const ui = { hov: null, toque: null, ordem: 'a', carregandoUF: null, erroUF: null };
let zoomCtl, folha;
let proj, caminho, svg, gZoom, camadas, k = 1;
let primeiraVez = true;
const ufPorSigla = new Map();
const geoUF = new Map();              // sigla → feature
const nivelMun = new Map();           // sigla → { municipios: Map(cd → item), feats: [...], nomes: Map(cd → nome IBGE) }

// ------------------------------------------------------------------ início
export async function iniciarMapaBrasil(dados) {
  D = dados;
  for (const u of D.ufs) ufPorSigla.set(u.uf, u);
  montaControles();
  renderRecortes(D);
  iniciarBusca(slot('mBusca'), (m) => {
    const fora = (est.rec === 'cap' && !m.capital) || (est.rec === 'ncap' && m.capital);
    aplica({ ...est, uf: m.uf, mun: m.cd_ibge, met: est.met === 'cand' ? 'venc' : est.met, rec: fora ? 'todos' : est.rec }, true);
  });
  window.addEventListener('popstate', () => {
    if (location.hash.startsWith('#exterior?')) return;   // entrada do histórico do mapa-múndi
    const novo = lerHash(location.hash);
    aplica(novo || { ...est, uf: null, mun: null }, false);
  });
  await carregaMalhaUF();
}

async function carregaMalhaUF() {
  mostraEstado('carregando', 'Carregando o mapa…', 0.3);
  try {
    const topo = await lerJSON('malhas/br_uf.json');
    const feats = topojson.feature(topo, topo.objects.ufs).features;
    for (const f of feats) geoUF.set(f.properties.uf, f);
    proj = d3.geoConicEqualArea().parallels([-5, -25]).rotate([52, 0])
      .fitExtent([[8, 8], [W - 8, H - 8]], { type: 'FeatureCollection', features: feats });
    caminho = d3.geoPath(proj);
    montaSVG(feats);
    mostraEstado(null);
    const inicial = lerHash(location.hash);
    await aplica(inicial || est, false);
    // com '#mapa?…' o navegador não acha a âncora (o id é só 'mapa'): rola aqui, sem animação.
    // Com '#mapa' simples, o próprio navegador já rolou.
    if (inicial && location.hash.includes('?')) document.getElementById('mapa').scrollIntoView({ behavior: 'instant' });
  } catch (err) {
    mostraEstado('erro', `Não foi possível carregar o mapa (${err.message}).`, null, carregaMalhaUF);
  }
}

// ------------------------------------------------------------------ estado
/** Aplica um novo estado. `historico`: grava na URL (pushState se mudou de nível, replaceState se não). */
async function aplica(novo, historico = true) {
  novo = corrige(novo);
  const nivel = mudouNivel(est, novo);
  const ufMudou = novo.uf !== est.uf || primeiraVez;
  primeiraVez = false;
  if (historico) {
    const url = escreverHash(novo);
    if (nivel) history.pushState(null, '', url);
    else if (location.hash.startsWith('#mapa?')) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  }
  est = novo;
  if (!historico && slot('mRanking').contains(document.activeElement)) document.activeElement.blur();   // ver exterior.js
  if (ufMudou && folha?.aberta) folha.fecha();
  ui.hov = null;
  sincronizaControles();
  if (ufMudou) await trocaNivel();
  const fixado = est.mun && unidade(est.mun);
  if (fixado && fixado.fora) {   // o recorte novo não inclui o município fixado: solta, sem nova entrada no histórico
    est = { ...est, mun: null };
    if (historico) history.replaceState(null, '', escreverHash(est));
  }
  pinta();
}

async function trocaNivel() {
  ui.erroUF = null;
  if (!est.uf) {
    camadas.mun.selectAll('*').remove();
    camadas.pontos.selectAll('*').remove();
    enquadra(null);
    return;
  }
  const uf = est.uf;
  if (!nivelMun.has(uf)) {
    ui.carregandoUF = uf;
    pinta();   // UF em cinza claro enquanto carrega
    mostraEstado('carregando', `Carregando os municípios · ${ufPorSigla.get(uf).nome}…`, 0.1);
    try {
      let feitos = 0;
      // o progresso só avança enquanto esta carga estiver de pé: se um arquivo falhar, o outro não pode
      // chegar depois e escrever "Carregando…" por cima da mensagem de erro
      const passo = (x) => {
        feitos += 1;
        if (ui.carregandoUF === uf) mostraEstado('carregando', `Carregando os municípios · ${ufPorSigla.get(uf).nome}…`, 0.1 + 0.45 * feitos);
        return x;
      };
      const [dados, topo] = await Promise.all([lerJSON(`municipio/${uf}.json`).then(passo), lerJSON(`malhas/municipios/${uf}.json`).then(passo)]);
      const feats = topojson.feature(topo, topo.objects[uf]).features;
      nivelMun.set(uf, {
        municipios: new Map(dados.municipios.map((m) => [m.cd_ibge, m])),
        nomes: new Map(feats.map((f) => [f.properties.cd_ibge, f.properties.nome])),
        feats,
      });
    } catch (err) {
      ui.carregandoUF = null;
      ui.erroUF = uf;
      mostraEstado('erro', `Não foi possível carregar os municípios · ${ufPorSigla.get(uf).nome} (${err.message}). O mapa por UF continua disponível.`,
        null, () => trocaNivel().then(pinta));
      return;
    }
    ui.carregandoUF = null;
    if (est.uf !== uf) return;   // o usuário saiu da UF enquanto carregava
    mostraEstado(null);
  }
  desenhaMunicipios(uf);
  enquadra(geoUF.get(uf));
}

// ------------------------------------------------------------------ SVG
function montaSVG(feats) {
  svg = d3.select(slot('mSvg')).attr('viewBox', `0 0 ${W} ${H}`).attr('focusable', 'false').attr('tabindex', -1);
  svg.selectAll('*').remove();
  const defs = svg.append('defs');
  // sem votantes: hachura 45°, linha 2px a cada 5px sobre branco (tokens --mapa-hachura-linha / --cor-painel)
  const p = defs.append('pattern').attr('id', 'hachura-br').attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)');
  p.append('rect').attr('width', 5).attr('height', 5).attr('class', 'hachura-fundo');
  p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 5).attr('class', 'hachura-linha');

  gZoom = svg.append('g').attr('class', 'zoom');
  camadas = {
    ufs: gZoom.append('g').attr('class', 'camada-ufs'),
    mun: gZoom.append('g').attr('class', 'camada-mun'),
    pontos: gZoom.append('g').attr('class', 'camada-pontos'),
    virou: gZoom.append('g').attr('class', 'camada-virou'),
    destaque: gZoom.append('g').attr('class', 'camada-destaque'),
    siglas: gZoom.append('g').attr('class', 'camada-siglas'),
  };
  // ordem alfabética do nome: é a ordem do Tab entre os polígonos
  const porNome = [...feats].sort((a, b) => a.properties.nome.localeCompare(b.properties.nome, 'pt-BR'));
  camadas.ufs.selectAll('path').data(porNome, (f) => f.properties.uf).join('path')
    .attr('class', 'forma forma--uf').attr('d', caminho).attr('data-chave', (f) => f.properties.uf)
    .attr('tabindex', 0).attr('role', 'button');
  camadas.siglas.selectAll('text').data(feats).join('text')
    .attr('transform', (f) => `translate(${caminho.centroid(f)})`).attr('dy', '0.35em').attr('text-anchor', 'middle')
    .attr('data-chave', (f) => f.properties.uf).text((f) => f.properties.uf);
  ligaEventos(slot('mSvg'));
  zoomCtl = criaZoom({
    svg: slot('mSvg'), g: gZoom, largura: W, altura: H, kMax: 8, rotulo: 'mapa do Brasil',
    aoMudar: (tr) => { k = tr.k; slot('mTooltip').hidden = true; },
    aoTerminar: () => { if (est.uf && nivelMun.has(est.uf)) desenhaPontos(est.uf); },
  });
  folha = criaFolha({ rotulo: 'Detalhe do mapa do Brasil', aoFechar: () => { ui.toque = null; desenhaDestaque(); } });
  criaAbas(document.querySelector('#mapa .mapa-layout'), () => folha.fecha());
  new ResizeObserver(() => { if (est.uf && nivelMun.has(est.uf)) desenhaPontos(est.uf); }).observe(slot('mSvg'));
}

function desenhaMunicipios(uf) {
  const nv = nivelMun.get(uf);
  camadas.mun.selectAll('path').data(nv.feats, (f) => f.properties.cd_ibge).join('path')
    .attr('class', 'forma forma--mun').attr('d', caminho).attr('data-chave', (f) => f.properties.cd_ibge)
    .attr('tabindex', -1).attr('role', 'button');
  desenhaPontos(uf);
}

/** Municípios minúsculos na escala atual viram ponto com borda (raio 3,5/√zoom, área de toque de 24 px). */
function desenhaPontos(uf) {
  const nv = nivelMun.get(uf);
  const kTela = k * (slot('mSvg').clientWidth / W || 1);
  const pequenos = nv.feats.filter((f) => {
    const [[x0, y0], [x1, y1]] = caminho.bounds(f);
    return (x1 - x0) * (y1 - y0) * kTela * kTela < MIN_PX2;
  });
  const g = camadas.pontos.selectAll('g').data(pequenos, (f) => f.properties.cd_ibge).join((e) => {
    const n = e.append('g').attr('class', 'ponto').attr('data-chave', (f) => f.properties.cd_ibge);
    n.append('circle').attr('class', 'ponto__alvo');
    n.append('circle').attr('class', 'forma forma--ponto').attr('data-chave', (f) => f.properties.cd_ibge);
    return n;
  });
  g.attr('transform', (f) => `translate(${caminho.centroid(f)})`);
  g.select('.forma--ponto').attr('r', 3.5 / Math.sqrt(k));
  g.select('.ponto__alvo').attr('r', 12 / kTela).attr('data-chave', (f) => f.properties.cd_ibge);
  pinta({ soFormas: true });
}

/** Enquadra a UF (ou o Brasil, com null), com transição; as bordas não engrossam (vector-effect). */
function enquadra(f) {
  let t = d3.zoomIdentity;
  if (f) {
    const [[x0, y0], [x1, y1]] = caminho.bounds(f);
    k = Math.min(24, 0.9 / Math.max((x1 - x0) / W, (y1 - y0) / H));
    t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  }
  zoomCtl.enquadra(t);   // o zoom (botões e pinça) parte deste enquadramento; "enquadrar" volta a ele
}

// ------------------------------------------------------------------ dados de cada forma
const nivelAtual = () => (est.uf && nivelMun.has(est.uf) ? 'mun' : 'uf');

/** Turnos de uma UF no recorte ativo (D57). null = sem municípios no recorte (DF em "Não capitais"). */
function turnosUF(u) {
  if (est.rec === 'cap') return u.recortes.capital.turnos;
  if (est.rec === 'ncap') return u.recortes.nao_capital?.turnos ?? null;
  return u.turnos;
}
const foraDoRecorte = (m) => (est.rec === 'cap' && !m.capital) || (est.rec === 'ncap' && m.capital);

/** Rótulo curto do recorte para títulos, tooltip e ranking. */
const SUFIXO_RECORTE = { todos: '', cap: ' · só capitais', ncap: ' · sem as capitais' };

function unidade(chave) {
  if (chave === null || chave === undefined) return null;
  if (typeof chave === 'string' && ufPorSigla.has(chave)) {
    const u = ufPorSigla.get(chave);
    return { chave, nome: u.nome, tipo: 'uf', turnos: turnosUF(u), uf: chave, recortes: u.recortes };
  }
  const nv = est.uf && nivelMun.get(est.uf);
  const m = nv && nv.municipios.get(Number(chave));
  return m ? { chave: m.cd_ibge, nome: nv.nomes.get(m.cd_ibge) || m.nome, tipo: 'mun', uf: m.uf, turnos: m.turnos,
    capital: m.capital, fora: foraDoRecorte(m) } : null;
}
const VAZIO = { v: 0, mag: 0, cor: null, especial: 'vazio', txt: 'Sem municípios neste recorte' };
const val = (u) => (u.turnos ? valor(u.turnos, est, D.meta.ordem_candidatos) : VAZIO);
const nomeCand = (nr) => candidato(D.meta, nr).nome_urna;

// ------------------------------------------------------------------ pintura (só atributos)
/** Pinta formas e legenda; com `soFormas`, não redesenha ranking, painel, trilha nem faixa do exterior.
    O fim de um zoom só repinta as formas: redesenhar o ranking nessa hora trocava o nó da linha entre o
    pressionar e o soltar do mouse, e o clique se perdia. */
function pinta({ soFormas = false } = {}) {
  if (!camadas) return;
  const nivel = nivelAtual();
  const especiais = new Set();
  const preenche = (sel, deUF) => sel.each(function () {
    const chave = this.dataset.chave;
    const u = unidade(deUF ? chave : Number(chave));
    if (!u) return;
    const r = val(u);
    // no drill-down a legenda descreve os municípios: estados especiais das UFs (apagadas) não entram
    if (r.especial && !u.fora && (u.tipo === 'mun' || nivel === 'uf')) especiais.add(r.especial);
    this.style.fill = r.especial === 'sem' ? 'url(#hachura-br)' : r.cor || 'var(--mapa-sem-eleitorado)';
    this.classList.toggle('virou', !!r.virou && !u.fora);
    this.classList.toggle('vazio', r.especial === 'vazio');
    this.classList.toggle('fora-recorte', !!u.fora);
    this.parentNode.classList?.toggle('fora-recorte', !!u.fora && this.classList.contains('forma--ponto'));
    if (this.getAttribute('role') === 'button') {
      this.setAttribute('aria-label', `${u.nome}${SUFIXO_RECORTE[est.rec]}: ${r.txt}`);
      if (r.especial === 'vazio') this.setAttribute('aria-disabled', 'true'); else this.removeAttribute('aria-disabled');
    }
  });
  preenche(camadas.ufs.selectAll('path'), true);
  camadas.ufs.selectAll('path')
    .classed('apagada', (f) => nivel === 'mun' && f.properties.uf !== est.uf)
    .classed('carregando', (f) => f.properties.uf === ui.carregandoUF)
    .classed('sob-municipios', (f) => nivel === 'mun' && f.properties.uf === est.uf)
    .attr('tabindex', nivel === 'mun' ? -1 : 0);
  camadas.siglas.style('display', nivel === 'mun' ? 'none' : null);   // siglas com halo: legíveis sobre qualquer cor
  if (nivel === 'mun') {
    preenche(camadas.mun.selectAll('path'), false);
    preenche(camadas.pontos.selectAll('.forma--ponto'), false);
    if (camadas.pontos.selectAll('.ponto').size()) especiais.add('ponto');
  }
  // contorno de quem virou numa camada própria, por cima dos vizinhos
  const viradas = (nivel === 'mun' ? camadas.mun : camadas.ufs).selectAll('path.virou').nodes()
    .filter((n) => !n.classList.contains('apagada') && !n.classList.contains('sob-municipios'));
  camadas.virou.selectAll('path').data(viradas.map((n) => n.getAttribute('d'))).join('path').attr('d', (d) => d);

  desenhaDestaque();
  renderLegenda(especiais);
  if (soFormas) return;
  renderRanking();
  renderDetalhe();
  renderTrilha();
  renderZZ();
}

function formaDe(chave) {
  if (chave === null) return null;
  const sel = `[data-chave="${chave}"]`;
  return (nivelAtual() === 'mun' && slot('mSvg').querySelector(`.camada-pontos .forma${sel}`))
    || slot('mSvg').querySelector(`.camada-${nivelAtual() === 'mun' ? 'mun' : 'ufs'} path${sel}`);
}

/** Contorno duplo (halo branco 5,5 + linha tinta 2; selecionado 2,5) numa camada por cima. */
function desenhaDestaque() {
  const sel = nivelAtual() === 'mun' ? est.mun : null;
  const itens = [];
  if (sel !== null) itens.push({ chave: sel, larg: 2.5 });
  if (ui.toque !== null && String(ui.toque) !== String(sel)) itens.push({ chave: ui.toque, larg: 2.5 });
  if (ui.hov !== null && String(ui.hov) !== String(sel) && String(ui.hov) !== String(ui.toque)) itens.push({ chave: ui.hov, larg: 2 });
  const dados = itens.map((i) => ({ ...i, el: formaDe(i.chave) })).filter((i) => i.el);
  const g = camadas.destaque.selectAll('g').data(dados).join((e) => {
    const n = e.append('g');
    n.append('path').attr('class', 'destaque destaque--halo');
    n.append('path').attr('class', 'destaque destaque--linha');
    return n;
  });
  g.each(function (i) {
    const ponto = i.el.tagName === 'circle';
    const d = ponto ? null : i.el.getAttribute('d');
    const t = ponto ? i.el.parentNode.getAttribute('transform') : null;
    const r = ponto ? +i.el.getAttribute('r') : 0;
    const circ = ponto ? `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0` : d;
    d3.select(this).attr('transform', t);
    d3.select(this).select('.destaque--halo').attr('d', circ).style('stroke-width', `${i.larg + 3.5}px`);
    d3.select(this).select('.destaque--linha').attr('d', circ).style('stroke-width', `${i.larg}px`);
  });
}

// ------------------------------------------------------------------ eventos
function ligaEventos(el) {
  const chaveDe = (alvo) => alvo.closest?.('[data-chave]')?.dataset.chave ?? null;
  const ativo = (chave) => {
    if (chave === null) return false;
    if (unidade(ufPorSigla.has(chave) ? chave : Number(chave))?.fora) return false;   // fora do recorte: sem destaque
    if (nivelAtual() === 'uf') return true;
    return ufPorSigla.has(chave) ? chave !== est.uf : true;   // no drill-down, as outras UFs também respondem
  };
  el.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const c = chaveDe(e.target);
    if (ativo(c)) hover(c, e.target);
  });
  el.addEventListener('pointerleave', () => hover(null));
  el.addEventListener('click', (e) => { const c = chaveDe(e.target); if (ativo(c)) escolhe(c); });
  el.addEventListener('focusin', (e) => { const c = chaveDe(e.target); if (ativo(c)) hover(c, e.target); });
  el.addEventListener('focusout', () => hover(null));
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const c = chaveDe(e.target);
    if (ativo(c)) { e.preventDefault(); escolhe(c); }
  });
}

const chaveEmFoco = () => focoEm(slot('mRanking'), slot('mSvg'));

function hover(chave, alvo) {
  if (chave === null) chave = chaveEmFoco();   // o mouse saiu: volta para o que está com o foco, se houver
  const c = chave === null ? null : (ufPorSigla.has(chave) ? chave : Number(chave));
  if (ui.hov === c) return;
  ui.hov = c;
  desenhaDestaque();
  renderDetalhe();
  marcaRanking();
  posicionaTooltip(c, alvo);
}

/** Clique: UF → drill-down; município → fixa (clicar de novo solta).
    No mobile (< 768 px) o toque abre a folha inferior: na UF, com o resumo e o botão "Ver municípios"
    (o drill-down só acontece pelo botão, D47); no município, fixa e mostra o detalhe. */
function escolhe(chave) {
  if (ehMobile()) { escolheMobile(chave); return; }
  if (ufPorSigla.has(chave)) {
    if (chave === est.uf) return;
    if (!unidade(chave).turnos) return;   // sem municípios neste recorte (DF em "Não capitais"): sem drill-down
    aplica({ ...est, uf: chave, mun: null });
    return;
  }
  const cd = Number(chave);
  if (unidade(cd)?.fora) return;
  aplica({ ...est, mun: est.mun === cd ? null : cd });
}

async function escolheMobile(chave) {
  const ehUF = ufPorSigla.has(chave);
  if (ehUF && chave !== est.uf) {
    ui.toque = chave;
    desenhaDestaque();
    abreFolha(chave);
    return;
  }
  const cd = Number(chave);
  if (ehUF || unidade(cd)?.fora) return;
  ui.toque = null;
  if (est.mun !== cd) await aplica({ ...est, mun: cd });
  abreFolha(cd);
}

function abreFolha(chave) {
  folha.abre(htmlDetalhe(chave, true), formaDe(chave));
  const bv = folha.corpo.querySelector('[data-ver]');
  if (bv) bv.onclick = () => { folha.fecha(); aplica({ ...est, uf: bv.dataset.ver, mun: null }); };
}

// ------------------------------------------------------------------ tooltip (desktop)
function posicionaTooltip(chave, alvo) {
  const tip = slot('mTooltip');
  const u = unidade(chave);
  if (!u || !matchMedia('(hover: hover)').matches) { tip.hidden = true; return; }
  const r = val(u);
  const rec = u.tipo === 'uf' && est.rec !== 'todos'
    ? `<span class="tooltip__rec">${esc(RECORTES[est.rec])}${est.rec === 'cap' ? `: ${esc(u.recortes.capital.nome)}` : ''}</span>` : '';
  const txt = r.especial === 'vazio' ? 'Sem municípios neste recorte: Brasília é o único município do DF, e é a capital.' : r.txt;
  tip.innerHTML = `<b>${esc(u.nome)}${u.tipo === 'mun' ? ` · ${u.uf}${u.capital ? ' · capital' : ''}` : ''}</b>${rec}<span>${esc(txt)}</span>`;
  tip.hidden = false;
  const caixa = slot('mCaixa').getBoundingClientRect();
  const forma = (formaDe(chave) || alvo).getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const gap = 8;
  let x, y;
  if (u.tipo === 'mun') {                     // município: acima do bbox
    x = forma.left + forma.width / 2 - t.width / 2 - caixa.left;
    y = forma.top - t.height - gap - caixa.top;
    if (y < 0) y = forma.bottom + gap - caixa.top;
  } else {                                    // UF: à direita do bbox, ou à esquerda se não couber
    x = forma.right + gap - caixa.left;
    if (x + t.width > caixa.width) x = forma.left - t.width - gap - caixa.left;
    y = forma.top + forma.height / 2 - t.height / 2 - caixa.top;
  }
  tip.style.left = `${Math.max(0, Math.min(caixa.width - t.width, x))}px`;
  tip.style.top = `${Math.max(0, Math.min(caixa.height - t.height, y))}px`;
}

// ------------------------------------------------------------------ controles
function montaControles() {
  segmentado(slot('mTurno'), [['1', '1º turno'], ['2', '2º turno'], ['v', 'Variação entre turnos']], est.turno,
    (t) => aplica({ ...est, turno: t }));
  montaMetricas();
  const pc = slot('mCand');
  pc.innerHTML = CANDIDATOS_PCT.map((nr) => `<button type="button" data-id="${nr}" aria-pressed="false">
    <i style="background:${corCand(nr)}"></i>${esc(nomeCand(nr))}</button>`).join('');
  pc.onclick = (e) => {
    const b = e.target.closest('button');
    if (b && b.getAttribute('aria-disabled') !== 'true') aplica({ ...est, cand: b.dataset.id });
  };
  segmentado(slot('mRecorte'), Object.entries(RECORTES), est.rec, (r) => aplica({ ...est, rec: r }));
  slot('mVoltar').onclick = () => aplica({ ...est, uf: null, mun: null });
}

let grupoMetricas = null;
function montaMetricas() {
  const variacao = est.turno === 'v';
  const opcoes = Object.entries(METRICAS).filter(([, m]) => m.variacao === variacao).map(([id, m]) => [id, m.rotulo]);
  grupoMetricas = variacao;
  segmentado(slot('mMetrica'), opcoes, est.met, (m) => aplica({ ...est, met: m }), est.uf ? ['cand'] : []);
}

function sincronizaControles() {
  marcaPressionado(slot('mTurno'), est.turno);
  marcaPressionado(slot('mRecorte'), est.rec);
  if (grupoMetricas !== (est.turno === 'v')) montaMetricas();
  else marcaPressionado(slot('mMetrica'), est.met, est.uf ? ['cand'] : []);
  const cand = est.met === 'cand';
  slot('mCandCampo').hidden = !cand;
  marcaPressionado(slot('mCand'), est.cand, est.turno === '2' ? CANDIDATOS_PCT.filter((n) => !['13', '22'].includes(n)) : []);
  slot('mVoltar').hidden = !est.uf;
}

// ------------------------------------------------------------------ legenda, ranking, detalhe, trilha, exterior
function renderLegenda(especiais) {
  const lg = legenda(est, est.met === 'cand' ? nomeCand(est.cand) : '');
  const extras = [];
  if (especiais.has('empate')) extras.push(['<i class="amostra-empate"></i>', 'empate em votos']);
  if (especiais.has('sem')) extras.push(['<i class="amostra-hachura"></i>', 'sem votantes']);
  if (especiais.has('ponto')) extras.push(['<i class="amostra-ponto"></i>', 'município pequeno, desenhado como ponto']);
  if (especiais.has('vazio')) extras.push(['<i class="amostra-sem-eleitorado"></i>', 'sem municípios neste recorte (DF)']);
  if (est.rec !== 'todos' && nivelAtual() === 'mun') extras.push(['<i class="amostra-fora"></i>', 'fora do recorte']);
  const titulo = lg.titulo.replace(/, (1º turno|2º turno|entre os turnos)$/, ' · $1') + SUFIXO_RECORTE[est.rec];
  slot('mLegenda').innerHTML = `<div class="legenda__cab">${esc(titulo)}<small>${esc(lg.nota)}</small></div>
    ${classesLegenda(lg.itens)}
    ${extras.length ? `<div class="legenda__extras">${extras.map(([i, t]) => `<span>${i}${esc(t)}</span>`).join('')}</div>` : ''}`;
}

/** Classes da legenda. Na métrica de vencedor, dois grupos (FLAVIO e LULA) com título, que quebram de linha
    juntos em telas estreitas em vez de espremer dez rótulos numa linha. */
function classesLegenda(itens) {
  const bloco = (lista) => `<div class="legenda__classes">${lista.map(([c, t]) =>
    `<div><i style="background:${c}"></i><span class="num">${esc(t)}</span></div>`).join('')}</div>`;
  if (est.met !== 'venc') return bloco(itens);
  const grupo = (nome, lista) => `<div class="legenda__grupo"><span class="rotulo">${nome}</span>
    ${bloco(lista.map(([c, t]) => [c, t.replace(`${nome} `, '')]))}</div>`;
  return `<div class="legenda__grupos">${grupo('FLAVIO', itens.slice(0, 5))}${grupo('LULA', itens.slice(5))}</div>`;
}

function itensDoNivel() {
  if (nivelAtual() === 'mun') {
    const nv = nivelMun.get(est.uf);
    return [...nv.municipios.values()].filter((m) => !foraDoRecorte(m)).map((m) => unidade(m.cd_ibge));
  }
  return D.ufs.filter((u) => u.uf !== 'ZZ').map((u) => unidade(u.uf));
}

function renderRanking() {
  const nivel = nivelAtual();
  const itens = itensDoNivel().map((u) => ({ ...u, val: val(u) }));
  const lista = ordens(est.met);
  if (!lista.some(([id]) => id === ui.ordem)) ui.ordem = 'a';
  slot('mRankTitulo').textContent = (nivel === 'mun'
    ? `Municípios · ${ufPorSigla.get(est.uf).nome} (${inteiro(itens.length)})` : 'Ranking das 27 UFs') + SUFIXO_RECORTE[est.rec];
  slot('mRankUnid').textContent = { venc: 'margem (p.p.)', cand: '% dos válidos', abst: 'abstenção', flip: 'situação', dmarg: 'p.p.', dabst: 'p.p.' }[est.met];
  const po = slot('mOrdem');
  po.innerHTML = lista.map(([id, rot]) => `<button type="button" data-id="${id}" aria-pressed="${id === ui.ordem}">${rot}</button>`).join('');
  po.onclick = (e) => { const b = e.target.closest('button'); if (b) { ui.ordem = b.dataset.id; renderRanking(); } };
  const ord = ordena(itens, ui.ordem);
  const max = Math.max(...ord.map((x) => x.val.mag), 0.0001);
  const rk = slot('mRanking');
  rk.classList.toggle('ranking__lista--longa', nivel === 'mun');
  rk.classList.toggle('ranking__lista--uf', nivel === 'uf');
  rk.setAttribute('role', 'group');
  rk.setAttribute('aria-label', `${slot('mRankTitulo').textContent}. Use as setas para percorrer a lista.`);
  desenhaLista(rk, ord.map((x, i) => {
    const largura = x.val.especial ? 0 : Math.max(2, Math.min(100, (x.val.mag / max) * 100));
    const fundo = x.val.especial === 'sem' ? 'class="rank-barra amostra-hachura"' : `class="rank-barra" style="width:${largura.toFixed(1)}%;background:${x.val.cor}"`;
    return { chave: x.chave, rotulo: `${esc(x.nome)}: ${esc(x.val.txt)}`,
      html: `<span class="pos num">${i + 1}</span><b>${esc(nivel === 'mun' ? x.nome : x.chave)}</b>
      <span class="trilho-rank"><span ${fundo}></span></span><span class="num valor">${esc(x.val.txt)}</span>` };
  }), est.mun);
  for (const x of ord) if (x.val.especial === 'vazio') rk.querySelector(`[data-chave="${x.chave}"]`)?.setAttribute('aria-disabled', 'true');
  if (!rk.dataset.ligada) { rk.dataset.ligada = '1'; ligaLista(rk, { aoHover: hover, aoEscolher: escolhe }); }
  marcaRanking();
}

function marcaRanking() {
  const foco = String(ui.hov ?? est.mun ?? '');
  for (const b of slot('mRanking').querySelectorAll('button')) b.classList.toggle('foco', b.dataset.chave === foco);
}

function renderDetalhe() {
  const nivel = nivelAtual();
  const alvo = slot('mDetalhe');
  alvo.classList.toggle('detalhe--t1', est.turno === '1');
  alvo.innerHTML = htmlDetalhe(ui.hov ?? (nivel === 'mun' ? est.mun : null), false);
  const bv = alvo.querySelector('[data-ver]');
  if (bv.dataset.ver) bv.onclick = () => escolhe(bv.dataset.ver);
}

/** Conteúdo do painel de detalhe (desktop) ou da folha inferior (mobile, `naFolha`). */
function htmlDetalhe(foco, naFolha) {
  const nivel = nivelAtual();
  let u = unidade(foco);
  let nota;
  if (u) {
    const fixado = u.tipo === 'mun' && u.chave === est.mun;
    nota = u.tipo === 'uf' && !u.turnos ? 'Sem municípios neste recorte.'
      : naFolha ? (u.tipo === 'uf' ? '' : 'Município fixado no mapa.')
        : u.tipo === 'uf' && u.chave !== est.uf ? 'Clique para ver os municípios.' : fixado ? 'Município fixado. Clique de novo para soltar.' : 'Clique para fixar.';
  } else if (nivel === 'mun') {
    u = unidade(est.uf);
    nota = 'Total da UF. Passe o cursor num município para ver os números.';
  } else {
    const rn = D.nacional.recortes;
    u = { nome: 'Brasil', tipo: 'br', turnos: { todos: D.nacional.turnos, cap: rn.capitais.turnos, ncap: rn.nao_capitais.turnos }[est.rec] };
    nota = { todos: 'Total nacional, inclui o exterior.', cap: 'Soma das 27 capitais; o exterior não entra.',
      ncap: `Soma dos ${inteiro(rn.nao_capitais.n_municipios)} municípios que não são capital; o exterior não entra.` }[est.rec];
  }
  // subtítulo com o recorte ativo
  let sub = '';
  if (u.tipo === 'mun') sub = `${ufPorSigla.get(u.uf).nome}${u.capital ? ' · capital' : ''}`;
  else if (u.tipo === 'uf' && est.rec === 'cap') sub = `Só a capital: ${u.recortes.capital.nome}`;
  else if (u.tipo === 'uf' && est.rec === 'ncap') sub = u.recortes.nao_capital ? `Sem a capital: ${inteiro(u.recortes.nao_capital.n_municipios)} municípios` : 'Sem a capital';
  else if (u.tipo === 'br' && est.rec !== 'todos') sub = est.rec === 'cap' ? 'Só as 27 capitais' : 'Sem as capitais';
  const t = est.turno;
  const linha = (cor, nome, a, b) => `<div class="detalhe__linha"><span>${cor ? `<i style="background:${cor}"></i>` : ''}<b>${esc(nome)}</b></span>
    <span class="num"><b>${a}</b> <small>${b}</small></span></div>`;
  let h;
  if (!u.turnos) {
    h = '<p class="aviso">O Distrito Federal tem um só município, Brasília, que é a capital. Não há municípios neste recorte.</p>';
  } else if (t === 'v') {
    const [a, b] = [u.turnos['1'], u.turnos['2']];
    h = ['13', '22'].map((nr) => linha(corCand(nr), nomeCand(nr), `${pct(a.pct_validos[nr])} → ${pct(b.pct_validos[nr])}`, difPP(a.pct_validos[nr], b.pct_validos[nr]))).join('')
      + linha(null, 'Abstenção', `${pct(a.taxa_abstencao)} → ${pct(b.taxa_abstencao)}`, difPP(a.taxa_abstencao, b.taxa_abstencao));
  } else {
    const b = u.turnos[t];
    h = ['13', '22'].map((nr) => linha(corCand(nr), nomeCand(nr), pctCandidato(b.votos[nr], b.pct_validos[nr]), fVotos(b.votos[nr]))).join('');
    if (t === '1') {
      const outros = Object.keys(b.votos).filter((nr) => nr !== '13' && nr !== '22');
      const soma = outros.reduce((s, nr) => s + b.votos[nr], 0);
      h += linha('var(--cand-demais)', `Demais ${outros.length} candidatos`, b.validos ? `${decimal((soma / b.validos) * 100)}%` : '—', fVotos(soma));
    }
    h += linha(null, 'Abstenção', pct(b.taxa_abstencao), `${inteiro(b.abstencao)} eleitores`)
      + linha(null, 'Comparecimento', inteiro(b.comparecimento), 'eleitores');
  }
  const r = u.tipo === 'br' || !u.turnos ? null : val(u);
  let aviso = '';
  if (r?.especial === 'empate') aviso = `<p class="aviso">${esc(r.txt)}.</p>`;
  if (r?.especial === 'sem') aviso = '<p class="aviso">Sem votantes neste turno.</p>';
  // o botão fica sempre no fluxo (invisível quando não se aplica): a altura do painel não muda no hover,
  // e o ranking logo abaixo não pula sob o cursor
  const podeVer = u.tipo === 'uf' && u.chave !== est.uf && !!u.turnos && (nivel === 'uf' || naFolha);
  const ver = naFolha
    ? (podeVer ? `<button type="button" class="botao botao--primario detalhe__ver" data-ver="${u.chave}">Ver municípios</button>` : '')
    : `<button type="button" class="botao detalhe__ver" data-ver="${podeVer ? u.chave : ''}"${podeVer ? '' : ' tabindex="-1" aria-hidden="true" style="visibility:hidden"'}>Ver municípios</button>`;
  const corpo = `<div class="detalhe__cab"><span class="detalhe__nome">${esc(u.nome)}</span>
      <span class="rotulo">${t === 'v' ? '1º → 2º turno' : `${t}º turno`}</span></div>
    ${sub ? `<span class="detalhe__sub">${esc(sub)}</span>` : ''}
    ${aviso}${h}${nota ? `<p class="detalhe__nota">${nota}</p>` : ''}${ver}`;
  return naFolha ? `<div class="detalhe detalhe--folha">${corpo}</div>` : corpo;
}

function renderTrilha() {
  const itens = [['Brasil', { ...est, uf: null, mun: null }]];
  if (est.uf) itens.push([ufPorSigla.get(est.uf).nome, { ...est, mun: null }]);
  const u = est.mun && unidade(est.mun);
  if (u) itens.push([u.nome, est]);
  const nav = slot('mTrilha');
  nav.innerHTML = `<ol>${itens.map(([nome, e], i) => (i < itens.length - 1
    ? `<li><a href="${escreverHash(corrige(e))}" data-i="${i}">${esc(nome)}</a></li>`
    : `<li><span aria-current="page">${esc(nome)}</span></li>`)).join('')}</ol>`;
  nav.onclick = (ev) => {
    const a = ev.target.closest('a');
    if (!a) return;
    ev.preventDefault();
    aplica(itens[+a.dataset.i][1]);
  };
}

function renderZZ() {
  const zz = ufPorSigla.get('ZZ');
  const [a, b] = [zz.turnos['1'], zz.turnos['2']];
  const t = est.turno;
  const O = D.meta.ordem_candidatos;
  const lider = (bl, turno) => { const r = resultado(bl.votos, O[turno]); return r.tipo === 'vencedor' ? NOME_CURTO[r.nr] || nomeCand(r.nr) : 'empate'; };
  let txt;
  if (est.met === 'abst') {
    txt = `Exterior: abstenção de ${pct(zz.turnos[t].taxa_abstencao)} no ${t}º turno.`;
  } else if (est.met === 'dabst') {
    txt = `Exterior: abstenção de ${pct(a.taxa_abstencao)} no 1º turno e ${pct(b.taxa_abstencao)} no 2º (${difPP(a.taxa_abstencao, b.taxa_abstencao)}).`;
  } else if (est.met === 'cand') {
    const bl = zz.turnos[t];
    txt = `Exterior: ${esc(nomeCand(est.cand))} teve ${pctCandidato(bl.votos[est.cand], bl.pct_validos[est.cand])} dos válidos no ${t}º turno.`;
  } else if (est.met === 'flip') {
    const l1 = lider(a, '1'), l2 = lider(b, '2');
    txt = `Exterior: ${l1} liderou o 1º turno e ${l2} venceu o 2º (${l1 === l2 ? 'manteve' : 'mudou de lado'}).`;
  } else if (est.met === 'dmarg') {
    txt = `Exterior: margem LULA − FLAVIO de ${difPP(0, a.pct_validos['13'] - a.pct_validos['22'])} no 1º turno e ${difPP(0, b.pct_validos['13'] - b.pct_validos['22'])} no 2º `
      + `(deslocamento de ${valor(zz.turnos, est, O).txt}).`;
  } else {
    const bl = zz.turnos[t];
    txt = `Exterior: ${NOME_CURTO['13']} ${pct(bl.pct_validos['13'])} × ${NOME_CURTO['22']} ${pct(bl.pct_validos['22'])} no ${t}º turno`
      + ` (${inteiro(bl.comparecimento)} votantes; ${lider(bl, t) === 'empate' ? 'empate' : `venceu ${lider(bl, t)}`}).`;
  }
  const nota = est.rec !== 'todos' ? ' O recorte capitais × não capitais não se aplica ao exterior.' : '';
  slot('mZZ').innerHTML = `<b>ZZ</b><span>${txt} Fica fora do mapa e da escala do Brasil.${nota} <a href="#exterior">Ver por país</a>.</span>`;
}

// ------------------------------------------------------------------ carregando / erro
function mostraEstado(tipo, texto, progresso, tentar) {
  const el = slot('mEstado');
  slot('mCaixa').classList.toggle('mapa-caixa--carregando', tipo === 'carregando');
  if (!tipo) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  if (tipo === 'carregando') {
    el.innerHTML = `<p>${esc(texto)}</p><div class="progresso" role="progressbar" aria-label="${esc(texto)}"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progresso * 100)}"><span style="width:${progresso * 100}%"></span></div>`;
  } else {
    el.innerHTML = `<div class="erro" role="alert"><p>${esc(texto)}</p><button type="button" class="botao">Tentar de novo</button></div>`;
    el.querySelector('button').onclick = () => { mostraEstado(null); tentar(); };
  }
}
