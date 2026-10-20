import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao-servidor";
import { respostaDeErro } from "@/lib/aprovacoes";

/**
 * Grava a antiguidade definitiva do efetivo.
 *
 * E uma alteracao de ordenacao, nao uma inclusao, entao vale na hora — como a
 * reordenacao do plano de ferias. O numero gravado passa a valer em todas as
 * listas do sistema.
 *
 * Corpo: { ordens: [{ id, antiguidade }] }
 */
export async function PUT(req: Request) {
  const { erro } = await exigirPermissao("efetivo");
  if (erro) return erro;

  try {
    const { ordens } = await req.json();

    if (!Array.isArray(ordens) || !ordens.length) {
      return NextResponse.json({ erro: "Nenhuma antiguidade informada." }, { status: 400 });
    }

    await prisma.$transaction(
      ordens
        .filter((o: { id?: string }) => Boolean(o?.id))
        .map((o: { id: string; antiguidade: number }) =>
          prisma.militar.update({
            where: { id: o.id },
            data: { antiguidade: Math.max(0, Number(o.antiguidade) || 0) },
          })
        )
    );

    return NextResponse.json({ ok: true, atualizados: ordens.length });
  } catch (e) {
    return respostaDeErro(e);
  }
}
