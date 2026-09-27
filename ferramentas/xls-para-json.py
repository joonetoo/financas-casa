# Lê os .xls exportados do Organizze e imprime um JSON com as linhas (sem repetidas).
# Uso: PYTHONPATH=/tmp/py python3 ferramentas/xls-para-json.py arquivo1.xls arquivo2.xls > organizze.json
import json, sys
import xlrd

rows, vistos = [], set()
for caminho in sys.argv[1:]:
    s = xlrd.open_workbook(caminho).sheet_by_index(0)
    assert s.row_values(0)[:5] == ["Data", "Descrição", "Categoria", "Valor", "Situação"], caminho
    for r in range(1, s.nrows):
        v = s.row_values(r)
        if tuple(v) in vistos:
            continue
        vistos.add(tuple(v))
        rows.append({"data": v[0], "desc": v[1], "cat": v[2], "valor": v[3], "sit": v[4], "obs": v[6]})
json.dump(rows, sys.stdout, ensure_ascii=False)
