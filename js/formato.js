/* Formatação pt-BR do webreport (HANDOFF §2). Puro, sem DOM e sem depender do locale do navegador:
   o mesmo resultado no Node (testes) e em qualquer navegador. */

export const MENOS = '−';   // sinal de menos tipográfico (U+2212), nunca o hífen
export const TRACO = '—';       // valor ausente (null): nunca 0%

const vazio = (x) => x === null || x === undefined || Number.isNaN(x);

/** Arredonda para `casas` decimais, meio para longe do zero (47,005 → 47,01). */
export function arredonda(x, casas = 2) {
  const f = 10 ** casas;
  const s = Math.sign(x) || 1;
  // toPrecision(15) remove o ruído binário (1.005 * 100 = 100.49999…) antes de arredondar
  return (s * Math.round(Number((Math.abs(x) * f).toPrecision(15)))) / f;
}

function milharSemSinal(inteiro) {
  return String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Inteiro com ponto de milhar: 158745502 → "158.745.502"; negativo com U+2212. */
export function inteiro(n) {
  if (vazio(n)) return TRACO;
  const r = Math.round(n);
  return (r < 0 ? MENOS : '') + milharSemSinal(Math.abs(r));
}

/** Decimal com vírgula e `casas` fixas: 47.03 → "47,03". */
export function decimal(x, casas = 2) {
  if (vazio(x)) return TRACO;
  const r = arredonda(x, casas);
  const [i, d] = Math.abs(r).toFixed(casas).split('.');
  const neg = r < 0 ? MENOS : '';
  return neg + milharSemSinal(i) + (casas ? ',' + d : '');
}

/** Percentual com 2 casas: 47.03 → "47,03%"; null → "—". */
export function pct(x) {
  return vazio(x) ? TRACO : decimal(x) + '%';
}

/** Percentual de candidato (HANDOFF §2): 0 voto → "0 voto"; votos > 0 com % arredondado a 0 → "< 0,01%". */
export function pctCandidato(votos, p) {
  if (votos === 0) return '0 voto';
  if (vazio(p)) return TRACO;
  if (votos > 0 && arredonda(p) === 0) return '< 0,01%';
  return pct(p);
}

/** "1 voto", "2 votos", "1.530 votos". */
export function votos(n) {
  if (vazio(n)) return TRACO;
  return `${inteiro(n)} ${Math.abs(n) === 1 ? 'voto' : 'votos'}`;
}

function sinalDe(r) {
  return r > 0 ? '+' : r < 0 ? MENOS : '';
}

/** Variação em pontos percentuais: 1.86 → "+1,86 p.p.", −0.5 → "−0,50 p.p.", 0 → "0,00 p.p.". */
export function variacaoPP(d) {
  if (vazio(d)) return TRACO;
  const r = arredonda(d);
  return sinalDe(r) + decimal(Math.abs(r)) + ' p.p.';
}

/** Variação entre dois percentuais já arredondados (2º − 1º), sem ruído de ponto flutuante. */
export function difPP(a, b) {
  if (vazio(a) || vazio(b)) return TRACO;
  return variacaoPP(arredonda(b - a));
}

/** Variação inteira com sinal: −870302 → "−870.302", 0 → "0". */
export function variacaoInteiro(d) {
  if (vazio(d)) return TRACO;
  const r = Math.round(d);
  return sinalDe(r) + milharSemSinal(Math.abs(r));
}

/** Percentual recalculado a partir dos inteiros (nunca média de taxas): parte / todo × 100, 2 casas. */
export function razaoPct(parte, todo) {
  return todo ? arredonda((parte / todo) * 100) : null;
}

/** "LULA" → "Lula"; "FLAVIO BOLSONARO" → "Flavio Bolsonaro" (sem acento, como no TSE). */
export function nomeProprio(nomeUrna) {
  const minusc = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return nomeUrna.toLowerCase().split(' ')
    .map((p, i) => (i > 0 && minusc.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}
