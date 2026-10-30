/* 4 · Exterior: mapa-múndi (HANDOFF §3 e §4). Carrega só quando a seção chega perto da tela (ou com link
   direto #exterior?…). Equal Earth, sem Antártida; choropleth (vencedor e margem, abstenção com escala própria)
   ou círculos de área proporcional aos votantes. País fora do dataset: cinza liso, sem interação. */

/* global d3, topojson */
import { slot, esc, segmentado, marcaPressionado, lerJSON, corCand, candidato } from '../comum.js';
import { pct, pctCandidato, inteiro, decimal, votos as fVotos } from '../formato.js';
import { legenda, ordens, ordena, CORTES } from '../mapa/metricas.js';
import { ligaLista, desenhaLista, chaveEmFoco } from '../mapa/lista.js';
import { iniciarBusca } from '../mapa/busca-ui.js';
import { preparaIndice } from '../mapa/busca.js';
import { METRICAS_EXT, PADRAO_EXT, valorExt, avisos, raio, lerHashExt, escreverHashExt } from './regras.js';

const W = 1000;
let H = 520;
let D, paises, porIso, proj, caminho, camadas;
let est = { ...PADRAO_EXT };
const ui = { hov: null, ordem: 'a', iniciado: false, carregado: false };
const ancora = new Map();   // iso3 → { x, y, bbox } do maior polígono (ou do ponto): círculo e tooltip

// ------------------------------------------------------------------ carga sob demanda
export function iniciarExterior(dados) {
  D = dados;
  const secao = document.getElementById('exterior');
  const comecar = () => { if (!ui.iniciado) { ui.iniciado = true; carregar(); } };
  if (location.hash.startsWith('#exterior?')) comecar();
  else {
    mostraEstado('aguardando', 'O mapa-múndi carrega quando esta seção aparece na tela.');
    const obs = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { obs.disconnect(); comecar(); }
    }, { rootMargin: '400px 0px' });
    obs.observe(secao);
  }
  window.addEventListener('popstate', () => {
    if (!ui.carregado) return;
    const novo = lerHashExt(location.hash);
    if (novo) aplica(novo, false);
    else if (!location.hash.startsWith('#mapa?')) aplica({ ...est, pais: null }, false);
  });
}

async function carregar() {
  mostraEstado('carregando', 'Carregando o mapa-múndi…', 0.2);
  try {
    let feitos = 0;
    const passo = (x) => { feitos += 1; if (!ui.carregado) mostraEstado('carregando', 'Carregando o mapa-múndi…', 0.2 + 0.4 * feitos); return x; };
    const [ext, topo] = await Promise.all([lerJSON('exterior_pais.json').then(passo), lerJSON('malhas/mundo.json').then(passo)]);
    paises = ext.paises;
    porIso = new Map(paises.map((p) => [p.iso3, p]));
    montaSVG(topo);
    montaControles();
    ui.carregado = true;
    mostraEstado(null);
    const inicial = lerHashExt(location.hash);
    aplica(inicial || est, false);
    if (inicial) document.getElementById('exterior').scrollIntoView({ behavior: 'instant' });
  } catch (err) {
    mostraEstado('erro', `Não foi possível carregar o mapa-múndi (${err.message}).`, null, carregar);
  }
}

function aplica(novo, historico = true) {
  const mudouPais = novo.pais !== est.pais;
  est = { ...novo };
  if (historico) {
    const url = escreverHashExt(est);
    if (mudouPais || !location.hash.startsWith('#exterior?')) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  }
  // navegação pelo histórico muda o contexto: o foco que estava numa linha da lista não pode virar "hover"
  // e esconder o país que a URL acabou de restaurar
  if (!historico && slot('eLista').contains(document.activeElement)) document.activeElement.blur();
  ui.hov = null;
  slot('eTooltip').hidden = true;
  marcaPressionado(slot('eTurno'), est.turno);
  marcaPressionado(slot('eMetrica'), est.met);
  pinta();
}

// ------------------------------------------------------------------ SVG
function montaSVG(topo) {
  const feats = topojson.feature(topo, topo.objects.paises).features;
  const pontos = topojson.feature(topo, topo.objects.pontos).features;
  proj = d3.geoEqualEarth().fitWidth(W - 16, { type: 'FeatureCollection', features: feats });
  caminho = d3.geoPath(proj);
  const [[, y0], [, y1]] = caminho.bounds({ type: 'FeatureCollection', features: feats });
  proj.translate([proj.translate()[0] + 8, proj.translate()[1] - y0 + 8]);
  H = Math.ceil(y1 - y0 + 16);

  const svg = d3.select(slot('eSvg')).attr('viewBox', `0 0 ${W} ${H}`).attr('focusable', 'false').attr('tabindex', -1);
  svg.selectAll('*').remove();
  const p = svg.append('defs').append('pattern').attr('id', 'hachura-ext').attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)');
  p.append('rect').attr('width', 5).attr('height', 5).attr('class', 'hachura-fundo');
  p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 5).attr('class', 'hachura-linha');
  camadas = {
    paises: svg.append('g').attr('class', 'camada-paises'),
    circulos: svg.append('g').attr('class', 'camada-circulos'),
    pontos: svg.append('g').attr('class', 'camada-pontos'),
    destaque: svg.append('g').attr('class', 'camada-destaque'),
  };

  const comDado = (f) => porIso.has(f.properties.iso3) && !f.properties.ponto;
  camadas.paises.selectAll('path').data(feats).join('path')
    .attr('d', caminho)
    .attr('class', (f) => `forma forma--pais${comDado(f) ? '' : ' sem-eleitorado'}`)
    .attr('data-chave', (f) => (comDado(f) ? f.properties.iso3 : null));

  // âncora de cada país: centróide e bbox do maior polígono (a França sem os territórios do Caribe e do Índico)
  for (const f of feats) {
    if (!comDado(f)) continue;
    const partes = f.geometry.type === 'MultiPolygon'
      ? f.geometry.coordinates.map((c) => ({ type: 'Polygon', coordinates: c })) : [f.geometry];
    const maior = partes.reduce((a, b) => (caminho.area(b) > caminho.area(a) ? b : a));
    const [x, y] = caminho.centroid(maior);
    ancora.set(f.properties.iso3, { x, y, bbox: caminho.bounds(maior) });
  }
  for (const f of pontos) {
    const [x, y] = proj(f.geometry.coordinates);
    ancora.set(f.properties.iso3, { x, y, bbox: [[x - 4, y - 4], [x + 4, y + 4]], ponto: true });
  }
  camadas.pontos.selectAll('circle').data(pontos.filter((f) => porIso.has(f.properties.iso3))).join('circle')
    .attr('class', 'forma forma--ponto').attr('data-chave', (f) => f.properties.iso3)
    .attr('cx', (f) => ancora.get(f.properties.iso3).x).attr('cy', (f) => ancora.get(f.properties.iso3).y).attr('r', 4);
  ligaEventos(slot('eSvg'));
}

// ------------------------------------------------------------------ pintura
const O = () => D.meta.ordem_candidatos;
const val = (p) => valorExt(p.turnos, est, O());

function pinta() {
  const especiais = new Set();
  const circulos = est.met === 'vot';
  camadas.paises.selectAll('path').each(function () {
    const p = porIso.get(this.dataset.chave);
    if (!p) { this.style.fill = circulos ? 'var(--mapa-neutro)' : 'var(--mapa-sem-eleitorado)'; return; }
    const r = val(p);
    if (r.especial && !circulos) especiais.add(r.especial);   // no modo círculos não há hachura
    if (r.empate) especiais.add('empate');
    this.style.fill = circulos ? 'var(--mapa-neutro)' : r.especial === 'sem' ? 'url(#hachura-ext)' : r.cor;
  });
  camadas.pontos.style('display', circulos ? 'none' : null).selectAll('circle').each(function () {
    const r = val(porIso.get(this.dataset.chave));
    this.style.fill = r.especial === 'sem' ? 'url(#hachura-ext)' : r.cor;
  });
  if (!circulos && camadas.pontos.selectAll('circle').size()) especiais.add('ponto');
  // círculos: maiores atrás, menores na frente
  const dados = circulos ? paises.filter((p) => !p.turnos[est.turno].sem_comparecimento)
    .map((p) => ({ iso3: p.iso3, ...val(p), ...ancora.get(p.iso3) }))
    .sort((a, b) => b.raio - a.raio) : [];
  camadas.circulos.selectAll('circle').data(dados, (d) => d.iso3).join('circle')
    .attr('class', 'forma forma--circulo').attr('data-chave', (d) => d.iso3)
    .attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', (d) => d.raio).style('fill', (d) => d.cor)
    .order();
  if (circulos && paises.some((p) => p.turnos[est.turno].sem_comparecimento)) especiais.add('sem-circulo');
  desenhaDestaque();
  renderLegenda(especiais);
  renderLista();
  renderDetalhe();
}

function formaDe(iso) {
  if (!iso) return null;
  const s = `[data-chave="${iso}"]`;
  const svg = slot('eSvg');
  if (est.met === 'vot') return svg.querySelector(`.camada-circulos ${s}`) || svg.querySelector(`.camada-paises ${s}`);
  return svg.querySelector(`.camada-pontos ${s}`) || svg.querySelector(`.camada-paises ${s}`);
}

/** Contorno duplo (halo 5,5 + linha 2; selecionado 2,5) por cima de tudo. */
function desenhaDestaque() {
  const itens = [];
  if (est.pais) itens.push({ iso: est.pais, larg: 2.5 });
  if (ui.hov && ui.hov !== est.pais) itens.push({ iso: ui.hov, larg: 2 });
  const dados = itens.map((i) => ({ ...i, el: formaDe(i.iso) })).filter((i) => i.el);
  const g = camadas.destaque.selectAll('g').data(dados).join((e) => {
    const n = e.append('g');
    n.append('path').attr('class', 'destaque destaque--halo');
    n.append('path').attr('class', 'destaque destaque--linha');
    return n;
  });
  g.each(function (i) {
    let d = i.el.getAttribute('d');
    if (i.el.tagName === 'circle') {
      const cx = +i.el.getAttribute('cx'), cy = +i.el.getAttribute('cy'), r = +i.el.getAttribute('r');
      d = `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
    }
    d3.select(this).select('.destaque--halo').attr('d', d).style('stroke-width', `${i.larg + 3.5}px`);
    d3.select(this).select('.destaque--linha').attr('d', d).style('stroke-width', `${i.larg}px`);
  });
}

// ------------------------------------------------------------------ eventos
function ligaEventos(el) {
  const chaveDe = (alvo) => alvo.closest?.('[data-chave]')?.dataset.chave ?? null;
  el.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch') hover(chaveDe(e.target)); });
  el.addEventListener('pointerleave', () => hover(null));
  el.addEventListener('click', (e) => { const c = chaveDe(e.target); if (c) escolhe(c); });
}

function hover(iso) {
  if (iso === null) iso = chaveEmFoco(slot('eLista'));
  if (ui.hov === iso) return;
  ui.hov = iso;
  desenhaDestaque();
  renderDetalhe();
  for (const b of slot('eLista').querySelectorAll('button')) b.classList.toggle('foco', b.dataset.chave === (ui.hov ?? est.pais));
  posicionaTooltip(iso);
}

/** Clique fixa o país; clicar de novo solta. */
function escolhe(iso) {
  aplica({ ...est, pais: est.pais === iso ? null : iso });
}

// ------------------------------------------------------------------ tooltip (desktop): branco com borda, fora da forma
function posicionaTooltip(iso) {
  const tip = slot('eTooltip');
  const p = iso && porIso.get(iso);
  if (!p || !matchMedia('(hover: hover)').matches) { tip.hidden = true; return; }
  const b = p.turnos[est.turno];
  const cidades = p.cidades.slice(0, 5).map((c) => {
    const cb = c.turnos[est.turno];
    return `<li><b>${esc(c.nome)}</b> <span class="num">${cb.sem_comparecimento ? 'sem votantes' : `${inteiro(cb.comparecimento)} votantes`}</span></li>`;
  }).join('');
  const mais = p.cidades.length > 5 ? `<li>e mais ${p.cidades.length - 5} cidades</li>` : '';
  const av = avisos(p, est.turno, O(), D.meta.cidades_baixa_confianca);
  tip.innerHTML = `<b class="tooltip__titulo">${esc(p.pais)}</b>
    <span>${p.n_cidades} ${p.n_cidades === 1 ? 'cidade' : 'cidades'} · ${inteiro(b.aptos)} aptos</span>
    ${b.sem_comparecimento ? '' : `<span class="num">LULA ${pctCandidato(b.votos['13'], b.pct_validos['13'])} · FLAVIO ${pctCandidato(b.votos['22'], b.pct_validos['22'])}</span>
    <span class="num">${inteiro(b.comparecimento)} votantes · abstenção ${pct(b.taxa_abstencao)}</span>`}
    ${av.map((a) => `<span class="aviso">${esc(a.texto)}</span>`).join('')}
    <ul class="tooltip__cidades">${cidades}${mais}</ul>`;
  tip.hidden = false;
  const caixa = slot('eCaixa').getBoundingClientRect();
  const svgR = slot('eSvg').getBoundingClientRect();
  const esc2 = svgR.width / W;
  const a = ancora.get(iso);
  const ehCirculo = est.met === 'vot' && formaDe(iso)?.tagName === 'circle';
  const r = ehCirculo ? +formaDe(iso).getAttribute('r') : 0;
  const [[bx0, by0], [bx1, by1]] = ehCirculo ? [[a.x - r, a.y - r], [a.x + r, a.y + r]] : a.bbox;
  const esq = svgR.left - caixa.left + bx0 * esc2, dir = svgR.left - caixa.left + bx1 * esc2;
  const topo = svgR.top - caixa.top + by0 * esc2, base = svgR.top - caixa.top + by1 * esc2;
  const t = tip.getBoundingClientRect();
  const gap = 10;
  let x = dir + gap;                                   // à direita do bbox do país…
  if (x + t.width > caixa.width) x = esq - t.width - gap;   // …ou à esquerda, se não couber
  if (x < 0) x = Math.max(0, Math.min(caixa.width - t.width, dir + gap));
  const y = Math.max(0, Math.min(caixa.height - t.height, (topo + base) / 2 - t.height / 2));
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

// ------------------------------------------------------------------ controles, legenda, lista, detalhe
function montaControles() {
  segmentado(slot('eTurno'), [['1', '1º turno'], ['2', '2º turno']], est.turno, (t) => aplica({ ...est, turno: t }));
  segmentado(slot('eMetrica'), Object.entries(METRICAS_EXT), est.met, (m) => aplica({ ...est, met: m }));
  iniciarBusca(slot('eBusca'), (x) => aplica({ ...est, pais: x.iso3 }), {
    rotulo: 'Buscar país ou cidade',
    exemplo: 'Ex.: Japão, Lisboa',
    indice: async () => preparaIndice(paises.flatMap((p) => [
      { tipo: 'país', nome: p.pais, iso3: p.iso3, pais: p.pais, aptos: p.turnos['1'].aptos, n: p.n_cidades },
      ...p.cidades.map((c) => ({ tipo: 'cidade', nome: c.nome, iso3: p.iso3, pais: p.pais, aptos: c.turnos['1'].aptos })),
    ])),
    linha: (x) => `<b>${esc(x.nome)}</b><span>${x.tipo === 'país' ? `país · ${x.n} ${x.n === 1 ? 'cidade' : 'cidades'}` : `cidade · ${esc(x.pais)}`} · ${inteiro(x.aptos)} aptos</span>`,
    escolhido: (x) => (x.tipo === 'país' ? x.nome : `${x.nome} (${x.pais})`),
    vazio: 'Nenhum país ou cidade com esse nome no voto do exterior.',
  });
  ligaLista(slot('eLista'), { aoHover: hover, aoEscolher: escolhe });
}

function renderLegenda(especiais) {
  const extras = [];
  if (especiais.has('empate')) extras.push(['<i class="amostra-empate"></i>', 'empate em votos']);
  if (especiais.has('sem')) extras.push(['<i class="amostra-hachura"></i>', 'sem votantes']);
  if (especiais.has('sem-circulo')) extras.push(['', 'países sem votantes não têm círculo']);
  if (especiais.has('ponto')) extras.push(['<i class="amostra-ponto"></i>', 'país pequeno, desenhado como ponto']);
  extras.push([`<i class="amostra-sem-eleitorado${est.met === 'vot' ? ' amostra-neutro' : ''}"></i>`, est.met === 'vot' ? 'mapa de fundo' : 'sem eleitor brasileiro']);
  const tl = `${est.turno}º turno`;
  let corpo, titulo, nota;
  if (est.met === 'vot') {
    titulo = `Votantes por país, ${tl}`;
    nota = 'área do círculo proporcional aos votantes; cor do vencedor no país';
    const amostras = [1000, 10000, 87407];
    corpo = `<div class="legenda__circulos">${amostras.map((c) => {
      const r = raio(c) * (slot('eSvg').getBoundingClientRect().width / W || 0.8);
      return `<span><svg width="${Math.ceil(2 * r + 2)}" height="${Math.ceil(2 * r + 2)}" aria-hidden="true"><circle cx="${r + 1}" cy="${r + 1}" r="${r}" class="amostra-circulo"/></svg>${inteiro(c)}</span>`;
    }).join('')}
      <span><i style="background:${corCand('13')}"></i>LULA</span><span><i style="background:${corCand('22')}"></i>FLAVIO</span></div>`;
  } else {
    const lg = est.met === 'abst' ? legenda({ turno: est.turno, met: 'abst' }, '', CORTES.abstExt) : legenda({ turno: est.turno, met: 'venc' });
    titulo = lg.titulo;
    nota = est.met === 'abst' ? 'escala própria do exterior, diferente da do Brasil' : lg.nota;
    const bloco = (lista) => `<div class="legenda__classes">${lista.map(([c, t]) => `<div><i style="background:${c}"></i><span class="num">${esc(t)}</span></div>`).join('')}</div>`;
    corpo = est.met === 'venc'
      ? `<div class="legenda__grupos">${[['FLAVIO', lg.itens.slice(0, 5)], ['LULA', lg.itens.slice(5)]].map(([n, l]) =>
        `<div class="legenda__grupo"><span class="rotulo">${n}</span>${bloco(l.map(([c, t]) => [c, t.replace(`${n} `, '')]))}</div>`).join('')}</div>`
      : bloco(lg.itens);
  }
  slot('eLegenda').innerHTML = `<div class="legenda__cab">${esc(titulo)}<small>${esc(nota)}</small></div>${corpo}
    <div class="legenda__extras">${extras.map(([i, t]) => `<span>${i}${esc(t)}</span>`).join('')}</div>`;
}

function renderLista() {
  const itens = paises.map((p) => ({ chave: p.iso3, nome: p.pais, val: val(p) }));
  const lista = est.met === 'venc' ? ordens('venc') : [['a', 'Maior primeiro'], ['b', 'Menor primeiro']];
  if (!lista.some(([id]) => id === ui.ordem)) ui.ordem = 'a';
  slot('eRankTitulo').textContent = `Países (${paises.length})`;
  slot('eRankUnid').textContent = { venc: 'margem (p.p.)', abst: 'abstenção', vot: 'votantes' }[est.met];
  const po = slot('eOrdem');
  po.innerHTML = lista.map(([id, rot]) => `<button type="button" data-id="${id}" aria-pressed="${id === ui.ordem}">${rot}</button>`).join('');
  po.onclick = (e) => { const b = e.target.closest('button'); if (b) { ui.ordem = b.dataset.id; renderLista(); } };
  const ord = ordena(itens, ui.ordem);
  const max = Math.max(...ord.map((x) => x.val.mag), 0.0001);
  const el = slot('eLista');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', `Países com eleitores brasileiros (${paises.length}). Use as setas para percorrer a lista.`);
  desenhaLista(el, ord.map((x, i) => {
    const fundo = x.val.especial === 'sem' ? 'class="barra amostra-hachura"'
      : `class="barra" style="width:${Math.max(2, (x.val.mag / max) * 100).toFixed(1)}%;background:${x.val.cor}"`;
    return { chave: x.chave, rotulo: `${esc(x.nome)}: ${esc(x.val.txt)}`,
      html: `<span class="pos num">${i + 1}</span><b>${esc(x.nome)}</b><span class="trilho-rank"><span ${fundo}></span></span><span class="num valor">${esc(x.val.txt)}</span>` };
  }), est.pais);
  for (const b of el.querySelectorAll('button')) b.classList.toggle('foco', b.dataset.chave === (ui.hov ?? est.pais));
}

function renderDetalhe() {
  const iso = ui.hov ?? est.pais;
  const p = iso && porIso.get(iso);
  const zz = D.ufs.find((u) => u.uf === 'ZZ');
  const item = p || { pais: 'Exterior', turnos: zz.turnos, cidades: null, n_cidades: paises.reduce((s, x) => s + x.n_cidades, 0) };
  const b = item.turnos[est.turno];
  const linha = (cor, nome, a, c) => `<div class="detalhe__linha"><span>${cor ? `<i style="background:${cor}"></i>` : ''}<b>${esc(nome)}</b></span>
    <span class="num"><b>${a}</b> <small>${c}</small></span></div>`;
  let h = '';
  if (!b.sem_comparecimento) {
    h = ['13', '22'].map((nr) => linha(corCand(nr), candidato(D.meta, nr).nome_urna, pctCandidato(b.votos[nr], b.pct_validos[nr]), fVotos(b.votos[nr]))).join('');
    if (est.turno === '1') {
      const outros = Object.keys(b.votos).filter((nr) => nr !== '13' && nr !== '22');
      const soma = outros.reduce((s, nr) => s + b.votos[nr], 0);
      h += linha('var(--cand-demais)', `Demais ${outros.length} candidatos`, b.validos ? `${decimal((soma / b.validos) * 100)}%` : '—', fVotos(soma));
    }
  }
  h += linha(null, 'Abstenção', pct(b.taxa_abstencao), `${inteiro(b.abstencao)} eleitores`)
    + linha(null, 'Votantes', inteiro(b.comparecimento), `de ${inteiro(b.aptos)} aptos`);
  const av = p ? avisos(p, est.turno, O(), D.meta.cidades_baixa_confianca) : [];
  const cidades = p ? `<ul class="detalhe__cidades">${p.cidades.map((c) => {
    const cb = c.turnos[est.turno];
    const txt = cb.sem_comparecimento ? 'sem votantes'
      : `${inteiro(cb.comparecimento)} votantes · LULA ${pctCandidato(cb.votos['13'], cb.pct_validos['13'])} · FLAVIO ${pctCandidato(cb.votos['22'], cb.pct_validos['22'])}`;
    return `<li><b>${esc(c.nome)}</b><span class="num">${txt}</span></li>`;
  }).join('')}</ul>` : '';
  const nota = p ? (p.iso3 === est.pais && !ui.hov ? 'País fixado. Clique de novo para soltar.' : 'Clique para fixar.')
    : 'Total do exterior. Passe o cursor num país para ver as cidades.';
  slot('eDetalhe').innerHTML = `<div class="detalhe__cab"><span class="detalhe__nome">${esc(item.pais)}</span><span class="rotulo">${est.turno}º turno</span></div>
    <span class="detalhe__sub">${inteiro(item.n_cidades)} ${item.n_cidades === 1 ? 'cidade' : 'cidades'}${p ? '' : ` em ${paises.length} países`}</span>
    ${av.map((a) => `<p class="aviso">${esc(a.texto)}</p>`).join('')}${h}${cidades}<p class="detalhe__nota">${nota}</p>`;
}

// ------------------------------------------------------------------ estados
function mostraEstado(tipo, texto, progresso, tentar) {
  const el = slot('eEstado');
  slot('eCaixa').classList.toggle('mapa-caixa--carregando', tipo === 'carregando' || tipo === 'aguardando');
  if (!tipo) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  if (tipo === 'aguardando') el.innerHTML = `<p>${esc(texto)}</p>`;
  else if (tipo === 'carregando') {
    el.innerHTML = `<p>${esc(texto)}</p><div class="progresso" role="progressbar" aria-label="${esc(texto)}" aria-valuemin="0"
      aria-valuemax="100" aria-valuenow="${Math.round(progresso * 100)}"><span style="width:${progresso * 100}%"></span></div>`;
  } else {
    el.innerHTML = `<div class="erro" role="alert"><p>${esc(texto)}</p><button type="button" class="botao">Tentar de novo</button></div>`;
    el.querySelector('button').onclick = () => { mostraEstado(null); tentar(); };
  }
}
