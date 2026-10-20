import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao-servidor";
import { respostaDeErro } from "@/lib/aprovacoes";

/**
 * Grava a ordem manual das linhas do plano (setas para cima e para baixo).
 *
 * E uma alteracao, nao uma inclusao, entao vale na hora — como as demais
 * edicoes de linha, que tambem nao passam pela fila de Aprovacoes.
 *
 * Corpo: { ordens: [{ id, ordem }] }
 */
export async function PUT(req: Request) {
  const { erro } = await exigirPermissao("planoFerias");
  if (erro) return erro;

  try {
    const { ordens } = await req.json();

    if (!Array.isArray(ordens) || !ordens.length) {
      return NextResponse.json({ erro: "Nenhuma ordem informada." }, { status: 400 });
    }

    await prisma.$transaction(
      ordens
        .filter((o: { id?: string }) => Boolean(o?.id))
        .map((o: { id: string; ordem: number }) =>
          prisma.planoFerias.update({
            where: { id: o.id },
            data: { ordem: Number(o.ordem) || 0 },
          })
        )
    );

    return NextResponse.json({ ok: true, atualizadas: ordens.length });
  } catch (e) {
    return respostaDeErro(e);
  }
}
