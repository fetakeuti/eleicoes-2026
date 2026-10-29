/* Webreport 2026 — JS de referência (vanilla, sem build).
   Lê data/meta.json, data/nacional.json, data/uf.json e geo/brasil-uf-simplificado.json.
   Todas as cores vêm de tokens.css via var(--...). */
(() => {
  'use strict';

  // ---------- utilidades ----------
  const $ = (sel) => document.querySelector(`[data-slot="${sel}"]`);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MENOS = '−';
  const fi = (n) => Math.abs(n).toLocaleString('pt-BR');
  const fp = (x) => (x === null || x === undefined ? '—' : x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const sinal = (x) => (x > 0.004 ? '+' : x < -0.004 ? MENOS : '');
  const dpp = (a, b) => { const d = Math.round((b - a) * 100) / 100; return sinal(d) + fp(Math.abs(d)) + ' p.p.'; };
  const dvo = (a, b) => { const d = b - a; return d === 0 ? '0' : sinal(d) + fi(d); };
  const notaNulos = () => { const m = /(\d{1,3}(?:\.\d{3})+) votos/.exec(META.definicoes.nulos); return `Nulos do 1º turno incluem ${m ? m[1] : ''} nulos técnicos: votos no candidato nº 28 (Leonardo Alves de Araujo), cuja candidatura terminou em renúncia.`; };
  const pctCand = (votos, pct) => (votos === 0 ? '0 voto' : pct === 0 ? '< 0,01%' : fp(pct) + '%');
  const v = (nome) => `var(--${nome})`;
  const corCand = (nr) => (nr === '13' ? v('cand-13') : nr === '22' ? v('cand-22') : v('cand-demais'));
  const corCandClaro = (nr) => (nr === '13' ? v('cand-13-claro') : nr === '22' ? v('cand-22-claro') : v('cand-demais'));
  const classe = (val, cortes) => { let i = 0; while (i < cortes.length && val >= cortes[i]) i++; return i; };
  const lerJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });

  // ---------- escalas (HANDOFF.md §4.1) ----------
  const RAMPA = { '13': [1, 2, 3, 4, 5].map((i) => v('rampa-13-' + i)), '22': [1, 2, 3, 4, 5].map((i) => v('rampa-22-' + i)) };
  const ABST = [1, 2, 3, 4, 5, 6].map((i) => v('abst-br-' + i));
  const DIVM = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v('div-margem-' + i));
  const DIVA = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v('div-abst-' + i));
  const CORTES_MARGEM = [5, 15, 25, 35], CORTES_ABST = [16, 18, 20, 22, 24], CORTES_DIV = [-6, -4, -2, 0, 2, 4, 6];
  const ESCURAS = new Set([v('rampa-13-4'), v('rampa-13-5'), v('rampa-22-4'), v('rampa-22-5'), v('abst-br-5'), v('abst-br-6'), v('div-margem-1'), v('div-margem-2'), v('div-margem-7'), v('div-margem-8'), v('div-abst-1'), v('div-abst-2'), v('div-abst-7'), v('div-abst-8'), v('virou-13'), v('virou-22')]);

  let META, NAC, UFS, GEO;
  const estado = { unidade: 'pp', outros: false, turno: '2', metN: 'venc', metV: 'dmarg', cand: '13', hov: null, sel: null, ordem: 'a' };

  // ---------- 0 · Resultado ----------
  function renderResultado() {
    const t1 = NAC.turnos['1'], t2 = NAC.turnos['2'];
    const [a, b] = META.ordem_candidatos['2'];
    const ca = META.candidatos.find((c) => c.nr === a), cb = META.candidatos.find((c) => c.nr === b);
    const eleito = ca.situacao_2t === 'ELEITO' ? ca : cb;
    $('manchete').textContent = `${eleito.nome_urna === 'LULA' ? 'Lula' : eleito.nome_urna} é eleito com ${fp(t2.pct_validos[eleito.nr])}% dos votos válidos`;
    const [p1a, p1b] = META.ordem_candidatos['1'];
    const n1a = META.candidatos.find((c) => c.nr === p1a).nome_urna;
    $('linhaFina').innerHTML = `${esc(ca.nome_urna)} (${esc(ca.partido)}) recebeu <span class="num">${fi(t2.votos[a])}</span> votos, <span class="num">${fi(t2.votos[a] - t2.votos[b])}</span> a mais que ${esc(cb.nome_urna)} (${esc(cb.partido)}), com <span class="num">${fi(t2.votos[b])}</span>. No 1º turno, ${esc(n1a)} liderou: ${fp(t1.pct_validos[p1a])}% a ${fp(t1.pct_validos[p1b])}%.`;
    $('barra').innerHTML = `<div class="resultado-barra__rot"><span style="color:${corCand(a)}">${esc(ca.nome_urna)} · ${fp(t2.pct_validos[a])}%</span><span style="color:${corCand(b)}">${esc(cb.nome_urna)} · ${fp(t2.pct_validos[b])}%</span></div>
      <div class="resultado-barra__barra" role="img" aria-label="${esc(ca.nome_urna)} ${fp(t2.pct_validos[a])}%, ${esc(cb.nome_urna)} ${fp(t2.pct_validos[b])}% dos válidos"><div style="width:${t2.pct_validos[a]}%;background:${corCand(a)}"></div><div style="flex:1;background:${corCand(b)}"></div></div>
      <div class="resultado-barra__nota">50% dos válidos</div>`;
    const bn = (t) => (t.brancos + t.nulos) / t.total_votos * 100;
    const kpi = (rot, val, varTxt) => `<div class="kpi"><span class="rotulo">${rot}</span><span class="kpi__valor">${val}</span><span class="kpi__var">${varTxt}</span></div>`;
    $('kpis').innerHTML = kpi('Comparecimento', fp(t2.taxa_comparecimento) + '%', dpp(t1.taxa_comparecimento, t2.taxa_comparecimento) + ' sobre o 1º turno')
      + kpi('Abstenção', fp(t2.taxa_abstencao) + '%', dpp(t1.taxa_abstencao, t2.taxa_abstencao) + ' · ' + fi(t2.abstencao) + ' eleitores')
      + kpi('Brancos e nulos', fp(bn(t2)) + '%', dpp(bn(t1), bn(t2)) + ' · sobre o total de votos');
  }

  // ---------- 1 · Comparação ----------
  function segmentado(alvo, opcoes, atual, aoEscolher) {
    alvo.innerHTML = opcoes.map(([id, rot]) => `<button type="button" data-id="${id}" aria-pressed="${id === atual}">${rot}</button>`).join('');
    alvo.onclick = (e) => { const b = e.target.closest('button'); if (b) aoEscolher(b.dataset.id); };
  }

  function renderComparacao() {
    const t1 = NAC.turnos['1'], t2 = NAC.turnos['2'], pp = estado.unidade === 'pp';
    segmentado($('unidade'), [['pp', 'Variação em pontos percentuais'], ['votos', 'Variação em votos']], estado.unidade, (id) => { estado.unidade = id; renderComparacao(); });
    const MAXP = 60, cand = (nr) => META.candidatos.find((c) => c.nr === nr);
    const fin = META.ordem_candidatos['2'];
    const elim = META.ordem_candidatos['1'].filter((nr) => !fin.includes(nr));
    let h = `<div class="linha linha--cab"><span class="rotulo">Candidato</span><span class="rotulo eixo"><span>0%</span><span>25%</span><span style="color:var(--cor-tinta)">50%</span><span></span></span><span class="rotulo cel-dir">1º turno</span><span class="rotulo cel-dir">2º turno</span><span class="rotulo cel-var">Variação</span></div>`;
    for (const nr of fin) {
      const c = cand(nr), p1 = t1.pct_validos[nr], p2 = t2.pct_validos[nr], v1 = t1.votos[nr], v2 = t2.votos[nr];
      h += `<div class="linha"><div class="cand"><i style="background:${corCand(nr)}"></i><div><b>${esc(c.nome_urna)}</b><span>${nr} · ${esc(c.partido)} · ${esc(c.situacao_2t)}</span></div></div>
        <div class="barras"><div style="width:${p1 / MAXP * 100}%;background:${corCandClaro(nr)}"></div><div style="width:${p2 / MAXP * 100}%;background:${corCand(nr)}"></div></div>
        <div class="cel-dir cel-num num"><b>${fp(p1)}%</b><span>${fi(v1)} votos</span></div>
        <div class="cel-dir cel-num num"><b>${fp(p2)}%</b><span>${fi(v2)} votos</span></div>
        <div class="cel-var num"><b>${pp ? dpp(p1, p2) : dvo(v1, v2)}</b><span>${pp ? dvo(v1, v2) + ' votos' : dpp(p1, p2)}</span></div></div>`;
    }
    const somaElim = elim.reduce((s, nr) => s + t1.votos[nr], 0);
    h += `<button type="button" class="alternar" aria-expanded="${estado.outros}" data-acao="outros"><span>${estado.outros ? 'Ocultar' : 'Mostrar'} os ${elim.length} candidatos eliminados no 1º turno</span><span>juntos: ${fi(somaElim)} votos · ${fp(somaElim / t1.validos * 100)}% dos válidos</span></button>`;
    if (estado.outros) for (const nr of elim) {
      const c = cand(nr);
      h += `<div class="linha linha--elim"><div class="cand"><i style="background:${v('cand-demais')};width:8px;height:8px"></i><div><b style="font-size:13px">${esc(c.nome_urna)}</b><span>${nr} · ${esc(c.partido)}</span></div></div>
        <div class="barras barras--elim"><div style="width:${t1.pct_validos[nr] / MAXP * 100}%;height:8px;background:${v('cand-demais')}"></div></div>
        <div class="cel-dir cel-num num"><b style="font-size:14px">${pctCand(t1.votos[nr], t1.pct_validos[nr])}</b><span>${fi(t1.votos[nr])} votos</span></div>
        <div class="cel-dir" style="font-size:12px;color:var(--cor-apoio)">não disputou</div><div class="cel-dir" style="color:var(--cor-apoio)">—</div></div>`;
    }
    const tab = $('candidatos'); tab.innerHTML = h;
    tab.onclick = (e) => { if (e.target.closest('[data-acao="outros"]')) { estado.outros = !estado.outros; renderComparacao(); } };

    const linha = (nome, base, x1, x2, r1, r2) => `<div class="linha"><div><b>${nome}</b><br><span style="font-size:12px;color:var(--cor-apoio)">${base}</span></div>
      <div class="cel-dir cel-num num"><b>${fi(x1)}</b><span>${r1 === null ? 'eleitores' : fp(r1) + '%'}</span></div>
      <div class="cel-dir cel-num num"><b>${fi(x2)}</b><span>${r2 === null ? 'eleitores' : fp(r2) + '%'}</span></div>
      <div class="cel-var num"><b>${r1 === null ? dvo(x1, x2) : pp ? dpp(r1, r2) : dvo(x1, x2)}</b><span>${r1 === null ? 'mesmo eleitorado' : pp ? dvo(x1, x2) + ' eleitores' : dpp(r1, r2)}</span></div></div>`;
    const pv = (t) => Math.round(t.validos / t.total_votos * 10000) / 100;
    $('participacao').innerHTML = `<div class="linha linha--cab"><span class="rotulo">Métrica</span><span class="rotulo cel-dir">1º turno</span><span class="rotulo cel-dir">2º turno</span><span class="rotulo cel-var">Variação</span></div>`
      + linha('Eleitorado apto', 'soma dos arquivos do TSE (ver rodapé)', t1.aptos, t2.aptos, null, null)
      + linha('Comparecimento', '% de comparecimento + abstenção', t1.comparecimento, t2.comparecimento, t1.taxa_comparecimento, t2.taxa_comparecimento)
      + linha('Abstenção', '% de comparecimento + abstenção', t1.abstencao, t2.abstencao, t1.taxa_abstencao, t2.taxa_abstencao)
      + linha('Votos válidos', '% do total de votos', t1.validos, t2.validos, pv(t1), pv(t2))
      + linha('Brancos', '% do total de votos', t1.brancos, t2.brancos, t1.pct_brancos, t2.pct_brancos)
      + linha('Nulos', '% do total de votos · inclui nulos técnicos no 1º turno', t1.nulos, t2.nulos, t1.pct_nulos, t2.pct_nulos);

    const comp = (t, rot) => { const den = t.comparecimento + t.abstencao, w = (x) => (x / den * 100).toFixed(2) + '%';
      return `<div class="composicao"><b>${rot}</b><div class="composicao__barra num"><div style="width:${w(t.validos)};background:${v('cat-validos')};padding-left:8px">Válidos ${fp(t.validos / den * 100)}%</div><div style="width:${w(t.brancos)};background:${v('cat-brancos')}"></div><div style="width:${w(t.nulos)};background:${v('cat-nulos')}"></div><div class="hachura-abst">Abstenção ${fp(t.abstencao / den * 100)}%</div></div></div>`; };
    $('composicao').innerHTML = comp(t1, '1º turno') + '<div style="height:12px"></div>' + comp(t2, '2º turno');
    $('notasComp').innerHTML = `<div>Percentual de candidato: sobre votos válidos. Brancos e nulos: sobre o total de votos. Comparecimento e abstenção: sobre comparecimento + abstenção, como no relatório do TSE.</div><div>${esc(notaNulos())}</div>`;
  }

  // ---------- 2 · Mapa por UF ----------
  const R = (u) => { const a = u.turnos['1'], b = u.turnos['2']; return { nome: u.nome, a1: a.taxa_abstencao, a2: b.taxa_abstencao, l1: a.pct_validos['13'], f1: a.pct_validos['22'], l2: b.pct_validos['13'], f2: b.pct_validos['22'], v1l: a.votos['13'], v1f: a.votos['22'], v2l: b.votos['13'], v2f: b.votos['22'], c1: a.comparecimento, c2: b.comparecimento }; };
  const NOME = { '13': 'LULA', '22': 'FLAVIO' };

  function valorUF(u) {
    const t = estado.turno, isV = t === 'v', met = isV ? estado.metV : estado.metN, r = R(u);
    if (met === 'venc') { const L = r['l' + t], F = r['f' + t], vl = r['v' + t + 'l'], vf = r['v' + t + 'f']; if (vl === vf) return { v: 0, cor: v('mapa-empate'), txt: 'empate', mag: 0 }; const m = Math.abs(L - F), w = L > F ? '13' : '22'; return { v: L - F, cor: RAMPA[w][classe(m, CORTES_MARGEM)], txt: NOME[w] + ' +' + fp(m), mag: m, barra: m / 55 }; }
    if (met === 'cand') { const p = estado.cand === '13' ? r['l' + t] : r['f' + t]; return { v: p, cor: RAMPA[estado.cand][Math.min(4, Math.floor(p / 16))], txt: fp(p) + '%', mag: p, barra: p / 80 }; }
    if (met === 'abst') { const a = r['a' + t]; return { v: a, cor: ABST[classe(a, CORTES_ABST)], txt: fp(a) + '%', mag: a, barra: (a - 10) / 18 }; }
    if (met === 'flip') { const w1 = r.l1 > r.f1, w2 = r.l2 > r.f2, fl = w1 !== w2; return { v: (fl ? 2 : 0) + (w2 ? 1 : -1), cor: w2 ? v(fl ? 'virou-13' : 'manteve-13') : v(fl ? 'virou-22' : 'manteve-22'), txt: (fl ? 'virou: ' : 'manteve ') + (w2 ? 'LULA' : 'FLAVIO'), mag: fl ? 1 : 0, barra: fl ? 1 : 0.35, virou: fl }; }
    if (met === 'dmarg') { const s = (r.l2 - r.f2) - (r.l1 - r.f1); return { v: s, cor: DIVM[classe(s, CORTES_DIV)], txt: dpp(0, s), mag: Math.abs(s), barra: Math.abs(s) / 8 }; }
    const d = r.a2 - r.a1; return { v: d, cor: DIVA[classe(d, CORTES_DIV)], txt: dpp(0, d), mag: Math.abs(d), barra: Math.abs(d) / 8 };
  }

  function legendaUF() {
    const t = estado.turno, met = t === 'v' ? estado.metV : estado.metN, tl = t === '1' ? '1º turno' : '2º turno';
    const lb5 = ['< 5', '5–15', '15–25', '25–35', '≥ 35'], lbDiv = ['≤ −6', '−6 a −4', '−4 a −2', '−2 a 0', '0 a +2', '+2 a +4', '+4 a +6', '≥ +6'];
    if (met === 'venc') return { titulo: 'Vencedor na UF e margem sobre o 2º colocado, ' + tl, nota: 'p.p. de votos válidos', itens: RAMPA['22'].slice().reverse().map((c, i) => [c, 'FLAVIO ' + lb5[4 - i]]).concat(RAMPA['13'].map((c, i) => [c, 'LULA ' + lb5[i]])) };
    if (met === 'cand') return { titulo: NOME[estado.cand] + ', % dos votos válidos, ' + tl, nota: 'escala fixa entre turnos', itens: RAMPA[estado.cand].map((c, i) => [c, i * 16 + (i === 4 ? '%+' : '–' + (i + 1) * 16 + '%')]) };
    if (met === 'abst') return { titulo: 'Taxa de abstenção, ' + tl, nota: 'escala fixa, só as 27 UFs', itens: ABST.map((c, i) => [c, ['< 16%', '16–18%', '18–20%', '20–22%', '22–24%', '≥ 24%'][i]]) };
    if (met === 'flip') return { titulo: 'Vencedor no 2º turno × líder no 1º', nota: 'contorno = mudou', itens: [[v('virou-22'), 'virou p/ FLAVIO'], [v('manteve-22'), 'manteve FLAVIO'], [v('manteve-13'), 'manteve LULA'], [v('virou-13'), 'virou p/ LULA']] };
    if (met === 'dmarg') return { titulo: 'Deslocamento da margem LULA − FLAVIO', nota: 'p.p.; positivo = a favor de LULA', itens: DIVM.map((c, i) => [c, lbDiv[i]]) };
    return { titulo: 'Variação da abstenção, 2º − 1º turno', nota: 'p.p.; verde-azulado = caiu', itens: DIVA.map((c, i) => [c, lbDiv[i]]) };
  }

  function renderMapa() {
    const isV = estado.turno === 'v', met = isV ? estado.metV : estado.metN;
    segmentado($('mTurno'), [['1', '1º turno'], ['2', '2º turno'], ['v', 'Variação entre turnos']], estado.turno, (id) => { estado.turno = id; renderMapa(); });
    segmentado($('mMetrica'), isV ? [['flip', 'Mudança de vencedor'], ['dmarg', 'Deslocamento da margem'], ['dabst', 'Variação da abstenção']] : [['venc', 'Vencedor e margem'], ['cand', '% de um candidato'], ['abst', 'Abstenção']], met, (id) => { if (isV) estado.metV = id; else estado.metN = id; renderMapa(); });
    const wrap = $('mCandWrap'); wrap.hidden = !(met === 'cand' && !isV);
    const pc = $('mCand'); pc.classList.add('pilulas--cand');
    pc.innerHTML = ['13', '22'].map((c) => `<button type="button" data-id="${c}" aria-pressed="${c === estado.cand}"><i style="background:${corCand(c)}"></i>${c === '13' ? 'LULA' : 'FLAVIO BOLSONARO'}</button>`).join('');
    pc.onclick = (e) => { const b = e.target.closest('button'); if (b) { estado.cand = b.dataset.id; renderMapa(); } };

    const ufs = UFS.filter((u) => u.uf !== 'ZZ'), V = {};
    ufs.forEach((u) => { V[u.uf] = valorUF(u); });

    // SVG: polígonos + camada de destaque (contorno duplo) + siglas
    const svg = $('mSvg');
    let s = '';
    for (const u of ufs) { const g = GEO[u.uf]; s += `<path class="uf" data-uf="${u.uf}" d="${g.d}" style="fill:${V[u.uf].cor}${V[u.uf].virou ? ';stroke:var(--cor-tinta);stroke-width:2' : ''}" tabindex="0" role="button" aria-label="${esc(u.nome)}: ${esc(V[u.uf].txt)}"></path>`; }
    const dest = [estado.sel, estado.hov && estado.hov !== estado.sel ? estado.hov : null].filter(Boolean);
    for (const k of dest) { const l = k === estado.sel ? 2.5 : 2; s += `<path class="destaque" d="${GEO[k].d}" style="stroke:${v('mapa-destaque-halo')};stroke-width:${l + 3.5}px"></path><path class="destaque" d="${GEO[k].d}" style="stroke:${v('mapa-destaque-linha')};stroke-width:${l}px"></path>`; }
    for (const u of ufs) { const g = GEO[u.uf]; s += `<text x="${g.cx}" y="${g.cy + 3}" text-anchor="middle" style="fill:${ESCURAS.has(V[u.uf].cor) ? '#FFFFFF' : v('cor-tinta')}">${u.uf}</text>`; }
    svg.innerHTML = s;
    svg.onmouseover = (e) => { const p = e.target.closest('.uf'); if (p && estado.hov !== p.dataset.uf) { estado.hov = p.dataset.uf; renderMapa(); } };
    svg.onmouseleave = () => { if (estado.hov) { estado.hov = null; renderMapa(); } };
    svg.onclick = (e) => { const p = e.target.closest('.uf'); if (p) { estado.sel = estado.sel === p.dataset.uf ? null : p.dataset.uf; renderMapa(); } };
    svg.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('uf')) { e.preventDefault(); estado.sel = e.target.dataset.uf; renderMapa(); } };

    const lg = legendaUF();
    $('mLegenda').innerHTML = `<div class="legenda__cab">${esc(lg.titulo)}<small>${esc(lg.nota)}</small></div><div class="legenda__classes">${lg.itens.map(([c, t]) => `<div><i style="background:${c}"></i><span class="num">${esc(t)}</span></div>`).join('')}</div>`;

    const zz = R(UFS.find((u) => u.uf === 'ZZ'));
    $('mZZ').innerHTML = `<b>ZZ</b><span>${met === 'abst' || met === 'dabst' ? `Exterior: abstenção de ${fp(zz.a1)}% no 1º turno e ${fp(zz.a2)}% no 2º. Fica fora do mapa e da escala para não comprimir as cores das UFs.` : `Exterior: LULA ${fp(zz.l2)}% × FLAVIO ${fp(zz.f2)}% no 2º turno (${fi(zz.c2)} votantes). Detalhe por país na seção Exterior.`}</span>`;

    // painel de detalhe
    const foco = estado.hov || estado.sel, t = estado.turno;
    const n = NAC.turnos, base = foco ? R(UFS.find((u) => u.uf === foco)) : { nome: 'Brasil', a1: n['1'].taxa_abstencao, a2: n['2'].taxa_abstencao, l1: n['1'].pct_validos['13'], f1: n['1'].pct_validos['22'], l2: n['2'].pct_validos['13'], f2: n['2'].pct_validos['22'], c1: n['1'].comparecimento, c2: n['2'].comparecimento };
    const ln = (cor, nome, a, b) => `<div class="detalhe__linha"><span><i style="background:${cor}"></i><b style="font-size:13px">${nome}</b></span><span class="num"><b>${a}</b> <small style="color:var(--cor-apoio)">${b}</small></span></div>`;
    let linhas;
    if (isV) linhas = ln(corCand('13'), 'LULA', fp(base.l1) + '% → ' + fp(base.l2) + '%', dpp(base.l1, base.l2)) + ln(corCand('22'), 'FLAVIO BOLSONARO', fp(base.f1) + '% → ' + fp(base.f2) + '%', dpp(base.f1, base.f2)) + ln(v('cor-linha'), 'Abstenção', fp(base.a1) + '% → ' + fp(base.a2) + '%', dpp(base.a1, base.a2));
    else linhas = ln(corCand('13'), 'LULA', fp(base['l' + t]) + '%', 'dos válidos') + ln(corCand('22'), 'FLAVIO BOLSONARO', fp(base['f' + t]) + '%', 'dos válidos') + (t === '1' ? ln(v('cand-demais'), 'Demais 10 candidatos', fp(Math.round((100 - base.l1 - base.f1) * 100) / 100) + '%', 'dos válidos') : '') + ln(v('cor-linha'), 'Abstenção', fp(base['a' + t]) + '%', '') + ln(v('cor-linha'), 'Comparecimento', fi(base['c' + t]), 'eleitores');
    $('mDetalhe').innerHTML = `<div class="detalhe__cab"><span class="detalhe__nome">${esc(base.nome)}</span><span class="rotulo">${isV ? '1º → 2º turno' : t + 'º turno'}</span></div>${linhas}<div class="detalhe__nota">${foco ? (estado.sel === foco ? 'UF fixada. Clique de novo para soltar.' : 'Clique para fixar.') : 'Total nacional, inclui o exterior.'}</div>`;

    // ranking + ordenação
    const comLado = ['venc', 'dmarg', 'flip'].includes(met);
    const ordens = comLado ? [['a', 'LULA primeiro'], ['b', 'FLAVIO primeiro'], ['abs', 'Sem candidato']] : met === 'dabst' ? [['a', 'Maior primeiro'], ['b', 'Menor primeiro'], ['abs', 'Maior variação, em módulo']] : [['a', 'Maior primeiro'], ['b', 'Menor primeiro']];
    if (!ordens.some(([id]) => id === estado.ordem)) estado.ordem = 'a';
    const po = $('mOrdem');
    po.innerHTML = ordens.map(([id, rot]) => `<button type="button" data-id="${id}" aria-pressed="${id === estado.ordem}">${rot}</button>`).join('');
    po.onclick = (e) => { const b = e.target.closest('button'); if (b) { estado.ordem = b.dataset.id; renderMapa(); } };
    $('mRankUnid').textContent = met === 'venc' ? 'margem (p.p.)' : met === 'abst' || met === 'cand' ? '%' : met === 'flip' ? 'situação' : 'variação';
    const ord = ufs.map((u) => u.uf).sort((x, y) => estado.ordem === 'b' ? V[x].v - V[y].v : estado.ordem === 'abs' ? V[y].mag - V[x].mag : V[y].v - V[x].v);
    const rk = $('mRanking');
    rk.innerHTML = ord.map((k, i) => `<button type="button" data-uf="${k}" class="${k === foco ? 'foco' : ''}"><span class="pos num">${i + 1}</span><b>${k}</b><span><span class="barra" style="display:block;width:${Math.max(2, Math.min(100, (V[k].barra || 0) * 100)).toFixed(1)}%;background:${V[k].cor}"></span></span><span class="num" style="text-align:right;font-weight:600">${esc(V[k].txt)}</span></button>`).join('');
    rk.onmouseover = (e) => { const b = e.target.closest('button'); if (b && estado.hov !== b.dataset.uf) { estado.hov = b.dataset.uf; renderMapa(); } };
    rk.onmouseleave = () => { if (estado.hov) { estado.hov = null; renderMapa(); } };
    rk.onclick = (e) => { const b = e.target.closest('button'); if (b) { estado.sel = estado.sel === b.dataset.uf ? null : b.dataset.uf; renderMapa(); } };
  }

  // ---------- 3 · Brancos e nulos ----------
  function renderBrancos() {
    const t1 = NAC.turnos['1'], t2 = NAC.turnos['2'];
    const bn = (t) => Math.round((t.brancos + t.nulos) / t.total_votos * 10000) / 100;
    $('bnTitulo').textContent = `No 2º turno, ${fp(bn(t2))}% dos votos não foram para nenhum candidato`;
    $('bnFina').textContent = `Eram ${fp(bn(t1))}% no 1º turno. Foram ${fi((t1.brancos + t1.nulos) - (t2.brancos + t2.nulos))} brancos e nulos a menos, mesmo com ${fi(t2.comparecimento - t1.comparecimento)} eleitores a mais votando.`;
    const kpi = (rot, p1, p2, v1, v2) => `<div class="kpi"><span class="rotulo">${rot}</span><span class="kpi__valor">${fp(p2)}%<small>era ${fp(p1)}%</small></span><span class="kpi__var num">${fi(v2)} votos · ${dvo(v1, v2)} · ${dpp(p1, p2)}</span></div>`;
    $('bnKpis').innerHTML = kpi('Brancos', t1.pct_brancos, t2.pct_brancos, t1.brancos, t2.brancos) + kpi('Nulos', t1.pct_nulos, t2.pct_nulos, t1.nulos, t2.nulos) + kpi('Brancos + nulos', bn(t1), bn(t2), t1.brancos + t1.nulos, t2.brancos + t2.nulos);
    const MAX = 5;
    const linha = (rot, p1, p2, v1, v2) => `<div class="linha"><b>${rot}</b><div class="bn-barras"><div><i style="width:${p1 / MAX * 100}%;background:${v('turno-1')}"></i><span class="num">${fp(p1)}% · ${fi(v1)}</span></div><div><i style="width:${p2 / MAX * 100}%;background:${v('turno-2')}"></i><span class="num"><b>${fp(p2)}% · ${fi(v2)}</b></span></div></div><div class="cel-var num"><b>${dpp(p1, p2)}</b><span>${dvo(v1, v2)} votos</span></div></div>`;
    $('bnZoom').innerHTML = `<div class="linha linha--cab"><span class="rotulo">% do total de votos</span><span class="rotulo eixo"><span>0%</span><span>1%</span><span>2%</span><span>3%</span><span>4%</span><span>5%</span></span><span class="rotulo cel-var">Variação</span></div>`
      + linha('Brancos', t1.pct_brancos, t2.pct_brancos, t1.brancos, t2.brancos) + linha('Nulos¹', t1.pct_nulos, t2.pct_nulos, t1.nulos, t2.nulos) + linha('Brancos + nulos', bn(t1), bn(t2), t1.brancos + t1.nulos, t2.brancos + t2.nulos);
    $('bnNotas').innerHTML = `<div>Percentuais sobre o total de votos (válidos + brancos + nulos = comparecimento), como no relatório do TSE.</div><div>¹ ${esc(notaNulos())}</div>`;
  }

  // ---------- Sobre e rodapé ----------
  function renderSobre() {
    const d = META.definicoes;
    const itens = [['Votos válidos', d.votos_validos], ['% de candidato', d.pct_validos], ['Brancos e nulos', d.pct_brancos_pct_nulos], ['Comparecimento', d.taxa_comparecimento], ['Abstenção', d.taxa_abstencao], ['Denominador', d.denominador_das_taxas], ['Aptos', d.aptos_diferente_de_comparecimento_mais_abstencao], ['Nulos', d.nulos]];
    $('definicoes').innerHTML = itens.map(([t, x]) => `<dt>${esc(t)}</dt><dd>${esc(x)}</dd>`).join('');
    const [data, hora] = META.gerado_em.split(' ');
    $('rodape').innerHTML = `<p>Fonte: Tribunal Superior Eleitoral (TSE), Portal de Dados Abertos. Cargo Presidente, 1º e 2º turnos de 2026, conferido com o Relatório Resultado da Totalização.</p>
      <p>Dados gerados em ${esc(data)} às ${esc(hora.slice(0, 5))}.</p><p>${esc(META.aptos.rodape)}</p><p>Malhas: IBGE (Brasil e municípios) e Natural Earth 1:50m (mundo). O mapa não expressa posição sobre fronteiras.</p>`;
  }

  // ---------- scroll-spy ----------
  function scrollSpy() {
    const links = [...document.querySelectorAll('.barra__nav a')];
    const obs = new IntersectionObserver((ents) => { ents.forEach((en) => { if (en.isIntersecting) links.forEach((a) => a.classList.toggle('ativo', a.getAttribute('href') === '#' + en.target.id)); }); }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main .secao').forEach((s) => obs.observe(s));
  }

  Promise.all([lerJSON('data/meta.json'), lerJSON('data/nacional.json'), lerJSON('data/uf.json'), lerJSON('geo/brasil-uf-simplificado.json')])
    .then(([meta, nac, uf, geo]) => { META = meta; NAC = nac; UFS = uf.ufs; GEO = geo; renderResultado(); renderComparacao(); renderMapa(); renderBrancos(); renderSobre(); scrollSpy(); })
    .catch((err) => { $('manchete').textContent = 'Não foi possível carregar os dados.'; $('linhaFina').textContent = String(err); });
})();
