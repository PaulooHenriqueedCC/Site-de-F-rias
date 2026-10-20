import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { conferirSenha, gerarHash } from "@/lib/senha";
import { exigirSessao } from "@/lib/sessao-servidor";
import { senhaValida } from "@/lib/validacao";
import { quadrosDisponiveis } from "@/lib/postos";
import { assinarSessao, COOKIE_SESSAO } from "@/lib/auth";
import type { MapaPermissoes } from "@/lib/permissoes";
import type { Posto, Quadro } from "@prisma/client";

export async function GET() {
  const { usuario, erro } = await exigirSessao();
  if (erro) return erro;

  const militar = await prisma.militar.findUnique({
    where: { id: usuario!.id },
    select: {
      id: true, nomeCompleto: true, identidade: true, nomeGuerra: true, ramal: true,
      secao: true, telefone: true, posto: true, quadro: true, perfil: true,
      permissoes: true, senhaTemporaria: true,
    },
  });

  return NextResponse.json({ militar });
}

/** Atualiza os dados do proprio perfil. */
export async function PUT(req: Request) {
  const { usuario, erro } = await exigirSessao();
  if (erro) return erro;

  const { nomeCompleto, nomeGuerra, ramal, secao, telefone, posto, quadro } = await req.json();
  if (!nomeCompleto || !nomeGuerra || !secao || !posto) {
    return NextResponse.json({ erro: "Preencha nome completo, nome de guerra, seção e posto." }, { status: 400 });
  }
  if (!quadrosDisponiveis(posto).includes(quadro)) {
    return NextResponse.json({ erro: "O quadro selecionado não se aplica a este posto." }, { status: 400 });
  }

  const militar = await prisma.militar.update({
    where: { id: usuario!.id },
    data: {
      nomeCompleto, nomeGuerra, secao,
      ramal: ramal || null,
      telefone: telefone || null,
      posto: posto as Posto,
      quadro: (quadro || "NENHUM") as Quadro,
    },
  });

  // Renova o token para o cabecalho refletir o nome de guerra novo.
  const token = await assinarSessao({
    id: militar.id,
    identidade: militar.identidade,
    nomeCompleto: militar.nomeCompleto,
    nomeGuerra: militar.nomeGuerra,
    posto: militar.posto,
    perfil: militar.perfil,
    permissoes: (militar.permissoes as MapaPermissoes) ?? null,
  });

  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return resposta;
}

/** Troca a senha do proprio usuario. */
export async function PATCH(req: Request) {
  const { usuario, erro } = await exigirSessao();
  if (erro) return erro;

  const { senhaAtual, senhaNova, confirmacao } = await req.json();
  const checagem = senhaValida(String(senhaNova ?? ""));
  if (!checagem.ok) return NextResponse.json({ erro: checagem.erro }, { status: 400 });
  if (senhaNova !== confirmacao) {
    return NextResponse.json({ erro: "A confirmação não confere com a senha nova." }, { status: 400 });
  }

  const militar = await prisma.militar.findUnique({ where: { id: usuario!.id } });
  if (!militar) return NextResponse.json({ erro: "Cadastro não encontrado." }, { status: 404 });

  if (!(await conferirSenha(String(senhaAtual ?? ""), militar.senhaHash))) {
    return NextResponse.json(
      { erro: "Senha atual incorreta. Peça uma senha temporária ao Administrador Geral." },
      { status: 401 }
    );
  }

  await prisma.militar.update({
    where: { id: militar.id },
    data: { senhaHash: await gerarHash(senhaNova), senhaTemporaria: false },
  });

  return NextResponse.json({ ok: true });
}
