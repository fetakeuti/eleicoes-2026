/* 5 · Sobre os dados e rodapé (HANDOFF §6). Texto em linguagem simples; os números vêm do dado. */

import { slot, esc } from '../comum.js';
import { inteiro } from '../formato.js';
import { naoInstalados } from '../regras.js';

// Versão em linguagem simples das conferências do pipeline (meta.validacoes traz a versão técnica)
const CONFERENCIAS = [
  'A soma das 27 UFs e do exterior dá exatamente o total do Brasil, nos dois turnos e para cada candidato.',
  'A soma dos 5.571 municípios e dos países do exterior também dá o total do Brasil.',
  'O total do Brasil, o do exterior e o de cada UF conferem com o Relatório Resultado da Totalização, o PDF oficial do TSE.',
  'Em cada município, os votos dos candidatos somam os votos válidos, e válidos + brancos + nulos somam o comparecimento.',
  'Todo município tem contorno no mapa, e todo país do exterior aparece no mapa-múndi, como área ou como ponto.',
];

export function renderSobre({ meta, nacional }) {
  const t1 = nacional.turnos['1'];
  const tecnicos = (/(\d{1,3}(?:\.\d{3})+) votos/.exec(meta.definicoes.nulos) || [])[1];
  const fora = naoInstalados(t1);
  const itens = [
    ['Votos válidos', 'São os votos dados a um candidato. O percentual de cada candidato é calculado só sobre eles, como faz a Justiça Eleitoral para definir o vencedor.'],
    ['Brancos e nulos', 'Não contam para nenhum candidato. Aqui, o percentual deles é calculado sobre o total de votos (válidos + brancos + nulos), como no relatório oficial do TSE.'],
    ['Nulos técnicos', `No 1º turno, ${tecnicos || 'parte dos'} votos foram para o candidato nº 28, cuja candidatura terminou em renúncia. A Justiça Eleitoral os conta como nulos, e eles estão somados aos nulos.`],
    ['Comparecimento e abstenção', 'Comparecimento é quem votou; abstenção é quem estava apto e não votou. As duas taxas são calculadas sobre a soma das duas e, juntas, dão 100%, como no relatório do TSE.'],
    ['Eleitorado apto', `Algumas seções no exterior não foram instaladas por terem menos de 30 eleitores. Os ${inteiro(fora)} eleitores dessas seções contam como aptos, mas não como abstenção. Por isso o eleitorado apto é um pouco maior que comparecimento + abstenção.`],
    ['Exterior', 'Os votos de brasileiros no exterior aparecem separados do mapa do Brasil e são agrupados por país. Em 4 cidades o país não pôde ser confirmado pelo endereço do local de votação; elas levam um aviso no mapa-múndi.'],
    ['Médias', 'Nenhuma taxa deste site é média de outras taxas: em todo nível (Brasil, UF, município, país), os números inteiros são somados e o percentual é recalculado.'],
  ];
  const fontes = meta.fontes.filter((f) => f.dt_geracao || f.gerado_em);
  slot('sobre').innerHTML = `
    <dl class="definicoes">${itens.map(([t, x]) => `<dt>${esc(t)}</dt><dd>${esc(x)}</dd>`).join('')}</dl>
    <div>
      <h3>O que foi conferido</h3>
      <ul class="lista-sobre">${CONFERENCIAS.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    </div>
    <details class="tecnico">
      <summary>Detalhes técnicos: arquivos de origem e conferências</summary>
      <ul class="lista-sobre">
        ${fontes.map((f) => `<li><code>${esc(f.arquivo)}</code>: ${esc(f.uso)}, gerado em ${esc([].concat(f.dt_geracao || f.gerado_em).join(' e '))}.</li>`).join('')}
        ${meta.validacoes.map((v) => `<li>${esc(v)}</li>`).join('')}
      </ul>
    </details>`;
}

export function renderRodape({ meta }) {
  const tse = meta.fontes.filter((f) => f.dt_geracao).flatMap((f) => f.dt_geracao);
  const diasTse = [...new Set(tse.map((d) => d.split(' ')[0]))].join(' e ');
  const [dia, hora] = meta.gerado_em.split(' ');
  slot('rodape').innerHTML = `
    <p>Fonte: Tribunal Superior Eleitoral (TSE), Portal de Dados Abertos. Cargo Presidente, 1º e 2º turnos de 2026, conferido com o Relatório Resultado da Totalização.</p>
    <p>Arquivos do TSE gerados em ${esc(diasTse)}. Dados processados em ${esc(dia)} às ${esc(hora.slice(0, 5))}.</p>
    <p>${esc(meta.aptos.rodape)}</p>
    <p>Malhas: IBGE, Malha Municipal Digital 2025 (Brasil e municípios), e Natural Earth 1:50m (mundo). O mapa não expressa posição sobre fronteiras.</p>
    <p><a href="#sobre">Como cada número foi calculado</a></p>`;
}
