"""Copia para dados/ só o que o site consome de _pipeline/output/ (gerado por _pipeline/build.py).

Uso (a partir de qualquer pasta):  python webreport/scripts/copia_dados.py
Não copia municipio.json (4,3 MB): o site usa municipio/<UF>.json e municipio/indice.json.
"""
import shutil
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
ORIGEM = SITE.parent / "_pipeline" / "output"
DESTINO = SITE / "dados"
ARQUIVOS = ["meta.json", "nacional.json", "uf.json", "exterior_pais.json", "municipio/*.json",
            "malhas/*.json", "malhas/municipios/*.json"]

assert (ORIGEM / "meta.json").exists(), f"rode antes o pipeline: {ORIGEM} está vazio"
shutil.rmtree(DESTINO, ignore_errors=True)
total = 0
for padrao in ARQUIVOS:
    for arq in sorted(ORIGEM.glob(padrao)):
        alvo = DESTINO / arq.relative_to(ORIGEM)
        alvo.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(arq, alvo)
        total += 1
print(f"{total} arquivos copiados de {ORIGEM} para {DESTINO}")
