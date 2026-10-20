/**
 * Rotulos e tipos da verificacao em duas etapas. Fica separado de
 * `aprovacoes.ts` para que as telas possam importar sem puxar codigo de servidor.
 */

export type TipoSolicitacaoValor =
  | "MILITAR" | "IMPORTACAO_EFETIVO" | "IMPORTACAO_PLANO" | "ADMINISTRADOR"
  | "FERIAS" | "PLANO_FERIAS"
  | "DISPENSA" | "DESCONTO" | "PAGAMENTO";

export const ROTULOS_SOLICITACAO: Record<TipoSolicitacaoValor, string> = {
  MILITAR: "Inclusão no efetivo",
  IMPORTACAO_EFETIVO: "Importação de efetivo",
  IMPORTACAO_PLANO: "Importação do plano de férias",
  ADMINISTRADOR: "Cadastro de administrador",
  FERIAS: "Lançamento no quadro de férias",
  PLANO_FERIAS: "Linha do plano de férias",
  DISPENSA: "Período de dispensa como recompensa",
  DESCONTO: "Período de desconto em férias",
  PAGAMENTO: "Registro de pagamento de férias",
};

export const ORIGEM_SOLICITACAO: Record<TipoSolicitacaoValor, string> = {
  MILITAR: "/dashboard/efetivo",
  IMPORTACAO_EFETIVO: "/dashboard/efetivo",
  IMPORTACAO_PLANO: "/dashboard/plano-ferias",
  ADMINISTRADOR: "/dashboard/administradores",
  FERIAS: "/dashboard",
  PLANO_FERIAS: "/dashboard/plano-ferias",
  DISPENSA: "/dashboard/dispensa",
  DESCONTO: "/dashboard/desconto",
  PAGAMENTO: "/dashboard/pagamento",
};

export const MENSAGEM_PENDENTE =
  "Inclusão enviada para aprovação do Administrador Geral. Ela só entrará no sistema após a segunda etapa.";

/** O cadastro de administrador vai para a fila mesmo quando o proprio Geral o envia. */
export const MENSAGEM_PENDENTE_ADMIN =
  "Cadastro enviado para a aba Aprovações. Todo administrador novo precisa ser aprovado lá antes de entrar no sistema.";

/** A concessao de privilegios segue a mesma regra do cadastro de administrador. */
export const MENSAGEM_PENDENTE_PRIVILEGIOS =
  "Concessão enviada para a aba Aprovações. O militar só passa a ser administrador depois de aprovada a segunda etapa.";

/**
 * Rotulo da solicitacao na tela de Aprovacoes.
 *
 * O tipo ADMINISTRADOR cobre dois casos: o cadastro de uma conta nova e a
 * concessao de privilegios a quem ja esta no efetivo. A presenca de `militarId`
 * nos dados distingue um do outro.
 */
export function rotuloSolicitacao(
  tipo: TipoSolicitacaoValor,
  dados?: Record<string, unknown> | null
): string {
  if (tipo === "ADMINISTRADOR" && dados?.militarId) return "Concessão de privilégios";
  return ROTULOS_SOLICITACAO[tipo] ?? tipo;
}
