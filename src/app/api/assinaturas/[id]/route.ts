import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao-servidor";
import { respostaDeErro } from "@/lib/aprovacoes";
import { ehAdministrador } from "@/lib/permissoes";

/** Devolve o documento inteiro, com as linhas congeladas, para montar o PDF. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { usuario, erro } = await exigirSessao();
  if (erro) return erro;

  const documento = await prisma.documentoAssinatura.findUnique({
    where: { id: params.id },
    include: {
      signatario: { select: { id: true, nomeCompleto: true, nomeGuerra: true, posto: true, secao: true } },
      solicitante: { select: { id: true, nomeGuerra: true, posto: true } },
    },
  });

  if (!documento) {
    return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
  }

  // Só o signatário e os administradores enxergam o conteúdo.
  const proprio = documento.signatarioId === usuario!.id;
  if (!proprio && !ehAdministrador(usuario)) {
    return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });
  }

  return NextResponse.json({ documento });
}

/**
 * Assina ou recusa o documento.
 *
 * Somente o militar indicado como signatario pode fazer isso, e somente uma
 * vez: um documento ja assinado ou recusado nao volta atras, porque e ele que
 * serve de historico.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { usuario, erro } = await exigirSessao();
  if (erro) return erro;

  try {
    const { acao, motivoRecusa } = await req.json();

    const documento = await prisma.documentoAssinatura.findUnique({
      where: { id: params.id },
      select: { id: true, signatarioId: true, status: true },
    });

    if (!documento) {
      return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
    }
    if (documento.signatarioId !== usuario!.id) {
      return NextResponse.json(
        { erro: "Somente o militar indicado pode assinar este documento." },
        { status: 403 }
      );
    }
    if (documento.status !== "PENDENTE") {
      return NextResponse.json({ erro: "Este documento já foi respondido." }, { status: 409 });
    }

    if (acao === "recusar") {
      const atualizado = await prisma.documentoAssinatura.update({
        where: { id: documento.id },
        data: {
          status: "RECUSADO",
          motivoRecusa: String(motivoRecusa ?? "").trim().slice(0, 400) || null,
          assinadoEm: new Date(),
        },
        select: { id: true, status: true },
      });
      return NextResponse.json({ ok: true, ...atualizado, aviso: "Documento recusado." });
    }

    const atualizado = await prisma.documentoAssinatura.update({
      where: { id: documento.id },
      data: { status: "ASSINADO", assinadoEm: new Date() },
      select: { id: true, status: true, assinadoEm: true, codigo: true },
    });

    return NextResponse.json({
      ok: true,
      ...atualizado,
      aviso: "Documento assinado. Ele já está disponível para o administrador exportar.",
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
