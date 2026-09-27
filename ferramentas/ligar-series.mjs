// Liga à série lançamentos soltos que o Organizze exporta sem dizer que repetem.
import { uid, somaYm, ymHoje } from "../src/pessoal/logica.js";
const norm = (s) => String(s).trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ym = (iso) => iso.slice(0, 7);
export function ligarSeries(L, log = () => {}) {
  // só do mês passado pra frente: no passado já está tudo pago e os nomes variam demais
  const desde = somaYm(ymHoje(), -1);
  const parcela = (l) => /\d+\s*\/\s*\d+$/.test(l.desc);
  // (a) solto logo ANTES do 1º mês de uma série fixa, mesma categoria, tipo e dia → entra na série
  const series = {};
  for (const l of L) if (l.serie?.tipo === "fixo") (series[l.serie.id] ||= []).push(l);
  for (const itens of Object.values(series)) {
    itens.sort((a, b) => (a.data < b.data ? -1 : 1));
    let primeiro = itens[0];
    for (;;) {
      const antes = somaYm(ym(primeiro.data), -1);
      if (antes < desde) break;
      const c = L.find((l) => !l.serie && !parcela(l) && ym(l.data) === antes && l.catId === primeiro.catId &&
        l.tipo === primeiro.tipo && l.data.slice(8) === primeiro.data.slice(8));
      if (!c) break;
      c.serie = { ...primeiro.serie };
      log(`ligou "${c.desc}" ${c.data} à série "${primeiro.desc}"`);
      primeiro = c;
    }
  }
  // (b) mesmo nome+categoria em 2+ meses SEGUIDOS (1 por mês), ainda solto → vira fixa
  const g = {};
  for (const l of L) if (!l.serie && !parcela(l) && ym(l.data) >= desde) (g[norm(l.desc) + "|" + l.catId + "|" + l.tipo] ||= []).push(l);
  for (const itens of Object.values(g)) {
    if (itens.length < 2) continue;
    itens.sort((a, b) => (a.data < b.data ? -1 : 1));
    const meses = itens.map((l) => ym(l.data));
    if (new Set(meses).size !== itens.length) continue;
    if (!meses.every((m, i) => i === 0 || somaYm(meses[i - 1], 1) === m)) continue;
    const id = uid(), dia = Number(itens[0].data.slice(8));
    for (const l of itens) l.serie = { id, tipo: "fixo", dia };
    log(`nova série fixa "${itens[0].desc}" (${itens.length} meses)`);
  }
  return L;
}
