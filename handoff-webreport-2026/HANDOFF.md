# Handoff — Webreport Eleição Presidencial 2026

Material para implementar no Claude Code. Base visual: **Direção A · Caderno**. Telas de referência: canvas de design “Webreport Eleição Presidencial 2026” (pranchas 1 a 11). Dados: os cinco JSONs de `_pipeline/output/`, conforme `CONTRATO_DADOS.md`.

Arquivos deste pacote:

| arquivo | o que é |
|---|---|
| `tokens.css` | todas as variáveis CSS (cores, tipo, espaço, raios, sombras) |
| `HANDOFF.md` | este documento |
| `referencia/` | HTML/CSS/JS de referência, funcional, com Resultado, Comparação, Mapa por UF, Brancos e nulos e rodapé lendo os JSONs reais |

---

## 1. Arquitetura

- Site estático, uma página (`index.html`), hospedado no GitHub Pages.
- Seções em ordem: **0 Resultado → 1 Comparação 1º × 2º turno → 2 Mapa do Brasil → 3 Brancos e nulos → 4 Exterior → 5 Sobre os dados → rodapé**.
- Navegação por âncoras com scroll-spy. Estado do mapa na URL: `#mapa?t=2&m=venc&uf=SP&mun=3547809`, e `#exterior?t=2&m=abst&pais=LBY`. O botão Voltar do navegador desfaz o drill-down.
- Carga:
  - imediata: `meta.json`, `nacional.json`, `uf.json` (~10 KB gzip) + malha de UFs;
  - quando a seção Exterior entra na tela: `exterior_pais.json` (29 KB gzip) + malha mundial;
  - no primeiro clique numa UF: municípios daquela UF.
- **Pedido ao pipeline:** gerar `municipio/<UF>.json` (e a malha IBGE por UF). Maior arquivo: MG com 135 KB gzip; SP 104 KB; RR 3 KB. Hoje o `municipio.json` inteiro tem 0,9 MB gzip.
- Bibliotecas sugeridas: **ECharts** (barras e choropleths com GeoJSON registrado) ou **MapLibre GL** só para os mapas. A referência usa SVG puro para ficar legível; troque à vontade, mas mantenha as regras deste documento.

## 2. Regras de dado que viram regra de interface

- % de candidato = `pct_validos` (sobre válidos). % de brancos e nulos = `pct_brancos` / `pct_nulos` (sobre total de votos). Comparecimento e abstenção = `taxa_comparecimento` / `taxa_abstencao` (denominador comparecimento + abstenção, padrão TSE).
- Ao reagrupar (ex.: GUF→FRA, se um dia agregar), **some os inteiros e recalcule**; nunca média de taxas.
- Ordem de candidatos: `meta.ordem_candidatos[turno]`. Rótulo: `meta.candidatos[].nome_urna` (ex.: “FLAVIO BOLSONARO”, sem acento, como no TSE).
- Vencedor e empate por **votos inteiros** (`votos`), não pelo % arredondado. Casos reais de empate: Marquinho (PR), 2º turno, 1.530 × 1.530; Guiné-Bissau, 1º turno, 17 × 17.
- Formato numérico pt-BR: milhar com ponto, decimal com vírgula, % com 2 casas. Variação com sinal: “+1,86 p.p.”, “−870.302” (sinal de menos U+2212).
- Percentual < 0,005 com votos > 0 chega como `0.0`: exibir “< 0,01%”. Com 0 voto: “0 voto”. São 488 casos no 1º turno municipal.
- `null` em taxa/percentual: exibir “—”, nunca 0%.
- `sem_comparecimento: true` (país ou cidade): estado “Sem votantes”, hachura. Há dois sabores no dado, mesmo visual, texto diferente no tooltip:
  - seção não instalada: taxas `null` (ex.: Paquistão, 18 aptos) → “abstenção —”;
  - instalada sem votantes: `taxa_abstencao = 100` (ex.: Líbia, 2º turno, 30 aptos).
- Base pequena: país/cidade com 0 < comparecimento < 30 mostra aviso “Base muito pequena: N votantes” (12 países no 2º turno).
- `confianca: "baixa"` mostra aviso; o texto vem de `meta.cidades_baixa_confianca[].motivo` (resumido). Trípoli tem nota fixa: “os eleitores desta seção votaram na Embaixada do Brasil em Túnis, na Tunísia. O voto é contado na Líbia.”
- Nomes de município: usar o nome da malha do IBGE quando houver (13 grafias diferem; ex.: São Tomé das Letras). `cd_ibge` é a chave de junção.
- Exterior (`uf = "ZZ"`) **fora** do mapa e da escala do Brasil; aparece numa faixa abaixo do mapa.

## 3. Componentes e estados

Estados comuns: **padrão · hover (desktop) / toque (mobile) · foco de teclado · selecionado · desabilitado · vazio · carregando · erro**. Foco: `outline: var(--foco); outline-offset: var(--foco-offset)` em tudo que é clicável. Desabilitado: `opacity: .4; cursor: not-allowed; aria-disabled="true"`.

| componente | uso | estados e detalhes |
|---|---|---|
| **Barra fixa + nav** | topo | Desktop: título + 5 âncoras + “Sobre os dados”. Item ativo: sublinhado 2px tinta. Mobile: 52 px + faixa de chips com rolagem horizontal, chip ativo preenchido (tinta, texto branco). |
| **Controle segmentado** | Turno, Métrica, Unidade da variação, Mapa/Lista | Borda 1px tinta, raio 2px, altura 40 (mobile 36–40). Ativo: fundo tinta, texto branco, `aria-pressed="true"`. Hover: fundo `--cor-realce`. Desabilitado: ex. “% de um candidato” sem dado. |
| **Pílula** | candidato no mapa, ordem do ranking | Altura 36–40, raio pílula, borda `--cor-linha`; ativa: borda tinta + fundo realce (candidato) ou fundo tinta (ordem). Candidato leva bolinha de 10px na cor fixa. |
| **Botão** | “Voltar para as UFs”, “Tentar de novo”, “Ver municípios” | Secundário: borda tinta, fundo branco. Primário (mobile): fundo tinta, texto branco. Altura ≥ 44. |
| **Busca + sugestões** | país/cidade, município | Input 44 px, `type="search"`, label visível. Sugestões a partir de 2 letras, até 6, `role="listbox"`, setas + Enter, Esc fecha. Normaliza acento, caixa, hífen e apóstrofo (“xique xique” → Xique-Xique). Vazio: “Nenhum município com esse nome…”. Município de outra UF: troca a UF sozinho. |
| **KPI** | Resultado, Brancos e nulos | Rótulo caixa alta 11px, número Newsreader 40px tabular, linha de variação 13px. Sem cor de “bom/ruim”. |
| **Barra de resultado** | Resultado | Duas cores fixas, gap 2px, marca vertical de 50%. Rótulos acima, nunca dentro da barra estreita. |
| **Linha de candidato — finalista** | Comparação | Nome + nº · partido · situação; barra 1º turno (claro, 10px) sobre barra 2º turno (cheio, 14px); escala 0–60%, marca de 50% em 83,33%; colunas 1º, 2º, Variação (fundo realce). |
| **Linha de candidato — eliminado** | Comparação | Recolhida por padrão (botão com `aria-expanded`); barra cinza com mínimo 2px; 2º turno “não disputou”. Mobile: uma linha, nome quebra, % à direita. |
| **Tabela de participação** | Comparação | Linhas: Eleitorado apto, Comparecimento, Abstenção, Válidos, Brancos, Nulos. Número + taxa; coluna Variação em destaque. Mobile: rolagem horizontal dentro da caixa. |
| **Barra de composição** | Comparação, Brancos e nulos | Válidos / brancos / nulos / abstenção (hachura). Brancos e nulos têm também a vista ampliada 0–5%. |
| **Choropleth** | UF, município, mundo | Ver seção 4. Padrão: borda branca 0,8 (mundo 0,5). Hover/selecionado: **contorno duplo** (halo branco 5,5 + linha tinta 2; selecionado 2,5) desenhado numa camada por cima. Selecionado em drill-down: demais a 35% de opacidade. Carregando: polígonos cinza claros + barra de progresso. Erro: mensagem + “Tentar de novo”, mapa de UF continua. |
| **Painel de detalhe** | ao lado do mapa (desktop) | Vazio = total (Brasil ou UF). Hover mostra; clique fixa. No modo variação: “1º → 2º” + diferença. |
| **Tooltip** | desktop | Fundo tinta (rótulo curto) ou branco com borda tinta (exterior, com cidades). Abre fora da forma: à direita do bbox do país, ou à esquerda se não couber; no município, acima do bbox. Máx. 240px (rótulo) / 340px (exterior). Nome quebra, nunca reticências. |
| **Folha inferior** | mobile | Substitui hover/tooltip. Raio 16 no topo, alça 40×4. Meia altura ao tocar; arrastar para cima = tela cheia com rolagem. O mapa se desloca para a área tocada ficar acima da folha. |
| **Ranking / lista** | lado do mapa; no mobile é a aba “Lista” | Linha clicável (é `<button>`), hover/foco destaca no mapa. Ordem: “LULA primeiro”, “FLAVIO primeiro”, “sem candidato” (|valor|) para métricas com lado; “maior/menor” para as demais. |
| **Legenda** | sob cada mapa | Blocos de classe com rótulo; título diz métrica + turno; nota diz o domínio. Estados especiais (hachura, sem eleitorado, empate, ponto) só aparecem quando existem na visão. |
| **Aviso** | tooltip/folha | Fundo realce, 12px. Tipos: confiança baixa, Trípoli, sem votantes, base pequena, empate. |
| **Trilha (breadcrumb)** | drill-down | `nav > ol`, “Brasil › São Paulo › Santo André”; itens anteriores são links. |
| **Controles de zoom** | mapas | +, −, enquadrar; 44×44; pinça no mobile. |
| **Rodapé** | todas as larguras | Fundo tinta. Fonte, data (`meta.gerado_em`), texto de `meta.aptos.rodape` na íntegra, malhas e nota de fronteiras. |

## 4. Especificação dos mapas

### 4.1 Classes e cores (limite inferior incluso: `v >= corte` sobe de classe)

| métrica | valor | cortes | cores |
|---|---|---|---|
| Vencedor e margem (UF, município, mundo) | margem = |%L − %F| (p.p. de válidos), cor do vencedor | 5 · 15 · 25 · 35 | `--rampa-13-1…5` ou `--rampa-22-1…5`; empate `--mapa-empate` |
| % de um candidato (só UF) | `pct_validos[nr]` | 5 classes iguais de 0 a d<sub>max</sub>; d<sub>max</sub>: 13 e 22 = 80; 55 = 15; 70 e 14 = 5 | rampa do candidato; eliminados usam `--rampa-demais` |
| Abstenção — Brasil (UF e município) | `taxa_abstencao` | 16 · 18 · 20 · 22 · 24 | `--abst-br-1…6`. Domínio fixo nos dois turnos. UFs vão de 13,89 a 26,08; municípios de 6,88 a 41,01 (caem nas classes das pontas). |
| Abstenção — exterior | `taxa_abstencao` | 40 · 50 · 60 · 70 · 80 | `--abst-ext-1…6` (matiz diferente de propósito). Países de 36,79 a 100. |
| Mudança de vencedor | líder 1º × vencedor 2º | categórico | `--manteve-13/22`, `--virou-13/22` + contorno tinta 2px em quem virou (UF: só MG; SP municipal: 33). |
| Deslocamento da margem | (L2−F2) − (L1−F1), p.p. | −6 · −4 · −2 · 0 · 2 · 4 · 6 | `--div-margem-1…8` (− FLAVIO, + LULA). UFs: +2,34 (RO) a +7,40 (RJ). |
| Variação da abstenção | taxa 2º − taxa 1º, p.p. | −6 · −4 · −2 · 0 · 2 · 4 · 6 | `--div-abst-1…8`. UFs: −3,26 (BA) a +8,06 (AP). |
| Votantes (só mundo) | comparecimento | círculo de área proporcional, r = √(c / 87.407) × 30 (viewBox 1000), mín. 1,5 | cor do vencedor; mapa de fundo `--mapa-neutro` |

Precedência no preenchimento: **sem votantes (hachura) > empate > classe da métrica**. País fora do dataset: `--mapa-sem-eleitorado`, sem interação.

### 4.2 Interação

- Desktop: hover destaca (contorno duplo) e atualiza painel/tooltip; clique fixa; clicar de novo solta. Sair do mapa limpa o hover, mantém o fixado.
- UF → municípios: clique na UF abre o drill-down (carrega municípios da UF), enquadra a UF, mostra a trilha e “← Voltar para as UFs”. Mesmas métricas e cortes do nível UF.
- Município minúsculo (bbox < 6 px² na escala atual; ex.: Águas de São Pedro): ponto com borda tinta, raio 3,5/√zoom, área de toque 24px.
- Ranking e lista são o caminho acessível: cada linha é botão, foco do teclado = hover.
- Mobile: toque = seleção + folha inferior; sem hover. Zoom por pinça e botões. Aba “Mapa | Lista”.
- Teclado: Tab percorre controles, lista e polígonos (`tabindex="0"`, `role="button"`, `aria-label="São Paulo: FLAVIO 53,85%…"` no SVG, ou lista equivalente).

### 4.3 Malhas e territórios

- Brasil: malha do IBGE (UF e municípios), junção por `cd_ibge`. Simplificar por UF (mapshaper, ~10–20%) mantendo topologia.
- Mundo: **Natural Earth 1:50m** (`world-atlas/countries-50m.json`, ids ISO numéricos → converter para ISO3). Usar `iso3` granular; **não** usar `iso3_agregacao`.
  - **Guiana Francesa (GUF):** no Natural Earth ela é parte do MultiPolygon da França. No build, separar o(s) polígono(s) com centróide na América do Sul em uma feição GUF. Motivo: faz fronteira com o Brasil e tem resultado próprio (51,55% LULA no 2º turno, com Caiena e St. Georges); agregada, pintaria a França com o voto de Caiena.
  - **Hong Kong (HKG):** tem polígono na 1:50m (id 344), mas some na escala mundial: desenhar como ponto, como os 8 países sem polígono na 1:110m (Singapura, Hong Kong, Cabo Verde, Bahrein, Antígua e Barbuda, Barbados, Santa Lúcia, São Tomé e Príncipe). Não agregar a CHN: resultados opostos (48,85% × 73,67% LULA).
  - **Taiwan (TWN):** polígono próprio (id 158); `iso3_agregacao` já é TWN. Nada a fazer.
  - **Palestina (PSE):** polígono próprio na 1:50m e 1:110m (id 275); `iso3_agregacao` já é PSE.
  - Nomes como no TSE, nota no rodapé: “O mapa não expressa posição sobre fronteiras.”
- Projeção do mundo: Equal Earth, sem Antártida.

## 5. Breakpoints

| faixa | layout |
|---|---|
| **≥ 1200 px** | desktop: conteúdo 1200 (texto) / 1280 (mapas); mapa + coluna lateral de 340 px (painel + ranking) |
| **768–1199 px** | tablet: coluna lateral desce para baixo do mapa, painel e ranking lado a lado (`flex-wrap`); tabelas mantêm colunas |
| **< 768 px** | mobile: nav em chips; KPIs em lista; finalistas em cartão, eliminados em linha única; mapas com folha inferior e aba Mapa/Lista; tabela de participação rola na horizontal; gutter 16 |
| **mín. 320 px** | nada pode estourar a largura; nomes quebram (`overflow-wrap: anywhere`) |

Implementação: `flex: 999 1 640px` no mapa e `flex: 1 1 340px` na lateral já dão a quebra natural; grades com `repeat(auto-fit, minmax(min(340px, 100%), 1fr))`.

## 6. Mapeamento elemento → campo do contrato

`T` = `turnos[t]` do nível em questão (`nacional`, `uf.ufs[i]`, `municipio.municipios[i]`, `exterior_pais.paises[i]`, `…cidades[j]`).

| elemento | campo(s) |
|---|---|
| Manchete e barra do Resultado | `nacional.turnos["2"].pct_validos`, `.votos`; nome e partido em `meta.candidatos[nr].nome_urna/partido`; “eleito” em `situacao_2t` |
| Diferença em votos | `votos["13"] − votos["22"]` (2º turno) |
| “No 1º turno a ordem foi a inversa” | `nacional.turnos["1"].pct_validos` + `meta.ordem_candidatos["1"]` |
| KPI Comparecimento / Abstenção | `T.taxa_comparecimento`, `T.taxa_abstencao`, `T.abstencao`; variação = turno 2 − turno 1 |
| KPI Brancos e nulos | `(T.brancos + T.nulos) / T.total_votos × 100` (recalculado dos inteiros) |
| Finalistas / eliminados | `meta.ordem_candidatos["1"]` menos `["2"]` = eliminados; `T.votos[nr]`, `T.pct_validos[nr]`; situação em `meta.candidatos[].situacao_1t/2t` |
| Soma dos eliminados | Σ `votos[nr]` dos eliminados; % = soma / `T.validos` |
| Tabela de participação | `T.aptos`, `comparecimento`, `abstencao`, `validos`, `brancos`, `nulos`, `taxa_*`, `pct_brancos`, `pct_nulos`; % de válidos = `validos / total_votos` |
| Barra de composição | denominador `comparecimento + abstencao`; partes `validos`, `brancos`, `nulos`, `abstencao` |
| Nota de nulos técnicos | `meta.definicoes.nulos` (5.246 votos no nº 28) |
| Mapa UF | `uf.ufs` filtrado `uf != "ZZ"`; chave `uf` ↔ sigla na malha |
| Faixa “Exterior” sob o mapa | `uf.ufs[uf="ZZ"]` |
| Mapa municipal | `municipio.municipios` por `uf`; chave `cd_ibge` ↔ código IBGE da malha; nome da malha, `nome` do TSE como alternativa |
| Busca de município | nome da malha (ou `nome`), `uf`, `T.aptos` para ordenar |
| Mapa-múndi | `exterior_pais.paises[].iso3` ↔ ISO numérico da malha (GUF separado no build); `T.*` do país |
| Tooltip do país | `pais`, `n_cidades`, `T.aptos`, `T.votos`, `T.pct_validos`, `T.comparecimento`, `T.taxa_abstencao`; cidades em `cidades[]` com o mesmo bloco |
| Sem votantes | `T.sem_comparecimento` (país e cidade) |
| Aviso de confiança | `confianca == "baixa"` + `meta.cidades_baixa_confianca` |
| Nota de Trípoli | cidade `TRÍPOLI`, `iso3 = LBY` (texto fixo, baseado em `meta.cidades_baixa_confianca[].motivo`) |
| Rodapé | `meta.gerado_em`, `meta.fontes[].dt_geracao`, `meta.aptos.rodape` |
| Sobre os dados | `meta.definicoes`, `meta.fontes`, `meta.validacoes` |

## 7. Checklist de aceite

- [ ] Nenhum hex fora de `tokens.css`.
- [ ] LULA sempre `--cand-13`, FLAVIO sempre `--cand-22`, em todas as visões e larguras.
- [ ] Soma das UFs = nacional (validação do pipeline); front nunca faz média de taxas.
- [ ] Exterior fora da escala do Brasil; abstenção do exterior com rampa própria.
- [ ] Hachura para `sem_comparecimento`; “—” para `null`; “< 0,01%” e “0 voto” corretos.
- [ ] Empate decidido por votos inteiros.
- [ ] Tooltip nunca cobre a forma apontada; no mobile, folha inferior.
- [ ] Alvos de toque ≥ 44 px; contraste ≥ 4,5:1 no texto.
- [ ] Rodapé completo em todas as larguras.
