#!/usr/bin/env python3
"""Robozinho do Tesouro Direto (roda sozinho no GitHub, 2x por dia).

O Tesouro publica um arquivo enorme (14 MB) com o preço de todos os títulos
desde 2002. É pesado demais pro celular baixar todo dia, então este robô baixa
o arquivo, guarda só o que a aba Investimentos usa e salva em
dados/tesouro.json (uns poucos KB):

  - o preço de hoje de cada título (quanto o Tesouro paga se você vender hoje);
  - o preço do último dia de cada mês, dos últimos 3 anos (pro gráfico).

Só lê dados públicos do Tesouro; não toca em nenhum dado do Oink.
"""
import csv
import io
import json
import os
import sys
import urllib.request

URL = (
    "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3"
    "/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv"
)
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dados", "tesouro.json")

# nome no arquivo do Tesouro -> nome curto usado no app
TIPOS = {
    "Tesouro IPCA+": "IPCA+",
    "Tesouro IPCA+ com Juros Semestrais": "IPCA+ Juros Semestrais",
    "Tesouro Renda+ Aposentadoria Extra": "Renda+",
    "Tesouro Educa+": "Educa+",
    "Tesouro Selic": "Selic",
    "Tesouro Prefixado": "Prefixado",
    "Tesouro Prefixado com Juros Semestrais": "Prefixado Juros Semestrais",
}
MESES_HISTORICO = 36


def iso(d):  # 29/09/2026 -> 2026-09-29
    dia, mes, ano = d.split("/")
    return f"{ano}-{mes}-{dia}"


def num(s):  # 1.234,56 -> 1234.56
    return float(s.replace(".", "").replace(",", ".")) if s else None


# O arquivo do Tesouro traz a data do ÚLTIMO pagamento. O nome que aparece
# no app do banco é outro: o Renda+ 2055 paga de 2055 a 2074 (vence em 2074)
# e o Educa+ 2030 paga de 2030 a 2034. Então o ano do nome é:
def ano_do_nome(tipo, venc):
    ano = int(venc[:4])
    if tipo == "Renda+":
        return ano - 19
    if tipo == "Educa+":
        return ano - 4
    return ano


def main():
    if len(sys.argv) > 1:  # arquivo local (pra testar)
        bruto = open(sys.argv[1], "rb").read()
    else:
        req = urllib.request.Request(URL, headers={"User-Agent": "oink-robo-tesouro"})
        bruto = urllib.request.urlopen(req, timeout=300).read()
    linhas = list(csv.reader(io.StringIO(bruto.decode("latin-1")), delimiter=";"))
    cab = linhas[0]
    i = {nome: cab.index(nome) for nome in ("Tipo Titulo", "Data Vencimento", "Data Base", "Taxa Venda Manha", "PU Venda Manha")}

    por_titulo = {}
    for l in linhas[1:]:
        if len(l) < len(cab):
            continue
        tipo = TIPOS.get(l[i["Tipo Titulo"]])
        if not tipo:
            continue
        pu = num(l[i["PU Venda Manha"]])
        if not pu:
            continue
        venc = iso(l[i["Data Vencimento"]])
        chave = f"{tipo}|{venc}"
        por_titulo.setdefault(chave, {"tipo": tipo, "venc": venc, "dias": {}})
        por_titulo[chave]["dias"][iso(l[i["Data Base"]])] = (pu, num(l[i["Taxa Venda Manha"]]))

    ultima = max(d for t in por_titulo.values() for d in t["dias"])
    ano, mes = int(ultima[:4]), int(ultima[5:7])
    meses = []
    for _ in range(MESES_HISTORICO):
        meses.append(f"{ano:04d}-{mes:02d}")
        mes -= 1
        if mes == 0:
            ano, mes = ano - 1, 12
    meses = set(meses)

    titulos = {}
    for chave, t in por_titulo.items():
        if ultima not in t["dias"]:
            continue  # título que não está mais à venda / vencido
        pu, taxa = t["dias"][ultima]
        fim_mes = {}
        for d in sorted(t["dias"]):
            if d[:7] in meses:
                fim_mes[d[:7]] = round(t["dias"][d][0], 2)  # o último dia do mês fica por último
        titulos[chave] = {
            "tipo": t["tipo"],
            "venc": t["venc"],
            "nome": f"Tesouro {t['tipo']} {ano_do_nome(t['tipo'], t['venc'])}",
            "pu": round(pu, 2),
            "taxa": taxa,
            "meses": fim_mes,
        }

    if len(titulos) < 10:
        sys.exit(f"Poucos títulos ({len(titulos)}) — arquivo do Tesouro veio estranho, não vou salvar.")

    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump({"data": ultima, "titulos": dict(sorted(titulos.items()))}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"ok: {len(titulos)} títulos, preços de {ultima}")


if __name__ == "__main__":
    main()
