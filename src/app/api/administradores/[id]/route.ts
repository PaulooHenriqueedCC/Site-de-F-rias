import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminGeral } from "@/lib/sessao-servidor";

/** Atualiza as permissoes de um administrador. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirAdminGeral();
  if (erro) return erro;

  const { permissoes } = await req.json();
  const alvo = await prisma.militar.findUnique({ where: { id: params.id } });
  if (!alvo) return NextResponse.json({ erro: "Administrador não encontrado." }, { status: 404 });
  if (alvo.perfil === "ADMINISTRADOR_GERAL") {
    return NextResponse.json({ erro: "O Administrador Geral já tem acesso total." }, { status: 400 });
  }

  await prisma.militar.update({ where: { id: params.id }, data: { permissoes } });
  return NextResponse.json({ ok: true });
}

/** Rebaixa o administrador para usuario comum. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { erro } = await exigirAdminGeral();
  if (erro) return erro;

  const alvo = await prisma.militar.findUnique({ where: { id: params.id } });
  if (!alvo) return NextResponse.json({ erro: "Administrador não encontrado." }, { status: 404 });
  if (alvo.perfil === "ADMINISTRADOR_GERAL") {
    return NextResponse.json({ erro: "O Administrador Geral não pode ser rebaixado." }, { status: 403 });
  }

  await prisma.militar.update({ where: { id: params.id }, data: { perfil: "USUARIO", permissoes: {} } });
  return NextResponse.json({ ok: true });
}
