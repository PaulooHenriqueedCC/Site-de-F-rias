import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao-servidor";
import { identidadeValida } from "@/lib/validacao";
import { quadrosDisponiveis } from "@/lib/postos";
import type { Posto, Quadro } from "@prisma/client";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("efetivo");
  if (erro) return erro;

  const dados = await req.json();
  if (dados.identidade && !identidadeValida(dados.identidade)) {
    return NextResponse.json({ erro: "A identidade precisa seguir o formato 111.222.333-4." }, { status: 400 });
  }
  if (dados.quadro && !quadrosDisponiveis(dados.posto).includes(dados.quadro)) {
    return NextResponse.json({ erro: "O quadro selecionado não se aplica a este posto." }, { status: 400 });
  }

  try {
    const militar = await prisma.militar.update({
      where: { id: params.id },
      data: {
        nomeCompleto: dados.nomeCompleto,
        nomeGuerra: dados.nomeGuerra,
        ramal: dados.ramal || null,
        secao: dados.secao || "NAO INFORMADA",
        telefone: dados.telefone || null,
        posto: (dados.posto || "NAO_INFORMADO") as Posto,
        quadro: (dados.quadro || "NENHUM") as Quadro,
        ...(dados.identidade ? { identidade: dados.identidade, identidadePendente: false } : {}),
      },
    });
    return NextResponse.json({ ok: true, militar });
  } catch {
    return NextResponse.json({ erro: "Identidade já usada por outro militar." }, { status: 409 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("efetivo");
  if (erro) return erro;

  const militar = await prisma.militar.findUnique({ where: { id: params.id } });
  if (!militar) return NextResponse.json({ erro: "Militar não encontrado." }, { status: 404 });
  if (militar.perfil === "ADMINISTRADOR_GERAL") {
    return NextResponse.json({ erro: "O Administrador Geral não pode ser excluído." }, { status: 403 });
  }

  await prisma.militar.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
