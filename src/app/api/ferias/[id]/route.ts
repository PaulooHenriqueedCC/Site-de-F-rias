import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao-servidor";
import { contarDias, paraData } from "@/lib/datas";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("paginaInicial");
  if (erro) return erro;

  const dados = await req.json();
  const inicio = paraData(dados.inicio);
  const termino = paraData(dados.termino);
  if (!inicio || !termino) return NextResponse.json({ erro: "Informe o início e o término das férias." }, { status: 400 });
  if (termino < inicio) return NextResponse.json({ erro: "O término não pode ser anterior ao início." }, { status: 400 });

  const ferias = await prisma.ferias.update({
    where: { id: params.id },
    data: {
      militarId: dados.militarId,
      substitutoId: dados.substitutoId || null,
      inicio,
      termino,
      prontoParaServico: paraData(dados.prontoParaServico),
      anoAquisitivo: String(dados.anoAquisitivo || new Date().getFullYear()),
      periodoAquisitivo: String(dados.periodoAquisitivo || "1"),
      qtdDias: Number(dados.qtdDias) || contarDias(inicio, termino),
      diasDesconto: Number(dados.diasDesconto) || 0,
      diasDispensa: Number(dados.diasDispensa) || 0,
      pagamento: Boolean(dados.pagamento),
      observacao: dados.observacao || null,
    },
  });

  return NextResponse.json({ ok: true, ferias });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirPermissao("paginaInicial");
  if (erro) return erro;

  await prisma.ferias.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
