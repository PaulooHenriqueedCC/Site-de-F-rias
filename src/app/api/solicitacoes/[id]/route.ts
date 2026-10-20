import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminGeral, exigirSessao } from "@/lib/sessao-servidor";
import { executarSolicitacao, respostaDeErro, type TipoSolicitacaoValor } from "@/lib/aprovacoes";

/**
 * Etapa 2 da verificacao: somente o Administrador Geral aprova ou recusa.
 * Na aprovacao, o registro guardado em `dados` e finalmente gravado.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { usuario, erro } = await exigirAdminGeral();
  if (erro) return erro;

  const { decisao, justificativa } = await req.json();
  if (decisao !== "APROVAR" && decisao !== "RECUSAR") {
    return NextResponse.json({ erro: "Informe se a solicitação será aprovada ou recusada." }, { status: 400 });
  }

  const solicitacao = await prisma.solicitacao.findUnique({ where: { id: params.id } });
  if (!solicitacao) return NextResponse.json({ erro: "Solicitação não encontrada." }, { status: 404 });
  if (solicitacao.status !== "PENDENTE") {
    return NextResponse.json({ erro: "Esta solicitação já foi revisada." }, { status: 409 });
  }

  if (decisao === "RECUSAR") {
    await prisma.solicitacao.update({
      where: { id: params.id },
      data: {
        status: "RECUSADA",
        revisorId: usuario!.id,
        revisadoEm: new Date(),
        justificativa: justificativa || null,
      },
    });
    return NextResponse.json({ ok: true, status: "RECUSADA" });
  }

  let resultado: Record<string, unknown>;
  try {
    resultado = await executarSolicitacao(solicitacao.tipo as TipoSolicitacaoValor, solicitacao.dados);
  } catch (e) {
    // A solicitacao continua pendente para que o erro possa ser corrigido.
    return respostaDeErro(e);
  }

  await prisma.solicitacao.update({
    where: { id: params.id },
    data: {
      status: "APROVADA",
      revisorId: usuario!.id,
      revisadoEm: new Date(),
      justificativa: justificativa || null,
    },
  });

  return NextResponse.json({ ok: true, status: "APROVADA", resultado });
}

/** O solicitante pode cancelar a propria inclusao enquanto ela estiver pendente. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { usuario, erro } = await exigirSessao();
  if (erro) return erro;

  const solicitacao = await prisma.solicitacao.findUnique({ where: { id: params.id } });
  if (!solicitacao) return NextResponse.json({ erro: "Solicitação não encontrada." }, { status: 404 });

  const ehDono = solicitacao.solicitanteId === usuario!.id;
  if (!ehDono && usuario!.perfil !== "ADMINISTRADOR_GERAL") {
    return NextResponse.json({ erro: "Você só pode cancelar as suas próprias solicitações." }, { status: 403 });
  }
  if (solicitacao.status !== "PENDENTE") {
    return NextResponse.json({ erro: "Só é possível cancelar solicitações pendentes." }, { status: 409 });
  }

  await prisma.solicitacao.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
