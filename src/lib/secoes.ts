/**
 * Nomes das secoes.
 *
 * A unidade renomeou quatro secoes, e as planilhas antigas ainda trazem os
 * nomes velhos. Em vez de corrigir na mao a cada importacao, toda gravacao
 * passa por `normalizarSecao`, que troca o nome antigo pelo novo.
 *
 * Para renomear os registros ja gravados no banco, use `npm run db:secoes`.
 */

/** De -> Para. As chaves ficam na forma canonica (sem acento, maiusculas). */
export const RENOMEACOES_SECAO: Record<string, string> = {
  "CL IX BLD": "DIV BLD",
  "CL IX MOTO": "DIV MOTO",
  "CL V ARMT LEVE": "DIV ARMT LEVE",
  "CL V ARMT PESADO": "DIV ARMT PESADO",
};

/**
 * Forma canonica usada para comparar: sem acentos, sem pontuacao solta,
 * espacos colapsados e tudo em maiusculas. Assim "Cl IX Bld", "CL. IX  BLD"
 * e "cl ix bld" caem todos na mesma chave.
 */
export function chaveSecao(texto?: string | null): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Devolve o nome atual da secao, aplicando as renomeacoes quando for o caso.
 * Nomes que nao estao na lista voltam apenas com os espacos ajustados.
 */
export function normalizarSecao(texto?: string | null): string {
  const bruto = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!bruto) return "";
  return RENOMEACOES_SECAO[chaveSecao(bruto)] ?? bruto;
}

/** Lista legivel das trocas, usada na tela e na documentacao. */
export const TROCAS_SECAO = Object.entries(RENOMEACOES_SECAO).map(([de, para]) => ({ de, para }));
