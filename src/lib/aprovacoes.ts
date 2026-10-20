import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/permissoes";
import {
  ErroValidacao,
  criarFerias,
  criarMilitar,
  criarPagamento,
  criarPeriodo,
  criarPlanoFerias,
  criarAdministrador,
  importarLinhasEfetivo,
  importarLinhasPlano,
} from "@/lib/criacoes";
import {
  MENSAGEM_PENDENTE,
  ROTULOS_SOLICITACAO,
  ORIGEM_SOLICITACAO,
  type TipoSolicitacaoValor,
} from "@/lib/solicitacoes-modelo";
import type { TipoSolicitacao } from "@prisma/client";

export { MENSAGEM_PENDENTE, ROTULOS_SOLICITACAO, ORIGEM_SOLICITACAO };
export type { TipoSolicitacaoValor };

/**
 * Verificacao em duas etapas das inclusoes.
 *
 * Etapa 1: o Administrador envia a inclusao, que fica registrada como pendente.
 * Etapa 2: o Administrador Geral aprova ou recusa; so na aprovacao o registro
 *          e efetivamente gravado.
 *
 * O proprio Administrador Geral e o aprovador, entao as inclusoes feitas por
 * ele sao gravadas na hora.
 */

/** Deixa o resumo legivel para quem vai aprovar, citando o militar envolvido. */
async function comNomeDoMilitar(resumo: string, dados: unknown): Promise<string> {
  const militarId = (dados as { militarId?: string } | null)?.militarId;
  if (!militarId) return resumo;

  const militar = await prisma.militar.findUnique({
    where: { id: militarId },
    select: { nomeGuerra: true, nomeCompleto: true },
  });
  if (!militar) return resumo;

  return `${militar.nomeGuerra} (${militar.nomeCompleto}) — ${resumo}`;
}

/**
 * Grava direto quando quem age e o Administrador Geral; caso contrario abre
 * uma solicitacao pendente. Devolve sempre uma NextResponse pronta.
 */
export async function inclusaoEmDuasEtapas({
  tipo,
  usuario,
  resumo,
  dados,
  executar,
  forcarFila = false,
  mensagem,
}: {
  tipo: TipoSolicitacaoValor;
  usuario: UsuarioSessao;
  resumo: string;
  dados: unknown;
  executar: () => Promise<Record<string, unknown>>;
  /** Quando ligado, ate o Administrador Geral passa pela fila de aprovacao. */
  forcarFila?: boolean;
  mensagem?: string;
}): Promise<NextResponse> {
  if (usuario.perfil === "ADMINISTRADOR_GERAL" && !forcarFila) {
    const resultado = await executar();
    return NextResponse.json({ ok: true, pendente: false, ...resultado }, { status: 201 });
  }

  const solicitacao = await prisma.solicitacao.create({
    data: {
      tipo: tipo as TipoSolicitacao,
      resumo: await comNomeDoMilitar(resumo, dados),
      dados: dados as never,
      solicitanteId: usuario.id,
    },
  });

  return NextResponse.json(
    { ok: true, pendente: true, solicitacaoId: solicitacao.id, aviso: mensagem ?? MENSAGEM_PENDENTE },
    { status: 202 }
  );
}

/** Executa o que estava guardado na solicitacao aprovada. */
export async function executarSolicitacao(tipo: TipoSolicitacaoValor, dados: any) {
  switch (tipo) {
    case "MILITAR":
      return criarMilitar(dados);
    case "IMPORTACAO_EFETIVO":
      return importarLinhasEfetivo(dados?.linhas ?? []);
    case "IMPORTACAO_PLANO":
      return importarLinhasPlano(dados?.linhas ?? []);
    case "ADMINISTRADOR":
      return criarAdministrador(dados);
    case "FERIAS":
      return criarFerias(dados);
    case "PLANO_FERIAS":
      return criarPlanoFerias(dados);
    case "DISPENSA":
      return criarPeriodo("dispensas", dados);
    case "DESCONTO":
      return criarPeriodo("descontos", dados);
    case "PAGAMENTO":
      return criarPagamento(dados);
    default:
      throw new ErroValidacao("Tipo de solicitação desconhecido.");
  }
}

/** Converte um ErroValidacao em resposta HTTP; repassa os demais erros. */
export function respostaDeErro(e: unknown): NextResponse {
  if (e instanceof ErroValidacao) {
    return NextResponse.json({ erro: e.message }, { status: e.status });
  }
  return NextResponse.json({ erro: "Não foi possível concluir a operação." }, { status: 500 });
}
