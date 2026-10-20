/** Cor estavel por militar: o mesmo nome sempre recebe a mesma faixa no calendario. */
const PALETA = [
  "#C8A44D", "#2E5B3A", "#A32B2B", "#4A6FA5", "#8C5B9E",
  "#3F7F86", "#B4703A", "#5E7C3A", "#9A4B6B", "#4C5D8A",
  "#7A6A3C", "#356B5B",
];

export function corDoMilitar(chave: string): string {
  let hash = 0;
  for (let i = 0; i < chave.length; i++) hash = (hash * 31 + chave.charCodeAt(i)) >>> 0;
  return PALETA[hash % PALETA.length];
}
