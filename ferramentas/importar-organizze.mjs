// Converte o export do Organizze para a aba "Minhas contas".
//
// Uso (na virada, com export novo):
//   1. No Organizze: Lançamentos > ⋮ > exportar (.xls), um arquivo por período.
//   2. Converter .xls → JSON (o .xls é Excel antigo; precisa do xlrd do Python):
//        python3 -m pip install --target /tmp/py xlrd
//        PYTHONPATH=/tmp/py python3 ferramentas/xls-para-json.py ~/Desktop/movimentacoes_*.xls > /tmp/organizze.json
//   3. node ferramentas/importar-organizze.mjs /tmp/organizze.json /tmp/pessoal.json
//   4. Conferir os totais que ele imprime contra a tela do Organizze, e só então gravar
//      na linha (beta: financas-beta-pessoal; real: financas-pessoal-v1).
//
// O Organizze não exporta o que é "fixo" nem agrupa parcelas: reagrupa as
// parcelas pelo nome ("Macbook 2/12") e as fixas por nome+categoria repetidos.
import fs from "fs";
import { CATEGORIAS_PADRAO } from "../src/pessoal/categorias.js";
import { uid, somaYm, doMes, totais } from "../src/pessoal/logica.js";
import { ligarSeries } from "./ligar-series.mjs";

const [, , entrada, saida] = process.argv;
const rows = JSON.parse(fs.readFileSync(entrada, "utf8"));
const norm = (s) => String(s).trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const categorias = CATEGORIAS_PADRAO.map((c) => ({ id: uid(), ...c }));
const achaCat = (nome, tipo) => {
  const n = norm(nome);
  let c = categorias.find((c) => c.tipo === tipo && norm(c.nome) === n);
  if (!c) {
    c = { id: uid(), tipo, nome: String(nome).trim(), icone: "lista", cor: "#8C959B", arquivada: true };
    categorias.push(c);
    console.log("categoria nova (arquivada):", tipo, c.nome);
  }
  return c.id;
};
const lanc = rows.map((r) => {
  const [d, m, a] = r.data.split(".");
  const tipo = r.valor >= 0 ? "receita" : "despesa";
  return {
    id: uid(), tipo, desc: String(r.desc).trim(), valor: Math.round(Math.abs(r.valor) * 100) / 100,
    data: `${a}-${m}-${d}`, catId: achaCat(r.cat, tipo), pago: r.sit === "Pago", obs: String(r.obs || "").trim(),
  };
});
const ym = (iso) => iso.slice(0, 7);
// parcelas: mesma compra = mesmo nome, N, categoria e mês da 1ª parcela
const grupos = {};
for (const l of lanc) {
  const m = l.desc.match(/^(.*?)\s*(\d+)\s*\/\s*(\d+)$/);
  if (!m) continue;
  const n = +m[2], N = +m[3];
  if (!(n >= 1 && N >= 2 && n <= N)) continue;
  const k = [norm(m[1]), N, l.catId, somaYm(ym(l.data), -(n - 1))].join("|");
  (grupos[k] ||= { id: uid(), itens: [] }).itens.push([l, m[1].trim(), n, N]);
}
for (const g of Object.values(grupos)) {
  const dia = +g.itens[0][0].data.slice(8);
  for (const [l, base, n, N] of g.itens) { l.desc = base; l.serie = { id: g.id, tipo: "parcela", n, total: N, dia }; }
}
// fixas: mesmo nome+categoria em 3+ meses diferentes, no máximo 1 por mês
const fx = {};
for (const l of lanc) if (!l.serie) (fx[norm(l.desc) + "|" + l.catId] ||= []).push(l);
for (const itens of Object.values(fx)) {
  const meses = new Set(itens.map((l) => ym(l.data)));
  if (meses.size < 3 || meses.size !== itens.length) continue;
  const dias = {};
  itens.forEach((l) => (dias[l.data.slice(8)] = (dias[l.data.slice(8)] || 0) + 1));
  const dia = +Object.entries(dias).sort((a, b) => b[1] - a[1])[0][0];
  const id = uid();
  for (const l of itens) l.serie = { id, tipo: "fixo", dia };
}
ligarSeries(lanc, (m) => console.log("  " + m));
const doc = { v: 1, importadoDe: "Organizze", categorias, lancamentos: lanc };
fs.writeFileSync(saida, JSON.stringify(doc));
console.log("lançamentos:", lanc.length);
const meses = [...new Set(lanc.map((l) => ym(l.data)))].sort();
for (const m of meses) console.log(m, JSON.stringify(totais(doMes(lanc, m))));
