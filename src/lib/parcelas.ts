/**
 * Parcelamento das ferias lancadas no quadro (aba "Pagina inicial").
 *
 * O campo continua gravado como texto em `Ferias.periodoAquisitivo`, entao os
 * lancamentos antigos ("1", "2", "3") seguem validos. O valor "UNICO" foi
 * acrescentado para o periodo tirado de uma vez so.
 */

export type ParcelaValor = "1" | "2" | "3" | "UNICO";

export const PARCELAS_FERIAS: { valor: ParcelaValor; rotulo: string }[] = [
  { valor: "1", rotulo: "1ª Parcela" },
  { valor: "2", rotulo: "2ª Parcela" },
  { valor: "3", rotulo: "3ª Parcela" },
  { valor: "UNICO", rotulo: "Período único" },
];

/** Normaliza o que veio do banco; qualquer coisa fora da lista vira 1ª parcela. */
export function normalizarParcela(valor?: string | null): ParcelaValor {
  const v = String(valor ?? "").trim().toUpperCase();
  if (v === "UNICO" || v === "ÚNICO" || v === "0") return "UNICO";
  if (v === "2" || v === "3") return v;
  return "1";
}

export function rotuloParcelaFerias(valor?: string | null): string {
  const v = normalizarParcela(valor);
  return PARCELAS_FERIAS.find((p) => p.valor === v)?.rotulo ?? "1ª Parcela";
}

/** Numero usado na coluna "Per" do ANEXO A: 0 = ÚNICO. */
export function numeroParcela(valor?: string | null): number {
  const v = normalizarParcela(valor);
  return v === "UNICO" ? 0 : Number(v);
}
