/* Busca de município (HANDOFF §3): normaliza acento, caixa, hífen e apóstrofo; até 6 sugestões a partir de 2 letras.
   Puro: testado em tests/busca.test.js. */

export function normaliza(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[-'’`´]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Prepara o índice (municipio/indice.json) uma vez: chaves normalizadas do nome do IBGE e do TSE. */
export function preparaIndice(municipios) {
  return municipios.map((m) => ({ ...m, chaves: [...new Set([m.nome, m.nome_tse].filter(Boolean).map(normaliza))] }));
}

/**
 * Até `max` municípios que casam com o texto. Ordem: nome começa com o texto, depois alguma palavra começa
 * com o texto, depois contém; empate pelo eleitorado (maior primeiro).
 */
export function busca(indice, texto, max = 6) {
  const q = normaliza(texto);
  if (q.length < 2) return [];
  const nota = (m) => {
    let melhor = 9;
    for (const k of m.chaves) {
      if (k === q) melhor = Math.min(melhor, 0);
      else if (k.startsWith(q)) melhor = Math.min(melhor, 1);
      else if (` ${k}`.includes(` ${q}`)) melhor = Math.min(melhor, 2);
      else if (k.includes(q)) melhor = Math.min(melhor, 3);
    }
    return melhor;
  };
  const achados = [];
  for (const m of indice) {
    const n = nota(m);
    if (n < 9) achados.push([n, m]);
  }
  achados.sort((a, b) => a[0] - b[0] || b[1].aptos - a[1].aptos);
  return achados.slice(0, max).map(([, m]) => m);
}
