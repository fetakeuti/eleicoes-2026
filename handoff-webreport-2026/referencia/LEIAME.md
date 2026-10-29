# Referência HTML/CSS/JS

Implementação de referência, sem build e sem dependências, das telas principais:

- 0 · Resultado
- 1 · Comparação 1º × 2º turno
- 2 · Mapa por UF: métricas, modo variação, ranking com 3 ordens e contorno duplo
- 3 · Brancos e nulos
- Sobre os dados e rodapé

## Como rodar

```bash
cd referencia
python -m http.server 8000
# abrir http://localhost:8000
```

O `fetch` não funciona abrindo o arquivo direto (`file://`). No GitHub Pages funciona como está.

## Dados

`data/` tem cópias de `meta.json`, `nacional.json` e `uf.json`. No projeto, aponte para a saída do pipeline (`_pipeline/output/`) ou copie esses arquivos no deploy.

## O que fica fora desta referência

Estas partes estão especificadas no `HANDOFF.md` e desenhadas no canvas:

- Mapa-múndi (prancha 5)
- Drill-down de municípios com busca e zoom (prancha 7)
- Folha inferior dos mapas no mobile (prancha 9)

A comparação entre turnos já vira cartões no mobile.

## Ajustes conhecidos

- `geo/brasil-uf-simplificado.json` usa contornos de @svg-maps/brazil (CC BY 4.0) só para a referência. Troque pela malha do IBGE.
- O SVG do mapa é redesenhado a cada hover. Funciona, mas perde o foco do teclado. Na implementação final, atualize só os atributos (ou use ECharts/MapLibre).
- O texto de “Sobre os dados” vem cru de `meta.definicoes`, com nomes de colunas do TSE. Revise a redação para o público leigo.
