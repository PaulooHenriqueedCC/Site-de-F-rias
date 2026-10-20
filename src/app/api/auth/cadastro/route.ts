import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gerarHash } from "@/lib/senha";
import { identidadeValida, senhaValida } from "@/lib/validacao";
import { quadrosDisponiveis } from "@/lib/postos";
import type { Posto, Quadro } from "@prisma/client";

export async function POST(req: Request) {
  const corpo = await req.json();
  const { nomeCompleto, identidade, nomeGuerra, ramal, secao, telefone, posto, quadro, senha } = corpo;

  if (!nomeCompleto || !nomeGuerra || !secao || !posto) {
    return NextResponse.json({ erro: "Preencha nome completo, nome de guerra, seção e posto." }, { status: 400 });
  }
  if (!identidadeValida(String(identidade ?? ""))) {
    return NextResponse.json({ erro: "A identidade precisa seguir o formato 111.222.333-4." }, { status: 400 });
  }
  const checagem = senhaValida(String(senha ?? ""));
  if (!checagem.ok) return NextResponse.json({ erro: checagem.erro }, { status: 400 });

  if (!quadrosDisponiveis(posto).includes(quadro)) {
    return NextResponse.json({ erro: "O quadro selecionado não se aplica a este posto." }, { status: 400 });
  }

  const jaExiste = await prisma.militar.findUnique({ where: { identidade } });
  if (jaExiste) {
    return NextResponse.json({ erro: "Já existe cadastro para esta identidade. Use a redefinição de senha." }, { status: 409 });
  }

  // A identidade definida no .env recupera automaticamente o perfil de Administrador Geral.
  const ehAdminGeral = identidade === (process.env.ADMIN_GERAL_IDENTIDADE || "111.689.137-3");

  await prisma.militar.create({
    data: {
      nomeCompleto,
      identidade,
      nomeGuerra,
      ramal: ramal || null,
      secao,
      telefone: telefone || null,
      posto: posto as Posto,
      quadro: (quadro || "NENHUM") as Quadro,
      senhaHash: await gerarHash(senha),
      perfil: ehAdminGeral ? "ADMINISTRADOR_GERAL" : "USUARIO",
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
