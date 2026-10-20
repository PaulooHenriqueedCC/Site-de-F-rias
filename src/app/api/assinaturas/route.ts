import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirSessao } from "@/lib/sessao-servidor";
import { respostaDeErro } from "@/lib/aprovacoes";
import { gerarCodigoAssinatura } from "@/lib/assinaturas";
import { ehAdministrador } from "@/lib/permissoes";

const resumo = {
  id: true, titulo: true, funcao: true, status: true, recorte: true,
  observacao: true, motivoRecusa: true, codigo: true,
  criadoEm: true, assinadoEm: true,
  signatario: { select: { id: true, nomeCompleto: true, nomeGuerra: true, posto: true, secao: true } },
  solicitante: { select: { id: true, nomeGuerra: true, posto: true } },
};

/**
 * Lista os documentos de assinatura.
 *
 * - `escopo=minhas` devolve o que aguarda a assinatura de quem esta logado. E o
 *   que alimenta a aba "Aprovar e assinar", que so aparece quando ha algo aqui.
 * - `escopo=historico` devolve tudo, para a aba "Assinados" do administrador.
 *
 * O conteudo congelado (`linhas` e `cabecalho`) so vem quando pedido pelo
 * parametro `completo`, porque e pesado e nao serve para montar as listas.
 */
export async function GET(req: Request) {
  const { usuario, erro } = await exigirSessao();
  if (erro) return erro;

  const url = new URL(req.url);
  const escopo = url.searchParams.get("escopo") ?? "minhas";
  const completo = url.searchParams.get("completo") === "1";

  const selecao = completo ? { ...resumo, linhas: true, cabecalho: true } : resumo;

  if (escopo === "historico") {
    if (!ehAdministrador(usuario)) {
      return NextResponse.json({ erro: "Acesso restrito aos administradores." }, { status: 403 });
    }

    const documentos = await prisma.documentoAssinatura.findMany({
      select: selecao,
      orderBy: [{ criadoEm: "desc" }],
    });
    return NextResponse.json({ documentos });
  }

  // Só o próprio militar vê o que está aguardando a assinatura dele.
  const documentos = await prisma.documentoAssinatura.findMany({
    where: { signatarioId: usuario!.id, status: "PENDENTE" },
    select: selecao,
    orderBy: [{ criadoEm: "asc" }],
  });

  return NextResponse.json({ documentos, pendentes: documentos.length });
}

/**
 * Envia o plano para a assinatura de um militar.
 *
 * As linhas e o cabecalho sao congelados agora: o militar assina o documento
 * que lhe foi mostrado, e mexer no plano depois disso nao altera o que ele
 * assinou. Nao passa pela fila de Aprovacoes — a propria assinatura ja e a
 * conferencia, e quem assina e outra pessoa.
 */
export async function POST(req: Request) {
  const { usuario, erro } = await exigirPermissao("planoFerias");
  if (erro) return erro;

  try {
    const { signatarioId, funcao, titulo, linhas, cabecalho, recorte, observacao } =
      await req.json();

    if (!signatarioId) {
      return NextResponse.json({ erro: "Selecione quem vai assinar." }, { status: 400 });
    }
    if (!String(funcao ?? "").trim()) {
      return NextResponse.json({ erro: "Informe a função do militar." }, { status: 400 });
    }
    if (!Array.isArray(linhas) || !linhas.length) {
      return NextResponse.json({ erro: "Não há linhas para enviar." }, { status: 400 });
    }

    const signatario = await prisma.militar.findUnique({
      where: { id: signatarioId },
      select: { id: true, nomeGuerra: true, ativo: true },
    });
    if (!signatario?.ativo) {
      return NextResponse.json({ erro: "Militar não encontrado no efetivo." }, { status: 404 });
    }

    const documento = await prisma.documentoAssinatura.create({
      data: {
        titulo: String(titulo ?? "Plano de férias").slice(0, 160),
        funcao: String(funcao).trim().slice(0, 160),
        signatarioId: signatario.id,
        solicitanteId: usuario!.id,
        linhas,
        cabecalho,
        recorte: recorte ? String(recorte).slice(0, 240) : null,
        observacao: observacao ? String(observacao).slice(0, 400) : null,
        codigo: gerarCodigoAssinatura(),
      },
      select: resumo,
    });

    return NextResponse.json(
      {
        ok: true,
        documento,
        aviso: `Enviado para a assinatura de ${signatario.nomeGuerra}. Ele verá a aba “Aprovar e assinar” ao entrar no sistema.`,
      },
      { status: 201 }
    );
  } catch (e) {
    return respostaDeErro(e);
  }
}
