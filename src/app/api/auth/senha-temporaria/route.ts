import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gerarHash, gerarSenhaTemporaria } from "@/lib/senha";
import { exigirAdminGeral } from "@/lib/sessao-servidor";

/** Somente o Administrador Geral gera senha temporaria para um militar. */
export async function POST(req: Request) {
  const { erro } = await exigirAdminGeral();
  if (erro) return erro;

  const { militarId } = await req.json();
  const militar = await prisma.militar.findUnique({ where: { id: militarId } });
  if (!militar) return NextResponse.json({ erro: "Militar não encontrado." }, { status: 404 });

  const temporaria = gerarSenhaTemporaria();
  await prisma.militar.update({
    where: { id: militar.id },
    data: { senhaHash: await gerarHash(temporaria), senhaTemporaria: true },
  });

  return NextResponse.json({ ok: true, senhaTemporaria: temporaria, militar: militar.nomeGuerra });
}
