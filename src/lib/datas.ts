const DIA_MS = 86_400_000;

/** Converte "2025-03-10" ou Date em Date local sem deslocamento de fuso. */
export function paraData(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = somenteData ? new Date(valor + "T12:00:00") : new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

export function paraInput(valor: string | Date | null | undefined): string {
  const d = paraData(valor);
  if (!d) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function formatarBR(valor: string | Date | null | undefined): string {
  const d = paraData(valor);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Dias corridos entre duas datas, inclusive as extremidades. */
export function contarDias(inicio: Date | string, termino: Date | string): number {
  const a = paraData(inicio);
  const b = paraData(termino);
  if (!a || !b) return 0;
  return Math.floor((b.getTime() - a.getTime()) / DIA_MS) + 1;
}

export function somarDias(data: Date | string, dias: number): Date {
  const d = paraData(data) ?? new Date();
  return new Date(d.getTime() + dias * DIA_MS);
}

export function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
