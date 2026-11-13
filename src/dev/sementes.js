// Dados INVENTADOS pro modo de pré-visualização (ver supaFalso.js).
// Nada aqui foi copiado de dado real: nomes, valores e datas são de mentira.
// As datas são calculadas na hora (data LOCAL), então o mês de hoje sempre tem
// o que mostrar. Cada bloco segue o FORMATO REAL da linha correspondente.

import { CATEGORIAS_PADRAO } from "../pessoal/categorias.js";

const p2 = (n) => String(n).padStart(2, "0");
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const r2 = (v) => Math.round(v * 100) / 100;

// "AAAA-MM" do mês de hoje + n
function ymMais(base, n) {
  const total = base.getFullYear() * 12 + base.getMonth() + n;
  return `${Math.floor(total / 12)}-${p2((total % 12) + 1)}`;
}
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
// dia do mês `n` meses a partir de hoje (dias até 28: existem em todo mês)
const dia = (base, n, d) => `${ymMais(base, n)}-${p2(d)}`;

/* ------------------------------------------------------------------ */
/* Contas da casa — { anos: [{ id, label, months: [...] }] }           */
/* ------------------------------------------------------------------ */

const CATS_CASA = ["contasCasa", "servicos", "mercado", "feira", "combustivel", "meusGastos", "comprasCasa", "investimentos"];
const itens = (prefixo, lista, campo) => lista.map(([nome, valor], i) => ({ id: `${prefixo}-${i + 1}`, [campo]: nome, valor }));

const CONTAS_FIXAS = [["Aluguel", 1450.0], ["Condomínio", 520.0], ["Energia", 148.9], ["Água", 96.4], ["Gás", 62.0]];
const SERVICOS = [
  ["Internet fibra", 119.9], ["Streaming de filmes", 55.9], ["Música em família", 34.9],
  ["Armazenamento na nuvem", 9.99], ["Academia do bairro", 129.9], ["Seguro do carro", 189.0],
];

function mesCasa(id, label, { contas, servicos, orc, lanc, antonio }) {
  const soma = (l) => l.reduce((s, [, v]) => s + v, 0);
  const previsto = soma(contas) + soma(servicos) + Object.values(orc).reduce((s, v) => s + v, 0);
  const lancamentos = {};
  for (const k of CATS_CASA) lancamentos[k] = itens(`${id}-${k}`, lanc[k] || [], "desc");
  return {
    id,
    label,
    joel: r2(previsto - antonio),
    antonio,
    contasCasaItems: itens(`${id}-conta`, contas, "name"),
    servicosItems: itens(`${id}-serv`, servicos, "name"),
    orcamentos: { servicos: r2(soma(servicos)), mercado: 0, feira: 0, combustivel: 0, meusGastos: 0, comprasCasa: 0, investimentos: 0, ...orc },
    lancamentos,
  };
}

// mês já fechado: tudo lançado, com uma variaçãozinha pra o gráfico não ficar reto
function mesCasaFechado(id, label, k) {
  const contas = CONTAS_FIXAS.map(([n, v], i) => [n, i < 2 ? v : r2(v * (0.9 + ((k * 7 + i * 3) % 9) / 40))]);
  const mercado = r2(1180 + ((k * 137) % 260));
  const feira = r2(210 + ((k * 53) % 90));
  const comb = r2(280 + ((k * 71) % 130));
  const credito = r2(320 + ((k * 97) % 240));
  const compras = k % 3 === 0 ? r2(140 + ((k * 31) % 120)) : 0;
  return mesCasa(id, label, {
    contas,
    servicos: SERVICOS,
    antonio: 1800,
    orc: { mercado: 1400, feira: 320, combustivel: 400, meusGastos: 600, comprasCasa: compras ? 250 : 0, investimentos: 300 },
    lanc: {
      contasCasa: contas,
      servicos: SERVICOS,
      mercado: [["Compra grande do mês", r2(mercado * 0.6)], ["Reposição da semana", r2(mercado * 0.4)]],
      feira: [["Feira de sábado", r2(feira / 2)], ["Hortifrúti", r2(feira / 2)]],
      combustivel: [["Tanque cheio", r2(comb * 0.7)], ["Estacionamento", r2(comb * 0.3)]],
      meusGastos: [["Fatura do crédito", credito]],
      comprasCasa: compras ? [["Coisas pra casa", compras]] : [],
      investimentos: [["Caixinha da casa", 300]],
    },
  });
}

// Mês de HOJE — um estado de cada no Resumo:
//   contasCasa   folga (70%): Aluguel e Energia lançados; os outros ficam em "ainda não lançados"
//   servicos     exatamente NO LIMITE (gasto == orçamento)
//   mercado      ESTOURADA (vermelha): 1.532,47 de 1.400
//   feira        folga (56%)
//   combustivel  AMARELA (87,5%): 350 de 400
//   meusGastos   folga (36%)                       ("Meu crédito")
//   comprasCasa  folga (36%)
//   investimentos sem orçamento e sem gasto → "1 categoria sem orçamento definido"
function mesCasaDeHoje(id, label) {
  return mesCasa(id, label, {
    contas: CONTAS_FIXAS,
    servicos: SERVICOS,
    antonio: 1800,
    orc: { mercado: 1400, feira: 320, combustivel: 400, meusGastos: 600, comprasCasa: 250, investimentos: 0 },
    lanc: {
      contasCasa: [["Aluguel", 1450.0], ["Energia", 148.9]],
      servicos: SERVICOS,
      mercado: [
        ["Compra grande do mês", 684.32], ["Atacado: carnes e limpeza", 412.9], ["Reposição da semana", 268.75], ["Padaria e frios", 166.5],
      ],
      feira: [["Feira de sábado", 96.0], ["Hortifrúti do bairro", 84.0]],
      combustivel: [["Tanque cheio", 240.0], ["Meio tanque", 85.0], ["Estacionamento do centro", 25.0]],
      meusGastos: [["Farmácia", 58.4], ["Livro de receitas", 79.9], ["Cinema a dois", 76.0]],
      comprasCasa: [["Jogo de panelas em promoção", 89.9]],
    },
  });
}

function casa(hoje) {
  const ano = hoje.getFullYear();
  const mesAtual = hoje.getMonth(); // 0..11
  const passado = [9, 10, 11].map((m, i) => mesCasaFechado(`mes-${ano - 1}-${p2(m + 1)}`, MESES[m], i + 1));
  const atual = [];
  for (let m = 0; m <= mesAtual; m++) {
    const id = `mes-${ano}-${p2(m + 1)}`;
    atual.push(m === mesAtual ? mesCasaDeHoje(id, MESES[m]) : mesCasaFechado(id, MESES[m], m + 4));
  }
  return {
    anos: [
      { id: `ano-${ano - 1}`, label: String(ano - 1), months: passado },
      { id: `ano-${ano}`, label: String(ano), months: atual },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Minhas contas — { v, categorias, lancamentos }                      */
/* ------------------------------------------------------------------ */

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// um pedaço genérico das categorias padrão (mesmo ícone e cor), com ids fixos…
const DAS_PADRAO = [
  ["despesa", "Alimentação"], ["despesa", "Assinaturas e serviços"], ["despesa", "Carro"], ["despesa", "Casa"],
  ["despesa", "Compras"], ["despesa", "Cuidados pessoais"], ["despesa", "Educação"], ["despesa", "Mercado"],
  ["despesa", "Saúde"], ["despesa", "Transporte"], ["despesa", "Viagem"], ["despesa", "Outros"],
  ["despesa", "Lazer e hobbies"], // arquivada
  ["receita", "Outras receitas"], ["receita", "Investimentos"],
];
// …e algumas próprias
const PROPRIAS = [
  { id: "cat-pets", tipo: "despesa", nome: "Pets", icone: "pata", cor: "#D9A55D", arquivada: false },
  { id: "cat-presentes", tipo: "despesa", nome: "Presentes", icone: "presente", cor: "#D6457A", arquivada: false },
  { id: "cat-salario", tipo: "receita", nome: "Salário", icone: "cifrao", cor: "#1E7A55", arquivada: false },
  { id: "cat-freelas", tipo: "receita", nome: "Trabalhos por fora", icone: "subida", cor: "#3DB86B", arquivada: false },
];

function categoriasPessoal() {
  const padrao = DAS_PADRAO.map(([tipo, nome]) => {
    const c = CATEGORIAS_PADRAO.find((x) => x.tipo === tipo && x.nome === nome);
    return { id: `cat-${tipo === "receita" ? "r-" : ""}${slug(nome)}`, ...c };
  });
  return [...padrao, ...PROPRIAS].sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome, "pt-BR") : a.tipo === "despesa" ? -1 : 1));
}

export const ID_NOME_LONGO = "lanc-nome-longo";
export const NOME_LONGO = "Conserto da máquina de lavar com troca da bomba de drenagem e visita técnica no fim de semana";

function pessoal(hoje) {
  const hojeIso = iso(hoje);
  const lancs = [];
  const por = (l) => lancs.push({ obs: "", ...l });

  // séries "todo mês" (fixo): do mês −3 ao mês +6. O mês −4 fica VAZIO de propósito.
  const FIXOS = [
    ["salario", "receita", "Salário — Estúdio Aurora", 5200.0, "cat-salario", 5],
    ["casa", "despesa", "Minha parte das contas da casa", 1600.0, "cat-casa", 5],
    ["ingles", "despesa", "Curso de inglês", 280.0, "cat-educacao", 8],
    ["celular", "despesa", "Plano de celular", 59.9, "cat-assinaturas-e-servicos", 10],
    ["academia", "despesa", "Academia Corpo Leve", 119.9, "cat-cuidados-pessoais", 10],
    ["streaming", "despesa", "Streaming de séries", 39.9, "cat-assinaturas-e-servicos", 15],
    ["saude", "despesa", "Plano de saúde", 389.0, "cat-saude", 20],
  ];
  for (const [chave, tipo, desc, valor, catId, d] of FIXOS) {
    for (let n = -3; n <= 6; n++) {
      const data = dia(hoje, n, d);
      // o curso de inglês deste mês ficou em aberto (pra ter "a pagar" atrasado)
      const pago = data <= hojeIso && !(chave === "ingles" && n === 0);
      por({ id: `fx-${chave}-${ymMais(hoje, n)}`, tipo, desc, valor, data, catId, pago, serie: { id: `serie-${chave}`, tipo: "fixo", dia: d } });
    }
  }

  // parcelados: [chave, nome, valor, categoria, dia, total, nº da parcela NESTE mês]
  const PARCELAS = [
    ["notebook", "Notebook novo", 649.9, "cat-compras", 12, 6, 4], // "4 de 6"
    ["sofa", "Sofá da sala", 189.0, "cat-casa", 18, 10, 2], // "2 de 10"
    ["ferias", "Passagens das férias", 412.33, "cat-viagem", 25, 3, 1], // "1 de 3"
  ];
  for (const [chave, desc, valor, catId, d, total, nHoje] of PARCELAS) {
    for (let n = 1; n <= total; n++) {
      const data = dia(hoje, n - nHoje, d);
      por({ id: `pc-${chave}-${n}`, tipo: "despesa", desc, valor, data, catId, pago: data <= hojeIso, serie: { id: `serie-${chave}`, tipo: "parcela", n, total, dia: d } });
    }
  }

  // avulsos do mês de hoje: [id, dia, tipo, nome, valor, categoria, extras]
  const AVULSOS = [
    ["mercado-semana", 2, "despesa", "Mercado da semana", 312.45, "cat-mercado"],
    ["bilhete", 3, "despesa", "Recarga do bilhete", 80.0, "cat-transporte"],
    ["almoco", 5, "despesa", "Almoço com a equipe", 48.9, "cat-alimentacao"],
    ["reembolso", 5, "receita", "Reembolso da viagem a trabalho", 230.0, "cat-r-outras-receitas"],
    ["combustivel", 7, "despesa", "Combustível", 210.0, "cat-carro"],
    ["racao", 8, "despesa", "Ração e areia da Mel", 134.7, "cat-pets"],
    ["padaria", 10, "despesa", "Padaria", 23.5, "cat-alimentacao"],
    ["feira", 10, "despesa", "Feira de sábado", 96.0, "cat-mercado"],
    [ID_NOME_LONGO, 12, "despesa", NOME_LONGO, 385.0, "cat-casa"],
    ["farmacia", 14, "despesa", "Farmácia", 67.8, "cat-saude", { obs: "Remédio da alergia e protetor solar" }],
    ["freela", 16, "receita", "Vídeo de casamento (Lia e Tomás)", 1800.0, "cat-freelas", { obs: "Metade agora; a outra metade entra na entrega", pago: false }],
    ["presente", 17, "despesa", "Presente da Bia", 150.0, "cat-presentes"],
    ["tenis", 19, "despesa", "Tênis de corrida", 329.9, "cat-compras", { foraSoma: true }],
    ["revisao", 21, "despesa", "Revisão do carro", 540.0, "cat-carro"],
    ["jantar", 22, "despesa", "Jantar de aniversário", 186.4, "cat-alimentacao"],
    ["cabelo", 24, "despesa", "Corte de cabelo", 65.0, "cat-cuidados-pessoais"],
    ["mercado-mes", 26, "despesa", "Mercado do mês", 428.19, "cat-mercado"],
    ["cartorio", 27, "despesa", "Taxa do cartório", 42.75, "cat-outros"],
    ["rendimento", 28, "receita", "Rendimento da caixinha", 38.12, "cat-r-investimentos"],
  ];
  for (const [id, d, tipo, desc, valor, catId, extra = {}] of AVULSOS) {
    const data = dia(hoje, 0, d);
    por({ id: id === ID_NOME_LONGO ? id : `av-${id}`, tipo, desc, valor, data, catId, pago: data <= hojeIso, ...extra });
  }
  // um lançamento no dia de HOJE
  por({ id: "av-hoje", tipo: "despesa", desc: "Café com a Lívia", valor: 31.0, data: hojeIso, catId: "cat-alimentacao", pago: true });

  // mês passado: 4 avulsos (+ 7 fixos + 2 parcelas = 13 no mês)
  const PASSADO = [
    ["mercado", 4, "Mercado da semana", 289.3, "cat-mercado"],
    ["combustivel", 9, "Combustível", 195.0, "cat-carro"],
    ["farmacia", 16, "Farmácia", 54.2, "cat-saude"],
    ["jantar", 23, "Jantar com os amigos", 120.0, "cat-alimentacao"],
  ];
  for (const [id, d, desc, valor, catId] of PASSADO) {
    por({ id: `ant-${id}`, tipo: "despesa", desc, valor, data: dia(hoje, -1, d), catId, pago: true });
  }

  return { v: 1, categorias: categoriasPessoal(), lancamentos: lancs };
}

/* ------------------------------------------------------------------ */
/* Investimentos — { v, investimentos: [{..., movs}], metas }          */
/* ------------------------------------------------------------------ */

function invest(hoje) {
  const criado = hoje.getTime() - 400 * 86400000;
  return {
    v: 1,
    investimentos: [
      {
        id: "inv-reserva", tipo: "cdi", criado, nome: "Reserva de emergência", banco: "Banco Girassol", pct: 102, metaId: "meta-reserva",
        movs: [
          { id: "mov-r1", tipo: "aporte", data: dia(hoje, -14, 10), valor: 8000, criado },
          { id: "mov-r2", tipo: "aporte", data: dia(hoje, -6, 12), valor: 2500, criado: criado + 1 },
          { id: "mov-r3", tipo: "aporte", data: dia(hoje, -1, 8), valor: 1200, criado: criado + 2 },
        ],
      },
      {
        id: "inv-selic", tipo: "selic", criado: criado + 10, nome: "Tesouro Selic 2031", banco: "Tesouro Direto", spread: 0.05, metaId: "meta-viagem",
        movs: [
          { id: "mov-s1", tipo: "aporte", data: dia(hoje, -9, 15), valor: 5000, criado: criado + 10 },
          { id: "mov-s2", tipo: "resgate", data: dia(hoje, -2, 20), valor: 800, criado: criado + 11 },
        ],
      },
    ],
    metas: [
      { id: "meta-reserva", nome: "Reserva de 6 meses", alvo: 30000 },
      { id: "meta-viagem", nome: "Viagem pela Patagônia", alvo: 12000 },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Calculadora — { v, atual, cenarios: [{ id, nome, criado, dados }] } */
/* ------------------------------------------------------------------ */

function calc(hoje) {
  const base = {
    taxa: 5.5, saque: 4, anosVer: 10, idade: 32, alvo: 55, patr: 16900, ini: 0,
    aps: [{ de: null, v: 1500 }], pess: 3200, casa: 1600, casaPot: false, metaB: 1000000, metaC: 800000, anosC: 15,
  };
  return {
    v: 1,
    atual: { ...base, preset: null },
    cenarios: [
      {
        id: "cen-previa-1",
        nome: "Guardando mais daqui a um ano",
        criado: new Date(hoje.getTime() - 20 * 86400000).toISOString(),
        dados: { ...base, aps: [{ de: null, v: 1500 }, { de: ymMais(hoje, 12), v: 2400 }], alvo: 52, preset: null },
      },
    ],
  };
}

/* ------------------------------------------------------------------ */

// id da linha → documento. São as chaves que o servidor de desenvolvimento usa
// (Shell.jsx e STORAGE_KEY do App.jsx, sem variáveis VITE_*_KEY).
export function montarSementes(hoje = new Date()) {
  return {
    "financas-casa-teste": casa(hoje),
    "financas-pessoal-teste": pessoal(hoje),
    "financas-invest-teste": invest(hoje),
    "financas-calc-teste": calc(hoje),
  };
}
