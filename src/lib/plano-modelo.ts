/**
 * Modelo do ANEXO A (Plano de Ferias) reproduzido a partir do documento oficial
 * do Departamento Marechal Falconieri. Usado tanto pela exportacao da pagina
 * inicial quanto pela aba "Plano de ferias".
 */

import { compararAntiguidade, reconhecerPosto } from "@/lib/postos";

export type CategoriaPlanoValor = "ATIVA" | "PTTC";

export interface CategoriaPlano {
  valor: CategoriaPlanoValor;
  letra: string;
  titulo: string;
  /** Sufixo ordinal da coluna "Per": o documento usa "1º" na ativa e "1ª" no PTTC. */
  ordinal: "º" | "ª";
  colunas: string[];
}

export const CATEGORIAS_PLANO: CategoriaPlano[] = [
  {
    valor: "ATIVA",
    letra: "a",
    titulo: "Militares da Ativa",
    ordinal: "º",
    colunas: [
      "Nr Ord", "P/G", "Nome Completo", "Substituto", "Período Aquisitivo / Ano",
      "Mês_Ano", "Per", "Dias", "Desc", "Início", "Término",
    ],
  },
  {
    valor: "PTTC",
    letra: "b",
    titulo: "Prestadores de Tarefa por Tempo Certo (PTTC)",
    ordinal: "ª",
    colunas: [
      "Nr Ord", "P/G", "Nome Completo", "Substituto", "Período Aquisitivo / Ano",
      "Mês_Ano", "Per", "Dias", "Desc", "Início", "Término",
    ],
  },
];

export function categoriaPlano(valor: string): CategoriaPlano {
  return CATEGORIAS_PLANO.find((c) => c.valor === valor) ?? CATEGORIAS_PLANO[0];
}

export const MESES_CURTOS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

/** Monta o rotulo "DEZ_26" usado na coluna Mês_Ano. */
export function mesAnoDe(valor: string | Date | null | undefined): string {
  if (!valor) return "";
  const d = valor instanceof Date ? valor : new Date(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor + "T12:00:00" : valor);
  if (isNaN(d.getTime())) return "";
  return `${MESES_CURTOS[d.getMonth()]}_${String(d.getFullYear()).slice(-2)}`;
}

/** 0 = UNICO; 1, 2, 3 = parcelas. */
export function rotuloParcela(parcela: number, ordinal: "º" | "ª" = "º"): string {
  if (!parcela || parcela < 1) return "ÚNICO";
  return `${parcela}${ordinal}`;
}

export const PARCELAS = [0, 1, 2, 3];

/** A 5a coluna aceita um periodo aquisitivo completo ou apenas o ano. */
export type TipoReferencia = "PERIODO" | "ANO";

export const TIPOS_REFERENCIA: { valor: TipoReferencia; rotulo: string }[] = [
  { valor: "PERIODO", rotulo: "Período aquisitivo" },
  { valor: "ANO", rotulo: "Ano" },
];

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Monta "01/02/2025 a 31/01/2026 (1º período)" a partir das datas escolhidas. */
export function montarPeriodoAquisitivo(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  numero: number
): string {
  const formatar = (v?: string | null) => {
    if (!v) return "";
    const [a, m, d] = v.split("-");
    return a && m && d ? `${doisDigitos(Number(d))}/${doisDigitos(Number(m))}/${a}` : "";
  };

  const de = formatar(inicio);
  const ate = formatar(fim);
  if (!de && !ate) return "";

  const faixa = de && ate ? `${de} a ${ate}` : de || ate;
  return numero > 0 ? `${faixa} (${numero}º período)` : faixa;
}

/** Linha ja normalizada para o modelo do documento. */
export interface LinhaModelo {
  categoria: CategoriaPlanoValor;
  secao: string;
  postoTexto: string;
  nomeCompleto: string;
  substitutoTexto: string;
  periodoAquisitivo: string;
  mesAno: string;
  parcela: number;
  dias: number;
  desconto: number;
  inicio: string;
  termino: string;
}

/** Devolve as celulas da linha na ordem exata das colunas da categoria. */
export function celulasDaLinha(linha: LinhaModelo, nrOrd: number): string[] {
  const cat = categoriaPlano(linha.categoria);
  const per = rotuloParcela(linha.parcela, cat.ordinal);
  const desc = linha.desconto > 0 ? String(linha.desconto) : "-";
  const numero = String(nrOrd).padStart(2, "0");

  return [
    numero, linha.postoTexto, linha.nomeCompleto, linha.substitutoTexto,
    linha.periodoAquisitivo, linha.mesAno,
    per, String(linha.dias), desc, linha.inicio, linha.termino,
  ];
}

export interface GrupoSecao {
  secao: string;
  linhas: LinhaModelo[];
}

export interface BlocoCategoria {
  categoria: CategoriaPlano;
  grupos: GrupoSecao[];
}

/** Agrupa as linhas por categoria e, dentro dela, por seção. */
export function agruparPorModelo(linhas: LinhaModelo[]): BlocoCategoria[] {
  return CATEGORIAS_PLANO.map((categoria) => {
    const daCategoria = linhas.filter((l) => l.categoria === categoria.valor);
    const mapa = new Map<string, LinhaModelo[]>();
    for (const l of daCategoria) {
      const chave = l.secao || "NAO INFORMADA";
      mapa.set(chave, [...(mapa.get(chave) ?? []), l]);
    }
    const grupos = Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([secao, linhasDoGrupo]) => ({ secao, linhas: linhasDoGrupo }));
    return { categoria, grupos };
  });
}

export interface CabecalhoModelo {
  linha1: string;
  linha2: string;
  linha3: string;
  linha4: string;
  anexo: string;
}

export const CABECALHO_PADRAO: CabecalhoModelo = {
  linha1: "MINISTÉRIO DA DEFESA",
  linha2: "EXÉRCITO BRASILEIRO",
  linha3: "COMANDO LOGÍSTICO",
  linha4: "DEPARTAMENTO MARECHAL FALCONIERI",
  anexo: "ANEXO A",
};

/** Rotulo do grupo, como aparece no documento. */
export function tituloGrupo(secao: string): string {
  return `SEÇÃO – ${secao}`;
}

/* -------------------------------------------------- Ordenacao do Nr Ord */

/** O minimo que uma linha precisa expor para ser ordenada. */
export interface LinhaOrdenavel {
  categoria: string;
  secao: string;
  ordem: number;
  nomeCompleto: string;
  postoTexto: string;
  inicio: string | Date | null;
  militar?: { posto?: string | null; antiguidade?: number | null } | null;
}

/**
 * Posto/graduacao da linha, para o filtro e para a ordenacao por antiguidade.
 *
 * A coluna P/G do documento e texto livre ("Cel R/1", "Maj QAO"), entao a
 * preferencia e o posto do militar vinculado; sem vinculo, o texto e
 * interpretado por `reconhecerPosto`.
 */
export function postoDaLinha(linha: LinhaOrdenavel): string {
  const doEfetivo = linha.militar?.posto;
  if (doEfetivo && doEfetivo !== "NAO_INFORMADO") return doEfetivo;
  return reconhecerPosto(linha.postoTexto);
}

/**
 * Ordena as linhas do plano.
 *
 * - **Por antiguidade**: dentro de cada bloco e de cada seção, na ordem de
 *   antiguidade da unidade — a mesma definida na aba Efetivo. Linhas sem
 *   vínculo com o efetivo entram pela hierarquia do posto lido na coluna P/G.
 * - **Manual**: respeita o campo `ordem` de cada linha e, no empate, a data de
 *   inicio — o comportamento que o sistema tinha antes.
 *
 * A numeracao Nr Ord e a posicao dentro do grupo, entao basta ordenar a lista.
 */
export function ordenarLinhasPlano<T extends LinhaOrdenavel>(
  linhas: T[],
  porAntiguidade: boolean
): T[] {
  const tempo = (v: string | Date | null) => {
    const d = v instanceof Date ? v : v ? new Date(v) : null;
    return d && !isNaN(d.getTime()) ? d.getTime() : Number.MAX_SAFE_INTEGER;
  };

  return [...linhas].sort((a, b) => {
    if (porAntiguidade) {
      const ordem = compararAntiguidade(
        { posto: postoDaLinha(a), nomeCompleto: a.nomeCompleto, antiguidade: a.militar?.antiguidade },
        { posto: postoDaLinha(b), nomeCompleto: b.nomeCompleto, antiguidade: b.militar?.antiguidade }
      );
      if (ordem !== 0) return ordem;
      return tempo(a.inicio) - tempo(b.inicio);
    }

    const manual = a.ordem - b.ordem;
    if (manual !== 0) return manual;
    return tempo(a.inicio) - tempo(b.inicio);
  });
}

const escapar = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const linhaCsv = (celulas: unknown[]) => celulas.map(escapar).join(";");

/**
 * Gera o CSV no layout do ANEXO A: cabecalho institucional, blocos a/b/c e,
 * dentro de cada bloco, uma tabela por seção.
 */
export function montarCsvModelo(linhas: LinhaModelo[], cabecalho: CabecalhoModelo = CABECALHO_PADRAO): string {
  const saida: string[] = [];

  saida.push(linhaCsv([cabecalho.linha1]));
  saida.push(linhaCsv([cabecalho.linha2]));
  saida.push(linhaCsv([cabecalho.linha3]));
  saida.push(linhaCsv([cabecalho.linha4]));
  saida.push(linhaCsv([cabecalho.anexo]));

  for (const bloco of agruparPorModelo(linhas)) {
    saida.push("");
    saida.push(linhaCsv([`${bloco.categoria.letra}. ${bloco.categoria.titulo}`]));

    if (!bloco.grupos.length) {
      saida.push(linhaCsv(["(sem lançamentos)"]));
      continue;
    }

    for (const grupo of bloco.grupos) {
      saida.push("");
      saida.push(linhaCsv([tituloGrupo(grupo.secao)]));
      saida.push(linhaCsv(bloco.categoria.colunas));
      grupo.linhas.forEach((l, i) => saida.push(linhaCsv(celulasDaLinha(l, i + 1))));
    }
  }

  return saida.join("\n");
}

/** Dispara o download do CSV com BOM, para o Excel abrir em UTF-8. */
export function baixarCsv(conteudo: string, nomeArquivo: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Distribui os dias lancados em "Desconto em ferias" sobre as linhas do plano
 * do mesmo militar e do mesmo ano, na ordem cronologica. Um valor manual na
 * linha tem prioridade sobre a distribuicao automatica.
 */
export function distribuirDescontos<T extends { militarId: string | null; ano: number; dias: number; descontoManual: number | null }>(
  linhas: T[],
  totalPorMilitarAno: Map<string, number>
): (T & { descontoAplicado: number; diasEfetivos: number })[] {
  const restante = new Map(totalPorMilitarAno);

  return linhas.map((linha) => {
    if (!linha.militarId) {
      const aplicado = linha.descontoManual ?? 0;
      return { ...linha, descontoAplicado: aplicado, diasEfetivos: Math.max(0, linha.dias - aplicado) };
    }

    const chave = `${linha.militarId}|${linha.ano}`;
    const disponivel = restante.get(chave) ?? 0;
    const aplicado = linha.descontoManual ?? Math.min(disponivel, linha.dias);
    restante.set(chave, Math.max(0, disponivel - aplicado));

    return { ...linha, descontoAplicado: aplicado, diasEfetivos: Math.max(0, linha.dias - aplicado) };
  });
}
