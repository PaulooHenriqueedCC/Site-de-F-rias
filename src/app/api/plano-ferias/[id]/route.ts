import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao-servidor";
import { dadosDoPlano } from "@/lib/criacoes";
import { respostaDeErro } from "@/lib/aprovacoes";

/** Edicao livre da linha: todos os campos do modelo sao editaveis. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("planoFerias");
  if (erro) return erro;

  const dados = await req.json();

  try {
    const linha = await prisma.planoFerias.update({
      where: { id: params.id },
      data: dadosDoPlano(dados),
    });
    return NextResponse.json({ ok: true, linha });
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("planoFerias");
  if (erro) return erro;

  await prisma.planoFerias.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
