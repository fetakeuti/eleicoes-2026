# Webreport — Eleição Presidencial 2026

Site estático de uma página (GitHub Pages) com o resultado da eleição presidencial de 2026, a partir dos dados abertos do TSE.

- Design: `../_webreport/_design/` (HANDOFF.md, tokens.css).
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
