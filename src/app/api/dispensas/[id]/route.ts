import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao-servidor";
import { contarDias, paraData } from "@/lib/datas";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("dispensa");
  if (erro) return erro;

  const dados = await req.json();
  const inicio = paraData(dados.inicio);
  const termino = paraData(dados.termino);
  if (!inicio || !termino) return NextResponse.json({ erro: "Informe o início e o término do período." }, { status: 400 });
  if (termino < inicio) return NextResponse.json({ erro: "O término não pode ser anterior ao início." }, { status: 400 });

  const registro = await prisma.dispensa.update({
    where: { id: params.id },
    data: {
      militarId: dados.militarId,
      inicio,
      termino,
      dias: Number(dados.dias) || contarDias(inicio, termino),
      motivo: dados.motivo || null,
      comentario: dados.comentario || null,
    },
  });

  return NextResponse.json({ ok: true, registro });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("dispensa");
  if (erro) return erro;

  await prisma.dispensa.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
