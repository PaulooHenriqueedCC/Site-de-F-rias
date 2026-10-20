export type PostoValor =
  | "GEN_EX" | "GEN_DIV" | "GEN_BDA" | "CEL" | "TEN_CEL" | "MAJ"
  | "CAP" | "PRIMEIRO_TEN" | "SEGUNDO_TEN" | "ASP" | "S_TEN" | "PRIMEIRO_SGT"
  | "SEGUNDO_SGT" | "TERCEIRO_SGT" | "CB" | "SD_EP" | "SD_EV" | "NAO_INFORMADO";

/** Ordem hierarquica oficial usada em todas as listagens do sistema. */
export const POSTOS: { valor: PostoValor; label: string }[] = [
  { valor: "GEN_EX", label: "Gen Ex" },
  { valor: "GEN_DIV", label: "Gen Div" },
  { valor: "GEN_BDA", label: "Gen Bda" },
  { valor: "CEL", label: "Cel" },
  { valor: "TEN_CEL", label: "Ten Cel" },
  { valor: "MAJ", label: "Maj" },
  { valor: "CAP", label: "Cap" },
  { valor: "PRIMEIRO_TEN", label: "1º Ten" },
  { valor: "SEGUNDO_TEN", label: "2º Ten" },
  { valor: "ASP", label: "Asp" },
  { valor: "S_TEN", label: "S Ten" },
  { valor: "PRIMEIRO_SGT", label: "1º Sgt" },
  { valor: "SEGUNDO_SGT", label: "2º Sgt" },
  { valor: "TERCEIRO_SGT", label: "3º Sgt" },
  { valor: "CB", label: "Cb" },
  { valor: "SD_EP", label: "Sd EP" },
  { valor: "SD_EV", label: "Sd EV" },
  { valor: "NAO_INFORMADO", label: "Não informado" },
];

/** QAO existe apenas para Cap, 1º Ten e 2º Ten. */
export const POSTOS_QAO: PostoValor[] = ["CAP", "PRIMEIRO_TEN", "SEGUNDO_TEN"];

/** PTTC nao alcanca 3º Sgt, Cb, Sd EP e Sd EV. */
export const POSTOS_PTTC: PostoValor[] = [
  "GEN_EX", "GEN_DIV", "GEN_BDA", "CEL", "TEN_CEL", "MAJ", "CAP",
  "PRIMEIRO_TEN", "SEGUNDO_TEN", "ASP", "S_TEN", "PRIMEIRO_SGT", "SEGUNDO_SGT",
];

export function rotuloPosto(valor?: string | null): string {
  return POSTOS.find((p) => p.valor === valor)?.label ?? "Não informado";
}

export function ordemPosto(valor?: string | null): number {
  const i = POSTOS.findIndex((p) => p.valor === valor);
  return i === -1 ? 999 : i;
}

export function quadrosDisponiveis(posto?: string | null): QuadroValor[] {
  const lista: QuadroValor[] = ["NENHUM"];
  if (POSTOS_QAO.includes(posto as PostoValor)) lista.push("QAO");
  if (POSTOS_PTTC.includes(posto as PostoValor)) lista.push("PTTC");
  return lista;
}

/* ------------------------------------------------------------------ Quadro */

export type QuadroValor = "NENHUM" | "QAO" | "PTTC";

/**
 * O banco continua gravando NENHUM como valor neutro, mas em tela ele aparece
 * como "Ativa" — que e o nome usado na unidade para quem nao e QAO nem PTTC.
 */
export const QUADROS: { valor: QuadroValor; label: string }[] = [
  { valor: "NENHUM", label: "Ativa" },
  { valor: "QAO", label: "QAO" },
  { valor: "PTTC", label: "PTTC" },
];

export function rotuloQuadro(valor?: string | null): string {
  return QUADROS.find((q) => q.valor === valor)?.label ?? "Ativa";
}

/** Reconhece o posto a partir de texto livre vindo de planilhas e PDF. */
export function reconhecerPosto(texto?: string | null): PostoValor {
  if (!texto) return "NAO_INFORMADO";
  const t = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[.º°ª]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const mapa: [RegExp, PostoValor][] = [
    [/^GEN EX|GENERAL DE EXERCITO/, "GEN_EX"],
    [/^GEN DIV|GENERAL DE DIVISAO/, "GEN_DIV"],
    [/^GEN BDA|GENERAL DE BRIGADA/, "GEN_BDA"],
    [/^TEN CEL|TC$/, "TEN_CEL"],
    [/^CEL|CORONEL/, "CEL"],
    [/^MAJ|MAJOR/, "MAJ"],
    [/^CAP|CAPITAO/, "CAP"],
    [/^1 TEN|1TEN|PRIMEIRO TENENTE/, "PRIMEIRO_TEN"],
    [/^2 TEN|2TEN|SEGUNDO TENENTE/, "SEGUNDO_TEN"],
    [/^ASP|ASPIRANTE/, "ASP"],
    [/^S TEN|ST$|SUBTENENTE|SUB TEN/, "S_TEN"],
    [/^1 SGT|1SGT|PRIMEIRO SARGENTO/, "PRIMEIRO_SGT"],
    [/^2 SGT|2SGT|SEGUNDO SARGENTO/, "SEGUNDO_SGT"],
    [/^3 SGT|3SGT|TERCEIRO SARGENTO/, "TERCEIRO_SGT"],
    [/^CB|CABO/, "CB"],
    [/^SD EP|SOLDADO EP/, "SD_EP"],
    [/^SD EV|SOLDADO EV|^SD$|SOLDADO/, "SD_EV"],
  ];

  for (const [regex, valor] of mapa) if (regex.test(t)) return valor;
  return "NAO_INFORMADO";
}

/* ------------------------------------------------------- Antiguidade */

/** O minimo que um militar precisa expor para entrar na ordem de antiguidade. */
export interface ComAntiguidade {
  posto?: string | null;
  nomeCompleto?: string | null;
  nomeGuerra?: string | null;
  /** Numero definido na aba Efetivo. Zero ou ausente = ainda nao definida. */
  antiguidade?: number | null;
}

/**
 * Ordem de antiguidade usada em todo o sistema.
 *
 * Vale primeiro a antiguidade definida na aba Efetivo, que e a da unidade e
 * pode nao coincidir com a hierarquia pura (dois majores da mesma turma, por
 * exemplo). Quem ainda nao tem numero entra depois de quem tem, na ordem
 * hierarquica do posto e, por fim, em ordem alfabetica.
 */
export function compararAntiguidade(a: ComAntiguidade, b: ComAntiguidade): number {
  const numero = (m: ComAntiguidade) =>
    m.antiguidade && m.antiguidade > 0 ? m.antiguidade : Number.MAX_SAFE_INTEGER;

  const posicao = numero(a) - numero(b);
  if (posicao !== 0) return posicao;

  const hierarquia = ordemPosto(a.posto) - ordemPosto(b.posto);
  if (hierarquia !== 0) return hierarquia;

  const nomeA = a.nomeCompleto || a.nomeGuerra || "";
  const nomeB = b.nomeCompleto || b.nomeGuerra || "";
  return nomeA.localeCompare(nomeB, "pt-BR");
}

/** Atalho para ordenar uma lista sem alterar o original. */
export function ordenarPorAntiguidade<T extends ComAntiguidade>(lista: T[]): T[] {
  return [...lista].sort(compararAntiguidade);
}
