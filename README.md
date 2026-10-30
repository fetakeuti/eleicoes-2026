# Webreport — Eleição Presidencial 2026

Site estático de uma página (GitHub Pages) com o resultado da eleição presidencial de 2026, a partir dos dados abertos do TSE.

- Design: `handoff-webreport-2026/` (HANDOFF.md, tokens.css, referencia/).
- Dados: gerados por `../_pipeline/build.py` (contrato em `../_pipeline/CONTRATO_DADOS.md`, decisões em `../_pipeline/DECISOES.md`).

## Atualizar os dados

```
python ../_pipeline/build.py        # gera _pipeline/output/ (exige Python e Node.js)
python scripts/copia_dados.py       # copia para dados/ só o que o site usa
```

## Estrutura

| pasta | conteúdo |
|---|---|
| `dados/` | JSON de dados e malhas TopoJSON copiados do pipeline (não editar à mão) |
| `scripts/` | utilitários de manutenção |

## Publicar no GitHub Pages

O site é publicado da raiz da branch `master`, sem etapa de build. Todos os caminhos são relativos, então ele funciona em `https://<usuario>.github.io/<repositorio>/`. O `.nojekyll` desliga o Jekyll do Pages, que descartaria arquivos começados por `_`.

Primeira vez (repositório vazio criado em github.com/new, sem README):

```
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin master
```

Depois, em Settings → Pages: Source "Deploy from a branch", branch `master`, pasta `/ (root)`. O endereço aparece ali em 1 ou 2 minutos.

Atualizações: `npm test`, commit e `git push`. O teste `tests/pages.e2e.test.js` serve o site numa subpasta e só com os arquivos versionados, como o Pages faz; se ele passa, o que foi para o git é o que o site precisa.
