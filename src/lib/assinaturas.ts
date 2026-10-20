/**
 * Assinatura do plano de ferias.
 *
 * O bloco de assinatura reproduz o padrao do documento: o nome completo
 * sublinhado, com o nome de guerra em negrito no meio dele, e a funcao logo
 * abaixo. Exemplo:
 *
 *     Paulo Henrique do Carmo Costa – Cel   (sublinhado, "do Carmo" em negrito)
 *     Chefe da turma de apoio
 */

import { rotuloPosto } from "@/lib/postos";

export interface DadosAssinatura {
  nomeCompleto: string;
  /** Trecho do nome completo que sai em negrito. */
  nomeGuerra: string;
  /** Posto ou graduacao, acrescentado ao fim do nome. */
  posto?: string | null;
  /** O que o militar e: "Chefe da turma de apoio". */
  funcao: string;
  /** Preenchido quando a assinatura foi feita pelo sistema. */
  assinadoEm?: string | Date | null;
  /** Codigo de conferencia impresso junto da assinatura digital. */
  codigo?: string | null;
}

/** Um pedaco do nome, com a marca de negrito. */
export interface ParteNome {
  texto: string;
  negrito: boolean;
}

const semAcento = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Quebra o nome completo em ate tres pedacos, destacando o nome de guerra.
 *
 * A busca ignora acentos e maiusculas, mas o texto devolvido e sempre o
 * original — assim "do Carmo" sai como esta no cadastro. Se o nome de guerra
 * nao aparecer no nome completo (ou vier vazio), devolve o nome inteiro sem
 * negrito, em vez de inventar um destaque no lugar errado.
 */
export function partesDoNome(nomeCompleto: string, nomeGuerra: string): ParteNome[] {
  const completo = String(nomeCompleto ?? "").trim();
  const guerra = String(nomeGuerra ?? "").trim();

  if (!completo) return [];
  if (!guerra) return [{ texto: completo, negrito: false }];

  const alvo = semAcento(completo);
  const busca = semAcento(guerra);

  // Prefere a ocorrencia isolada, para "COSTA" nao casar dentro de "ACOSTA".
  const isolada = new RegExp(`(^|\\s)${busca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
  const casamento = isolada.exec(alvo);

  const inicio = casamento
    ? casamento.index + (casamento[1] ? casamento[1].length : 0)
    : alvo.indexOf(busca);

  if (inicio < 0) return [{ texto: completo, negrito: false }];

  const fim = inicio + guerra.length;
  const partes: ParteNome[] = [];

  if (inicio > 0) partes.push({ texto: completo.slice(0, inicio), negrito: false });
  partes.push({ texto: completo.slice(inicio, fim), negrito: true });
  if (fim < completo.length) partes.push({ texto: completo.slice(fim), negrito: false });

  return partes;
}

/** Codigo curto de conferencia, impresso no PDF assinado. */
export function gerarCodigoAssinatura(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  for (let i = 0; i < 12; i++) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    if (i === 3 || i === 7) codigo += "-";
  }
  return codigo;
}

export const ROTULOS_STATUS_ASSINATURA: Record<string, string> = {
  PENDENTE: "Aguardando assinatura",
  ASSINADO: "Assinado",
  RECUSADO: "Recusado",
};

/**
 * Partes do nome como saem na assinatura, ja com o posto ou graduacao no fim.
 *
 * O posto entra fora do negrito e dentro do sublinhado, formando uma unica
 * linha: "Paulo Henrique **do Carmo** Costa – Cel".
 */
export function partesDaAssinatura(
  nomeCompleto: string,
  nomeGuerra: string,
  posto?: string | null
): ParteNome[] {
  const partes = partesDoNome(nomeCompleto, nomeGuerra);
  if (!partes.length) return partes;

  const rotulo = rotuloPosto(posto);
  // "Não informado" é o texto de quem não tem posto cadastrado; não vale grafar.
  if (!posto || posto === "NAO_INFORMADO" || !rotulo) return partes;

  return [...partes, { texto: ` – ${rotulo}`, negrito: false }];
}
