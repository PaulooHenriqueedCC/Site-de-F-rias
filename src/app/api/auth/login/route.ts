import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { conferirSenha } from "@/lib/senha";
import { assinarSessao, COOKIE_SESSAO } from "@/lib/auth";
import { identidadeValida } from "@/lib/validacao";
import type { MapaPermissoes } from "@/lib/permissoes";

export async function POST(req: Request) {
  const { identidade, senha, exigirAdministrador } = await req.json();

  if (!identidadeValida(String(identidade ?? ""))) {
    return NextResponse.json({ erro: "A identidade precisa seguir o formato 111.222.333-4." }, { status: 400 });
  }

  const militar = await prisma.militar.findUnique({ where: { identidade } });
  if (!militar || !militar.ativo || !(await conferirSenha(String(senha ?? ""), militar.senhaHash))) {
    return NextResponse.json({ erro: "Identidade ou senha incorreta." }, { status: 401 });
  }

  // A aba "Administrador" do login so aceita contas com perfil administrativo.
  const ehAdministrador = militar.perfil === "ADMINISTRADOR" || militar.perfil === "ADMINISTRADOR_GERAL";
  if (exigirAdministrador && !ehAdministrador) {
    return NextResponse.json(
      { erro: "Esta identidade não tem perfil de administrador. Use a aba Usuário." },
      { status: 403 }
    );
  }

  const token = await assinarSessao({
    id: militar.id,
    identidade: militar.identidade,
    nomeCompleto: militar.nomeCompleto,
    nomeGuerra: militar.nomeGuerra,
    posto: militar.posto,
    perfil: militar.perfil,
    permissoes: (militar.permissoes as MapaPermissoes) ?? null,
  });

  const resposta = NextResponse.json({ ok: true, senhaTemporaria: militar.senhaTemporaria });
  resposta.cookies.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return resposta;
}
