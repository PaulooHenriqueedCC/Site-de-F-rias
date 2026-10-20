import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao-servidor";
import { paraData } from "@/lib/datas";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("pagamento");
  if (erro) return erro;

  const dados = await req.json();
  const registro = await prisma.pagamento.update({
    where: { id: params.id },
    data: {
      militarId: dados.militarId,
      diex: dados.diex || null,
      dataDiex: paraData(dados.dataDiex),
      pago: Boolean(dados.pago),
      observacao: dados.observacao || null,
    },
  });

  return NextResponse.json({ ok: true, registro });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("pagamento");
  if (erro) return erro;

  await prisma.pagamento.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
