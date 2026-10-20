import * as XLSX from "xlsx";
import { reconhecerPosto } from "@/lib/postos";
import { normalizarSecao } from "@/lib/secoes";
import { identidadeValida, mascararIdentidade } from "@/lib/validacao";

export interface LinhaImportada {
  nomeCompleto: string;
  nomeGuerra: string;
  identidade: string | null;
  identidadePendente: boolean;
  posto: string;
  secao: string;
  ramal: string | null;
  telefone: string | null;
  origem: string;
  observacoes: string[];
}

const EQUIVALENTES: Record<string, string[]> = {
  nomeCompleto: ["nome completo", "nome", "nome do militar", "militar", "nome civil", "identificacao"],
  nomeGuerra: ["nome de guerra", "nome guerra", "guerra", "ng", "apelido"],
  identidade: ["identidade", "identidade militar", "id", "idt", "cpf/idt", "numero de identidade", "id militar"],
  posto: ["posto", "graduacao", "posto/grad", "posto ou graduacao", "pg", "post grad", "posto grad"],
  secao: ["secao", "sec", "setor", "subunidade", "su", "lotacao", "od"],
  ramal: ["ramal", "r", "telefone interno"],
  telefone: ["telefone", "celular", "fone", "contato", "tel"],
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

function acharColuna(cabecalho: string[], campo: keyof typeof EQUIVALENTES): number {
  const alvos = EQUIVALENTES[campo];
  for (let i = 0; i < cabecalho.length; i++) {
    const c = normalizar(cabecalho[i]);
    if (!c) continue;
    if (alvos.includes(c)) return i;
  }
  for (let i = 0; i < cabecalho.length; i++) {
    const c = normalizar(cabecalho[i]);
    if (!c) continue;
    if (alvos.some((a) => c.includes(a) || a.includes(c))) return i;
  }
  return -1;
}

/** Quando o cabecalho nao e reconhecido, olha o conteudo das colunas. */
function farejarColunas(linhas: unknown[][]): Record<string, number> {
  const mapa: Record<string, number> = {};
  const amostra = linhas.slice(0, 25);
  const totalColunas = Math.max(...amostra.map((l) => l.length), 0);

  for (let col = 0; col < totalColunas; col++) {
    const valores = amostra.map((l) => String(l[col] ?? "").trim()).filter(Boolean);
    if (!valores.length) continue;

    const proporcao = (fn: (v: string) => boolean) => valores.filter(fn).length / valores.length;

    if (mapa.identidade === undefined && proporcao((v) => /\d{3}\.?\d{3}\.?\d{3}-?\d/.test(v)) > 0.5) {
      mapa.identidade = col;
      continue;
    }
    if (mapa.posto === undefined && proporcao((v) => reconhecerPosto(v) !== "NAO_INFORMADO") > 0.5) {
      mapa.posto = col;
      continue;
    }
    if (mapa.nomeCompleto === undefined && proporcao((v) => v.split(/\s+/).length >= 3) > 0.5) {
      mapa.nomeCompleto = col;
      continue;
    }
    if (mapa.nomeGuerra === undefined && proporcao((v) => v.split(/\s+/).length === 1 && v.length > 1) > 0.6) {
      mapa.nomeGuerra = col;
    }
  }
  return mapa;
}

function limparIdentidade(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length !== 10) return null;
  const formatada = mascararIdentidade(digitos);
  return identidadeValida(formatada) ? formatada : null;
}

function montarLinha(bruta: Record<string, string>, origem: string): LinhaImportada | null {
  const nomeCompleto = (bruta.nomeCompleto || "").trim().toUpperCase();
  if (!nomeCompleto || nomeCompleto.length < 3) return null;

  const observacoes: string[] = [];
  const identidade = bruta.identidade ? limparIdentidade(bruta.identidade) : null;
  if (bruta.identidade && !identidade) observacoes.push("Identidade fora do formato 111.222.333-4");
  if (!bruta.identidade) observacoes.push("Identidade não informada na planilha");

  const posto = reconhecerPosto(bruta.posto);
  if (posto === "NAO_INFORMADO") observacoes.push("Posto/graduação não reconhecido");

  const partes = nomeCompleto.split(/\s+/);
  const nomeGuerra = (bruta.nomeGuerra || partes[partes.length - 1] || partes[0]).trim().toUpperCase();
  if (!bruta.nomeGuerra) observacoes.push("Nome de guerra deduzido do nome completo");

  return {
    nomeCompleto,
    nomeGuerra,
    identidade,
    identidadePendente: !identidade,
    posto,
    secao: normalizarSecao((bruta.secao || "NAO INFORMADA").toUpperCase()) || "NAO INFORMADA",
    ramal: bruta.ramal?.replace(/\D/g, "") || null,
    telefone: bruta.telefone?.trim() || null,
    origem,
    observacoes,
  };
}

/** Le todas as abas da planilha, uma a uma. */
export function lerPlanilha(buffer: Buffer): LinhaImportada[] {
  const pasta = XLSX.read(buffer, { type: "buffer" });
  const resultado: LinhaImportada[] = [];

  for (const nomeAba of pasta.SheetNames) {
    const aba = pasta.Sheets[nomeAba];
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, blankrows: false, defval: "" });
    if (linhas.length < 2) continue;

    // Procura a linha de cabecalho nas 10 primeiras linhas.
    let indiceCabecalho = -1;
    let colunas: Record<string, number> = {};

    for (let i = 0; i < Math.min(10, linhas.length); i++) {
      const cabecalho = (linhas[i] as unknown[]).map((c) => String(c ?? ""));
      const teste = {
        nomeCompleto: acharColuna(cabecalho, "nomeCompleto"),
        nomeGuerra: acharColuna(cabecalho, "nomeGuerra"),
        identidade: acharColuna(cabecalho, "identidade"),
        posto: acharColuna(cabecalho, "posto"),
        secao: acharColuna(cabecalho, "secao"),
        ramal: acharColuna(cabecalho, "ramal"),
        telefone: acharColuna(cabecalho, "telefone"),
      };
      if (teste.nomeCompleto >= 0 || (teste.nomeGuerra >= 0 && teste.posto >= 0)) {
        indiceCabecalho = i;
        colunas = teste;
        break;
      }
    }

    const corpo = indiceCabecalho >= 0 ? linhas.slice(indiceCabecalho + 1) : linhas;
    if (indiceCabecalho < 0) colunas = farejarColunas(corpo as unknown[][]);
    if (colunas.nomeCompleto === undefined && colunas.nomeGuerra === undefined) continue;

    for (const linha of corpo as unknown[][]) {
      const pegar = (indice?: number) => (indice !== undefined && indice >= 0 ? String(linha[indice] ?? "").trim() : "");
      const bruta = {
        nomeCompleto: pegar(colunas.nomeCompleto) || pegar(colunas.nomeGuerra),
        nomeGuerra: pegar(colunas.nomeGuerra),
        identidade: pegar(colunas.identidade),
        posto: pegar(colunas.posto),
        secao: pegar(colunas.secao),
        ramal: pegar(colunas.ramal),
        telefone: pegar(colunas.telefone),
      };
      const montada = montarLinha(bruta, `Aba ${nomeAba}`);
      if (montada) resultado.push(montada);
    }
  }

  return resultado;
}

/**
 * Le o texto de um PDF linha a linha. Reconhece o padrao
 * "POSTO NOME COMPLETO 111.222.333-4" em qualquer ordem.
 */
export function lerTextoPdf(texto: string): LinhaImportada[] {
  const resultado: LinhaImportada[] = [];
  const linhas = texto.split(/\r?\n/);

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.replace(/\s+/g, " ").trim();
    if (linha.length < 6) continue;

    const idEncontrada = linha.match(/\d{3}\.?\d{3}\.?\d{3}-?\d/)?.[0] ?? "";
    let restante = idEncontrada ? linha.replace(idEncontrada, " ") : linha;
    restante = restante.replace(/^\d+[\)\.\-\s]+/, "").trim();

    const palavras = restante.split(" ").filter(Boolean);
    if (palavras.length < 2) continue;

    let posto = "";
    for (let n = 3; n >= 1; n--) {
      const tentativa = palavras.slice(0, n).join(" ");
      if (reconhecerPosto(tentativa) !== "NAO_INFORMADO") {
        posto = tentativa;
        restante = palavras.slice(n).join(" ");
        break;
      }
    }

    const nome = restante.trim();
    if (nome.split(" ").length < 2) continue;
    if (/^(nome|posto|efetivo|relacao|pagina|total)/i.test(nome)) continue;

    const montada = montarLinha(
      { nomeCompleto: nome, nomeGuerra: "", identidade: idEncontrada, posto, secao: "", ramal: "", telefone: "" },
      "PDF"
    );
    if (montada) resultado.push(montada);
  }

  return resultado;
}
