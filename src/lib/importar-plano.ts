import * as XLSX from "xlsx";
import { reconhecerPosto, rotuloPosto } from "@/lib/postos";
import { normalizarSecao } from "@/lib/secoes";
import { mesAnoDe, type CategoriaPlanoValor, type TipoReferencia } from "@/lib/plano-modelo";

/**
 * Importacao de planilha para o Plano de Ferias (ANEXO A).
 *
 * Le todas as abas, reconhece variacoes de nome de coluna e devolve as linhas
 * ja no formato do modelo, para conferencia antes de gravar.
 */

export interface LinhaPlanoImportada {
  categoria: CategoriaPlanoValor;
  secao: string;
  ano: number;
  postoTexto: string;
  nomeCompleto: string;
  substitutoTexto: string;
  periodoAquisitivo: string;
  tipoReferencia: TipoReferencia;
  mesAno: string;
  parcela: number;
  dias: number;
  inicio: string | null;
  termino: string | null;
  origem: string;
  observacoes: string[];
}

const EQUIVALENTES: Record<string, string[]> = {
  categoria: ["categoria", "bloco", "tipo", "quadro", "situacao", "vinculo"],
  secao: ["c/asse/sec", "casse/sec", "secao", "sec", "setor", "asse", "chefia", "subunidade", "lotacao"],
  postoTexto: ["p/g", "pg", "posto", "graduacao", "posto/grad", "posto grad", "posto ou graduacao"],
  nomeCompleto: ["nome completo", "nome", "nome do militar", "militar", "identificacao"],
  substitutoTexto: ["substituto", "militar substituto", "subst", "substituicao"],
  periodoAquisitivo: ["periodo aquisitivo", "per aquisitivo", "aquisitivo", "periodo", "ano aquisitivo", "exercicio"],
  mesAno: ["mes ano", "mes/ano", "mes ano ferias", "mes", "mesano"],
  parcela: ["per", "parcela", "fracao", "fracionamento"],
  dias: ["dias", "qtd dias", "quantidade de dias", "n dias", "dias de ferias"],
  inicio: ["inicio", "inicio ferias", "data inicio", "de", "inicio das ferias"],
  termino: ["termino", "fim", "termino ferias", "data termino", "ate", "termino das ferias"],
  ano: ["ano", "ano do plano", "ano plano", "ano de referencia"],
};

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\/ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Casa o cabecalho com um campo do modelo. A busca aproximada so vale para
 * apelidos de 4 letras ou mais: sem isso, um apelido curto como "per" casaria
 * dentro de "periodo aquisitivo" e as colunas sairiam trocadas.
 */
function acharColuna(cabecalho: string[], campo: keyof typeof EQUIVALENTES, usadas: Set<number>): number {
  const alvos = EQUIVALENTES[campo];

  for (let i = 0; i < cabecalho.length; i++) {
    if (usadas.has(i)) continue;
    const c = normalizar(cabecalho[i]);
    if (c && alvos.includes(c)) return i;
  }

  for (let i = 0; i < cabecalho.length; i++) {
    if (usadas.has(i)) continue;
    const c = normalizar(cabecalho[i]);
    if (!c || c.length < 4) continue;
    if (alvos.some((a) => a.length >= 4 && (c.includes(a) || a.includes(c)))) return i;
  }

  return -1;
}

/**
 * Ordem de resolucao das colunas: os nomes mais especificos primeiro, para que
 * "Período Aquisitivo" seja reservado antes de "Per" ou "Ano" tentarem casar.
 */
const ORDEM_COLUNAS: (keyof typeof EQUIVALENTES)[] = [
  "nomeCompleto", "periodoAquisitivo", "substitutoTexto", "postoTexto",
  "secao", "categoria", "mesAno", "inicio", "termino", "dias", "parcela", "ano",
];

/** Aceita Date da planilha, "31/12/2026", "31/12/26" ou "2026-12-31". */
function lerData(valor: unknown): string | null {
  if (!valor) return null;

  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const m = String(valor.getMonth() + 1).padStart(2, "0");
    const d = String(valor.getDate()).padStart(2, "0");
    return `${valor.getFullYear()}-${m}-${d}`;
  }

  const texto = String(valor).trim();
  if (!texto) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, d, m, a] = br;
    const ano = a.length === 2 ? Number(a) + 2000 : Number(a);
    return `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

/** "ÚNICO" vira 0; "1º", "2ª", "3" viram 1, 2, 3. */
function lerParcela(valor: unknown): number {
  const texto = normalizar(valor);
  if (!texto || texto.startsWith("unico")) return 0;
  const n = Number(texto.replace(/[^0-9]/g, ""));
  return n >= 1 && n <= 3 ? n : 0;
}

function lerCategoria(valor: unknown): CategoriaPlanoValor {
  const texto = normalizar(valor);
  return texto.includes("pttc") || texto.includes("prestador") || texto.includes("tarefa")
    ? "PTTC"
    : "ATIVA";
}

/** Se o texto tiver só um ano (2026), a coluna vira referencia por ano. */
function lerReferencia(valor: string): { texto: string; tipo: TipoReferencia } {
  const texto = valor.trim();
  if (/^\d{4}$/.test(texto)) return { texto, tipo: "ANO" };
  return { texto, tipo: "PERIODO" };
}

function montarLinha(
  bruta: Record<string, unknown>,
  origem: string,
  categoriaDaAba: CategoriaPlanoValor | null
): LinhaPlanoImportada | null {
  const nomeCompleto = String(bruta.nomeCompleto ?? "").trim().toUpperCase();
  if (!nomeCompleto || nomeCompleto.length < 3) return null;
  if (/^(nome|posto|total|pagina|nr ord|anexo|ministerio)/i.test(nomeCompleto)) return null;

  const observacoes: string[] = [];

  const categoria = bruta.categoria
    ? lerCategoria(bruta.categoria)
    : categoriaDaAba ?? "ATIVA";

  // O P/G do documento e texto livre ("Cel R/1"), mas tentamos normalizar o que der.
  const postoBruto = String(bruta.postoTexto ?? "").trim();
  const reconhecido = reconhecerPosto(postoBruto);
  const postoTexto = postoBruto || (reconhecido !== "NAO_INFORMADO" ? rotuloPosto(reconhecido) : "");
  if (!postoTexto) observacoes.push("P/G não informado");

  const inicio = lerData(bruta.inicio);
  const termino = lerData(bruta.termino);
  if (bruta.inicio && !inicio) observacoes.push("Início não reconhecido");
  if (bruta.termino && !termino) observacoes.push("Término não reconhecido");

  const referencia = lerReferencia(String(bruta.periodoAquisitivo ?? ""));

  let dias = Number(String(bruta.dias ?? "").replace(/\D/g, ""));
  if (!dias || dias < 1 || dias > 90) {
    dias = 30;
    if (bruta.dias) observacoes.push("Quantidade de dias fora do previsto — ajustada para 30");
  }

  const anoInformado = Number(String(bruta.ano ?? "").replace(/\D/g, ""));
  const ano =
    anoInformado >= 2000 && anoInformado <= 2100
      ? anoInformado
      : inicio
        ? Number(inicio.slice(0, 4))
        : new Date().getFullYear();

  const secao = normalizarSecao(String(bruta.secao ?? "").toUpperCase()) || "NAO INFORMADA";
  if (secao === "NAO INFORMADA") observacoes.push("Seção não informada");

  // Sem período aquisitivo na planilha, a coluna passa a mostrar o ano.
  const referenciaFinal = referencia.texto
    ? referencia
    : { texto: String(ano), tipo: "ANO" as TipoReferencia };

  return {
    categoria,
    secao,
    ano,
    postoTexto,
    nomeCompleto,
    substitutoTexto: String(bruta.substitutoTexto ?? "").trim(),
    periodoAquisitivo: referenciaFinal.texto,
    tipoReferencia: referenciaFinal.tipo,
    mesAno: String(bruta.mesAno ?? "").trim() || mesAnoDe(inicio),
    parcela: lerParcela(bruta.parcela),
    dias,
    inicio,
    termino,
    origem,
    observacoes,
  };
}

/**
 * Descobre se a aba inteira pertence a um bloco, olhando titulos como
 * "a. Militares da Ativa" ou "b. Prestadores de Tarefa por Tempo Certo".
 */
function categoriaDoTexto(linhas: unknown[][]): CategoriaPlanoValor | null {
  const inicio = linhas
    .slice(0, 12)
    .map((l) => normalizar((l as unknown[]).join(" ")))
    .join(" ");

  if (inicio.includes("pttc") || inicio.includes("prestadores de tarefa")) return "PTTC";
  if (inicio.includes("militares da ativa")) return "ATIVA";
  return null;
}

/** Le todas as abas da planilha do plano de ferias. */
export function lerPlanilhaPlano(buffer: Buffer): LinhaPlanoImportada[] {
  const pasta = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const resultado: LinhaPlanoImportada[] = [];

  for (const nomeAba of pasta.SheetNames) {
    const aba = pasta.Sheets[nomeAba];
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, blankrows: false, defval: "" });
    if (linhas.length < 2) continue;

    const categoriaDaAba = categoriaDoTexto(linhas as unknown[][]) ?? lerCategoria(nomeAba);

    // Procura o cabecalho nas 15 primeiras linhas (o documento tem titulos antes).
    let indiceCabecalho = -1;
    let colunas: Record<string, number> = {};

    for (let i = 0; i < Math.min(15, linhas.length); i++) {
      const cabecalho = (linhas[i] as unknown[]).map((c) => String(c ?? ""));
      const teste: Record<string, number> = {};
      const usadas = new Set<number>();
      for (const campo of ORDEM_COLUNAS) {
        const indice = acharColuna(cabecalho, campo, usadas);
        teste[campo] = indice;
        if (indice >= 0) usadas.add(indice);
      }
      // Só aceita como cabeçalho se achou o nome e pelo menos mais uma coluna do modelo.
      const outras = ["dias", "inicio", "termino", "parcela", "postoTexto"].filter((c) => teste[c] >= 0);
      if (teste.nomeCompleto >= 0 && outras.length >= 1) {
        indiceCabecalho = i;
        colunas = teste;
        break;
      }
    }

    if (indiceCabecalho < 0) continue;

    // A seção pode vir num título acima do cabeçalho ("SEÇÃO – Chefia de Material").
    // O padrão antigo, "C/Asse/Seç – …", segue reconhecido por causa das planilhas já emitidas.
    let secaoDaTabela = "";
    for (let i = Math.max(0, indiceCabecalho - 4); i < indiceCabecalho; i++) {
      const texto = (linhas[i] as unknown[]).map((c) => String(c ?? "")).join(" ").trim();
      const achou = texto.match(
        /(?:c\s*\/?\s*asse\s*\/?\s*se[çc]|se[çc][ãa]o|se[çc])\s*[–\-—:]\s*(.+)/i
      );
      if (achou) secaoDaTabela = achou[1].replace(/\s*-\s*modelo\s*$/i, "").trim();
    }

    for (const linha of linhas.slice(indiceCabecalho + 1) as unknown[][]) {
      const pegar = (indice?: number) =>
        indice !== undefined && indice >= 0 ? linha[indice] : "";

      const bruta = {
        categoria: pegar(colunas.categoria),
        secao: String(pegar(colunas.secao) ?? "").trim() || secaoDaTabela,
        ano: pegar(colunas.ano),
        postoTexto: pegar(colunas.postoTexto),
        nomeCompleto: pegar(colunas.nomeCompleto),
        substitutoTexto: pegar(colunas.substitutoTexto),
        periodoAquisitivo: pegar(colunas.periodoAquisitivo),
        mesAno: pegar(colunas.mesAno),
        parcela: pegar(colunas.parcela),
        dias: pegar(colunas.dias),
        inicio: pegar(colunas.inicio),
        termino: pegar(colunas.termino),
      };

      const montada = montarLinha(bruta, `Aba ${nomeAba}`, categoriaDaAba);
      if (montada) resultado.push(montada);
    }
  }

  return resultado;
}
