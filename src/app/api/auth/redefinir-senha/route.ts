import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { conferirSenha, gerarHash } from "@/lib/senha";
import { identidadeValida, senhaValida } from "@/lib/validacao";

export async function POST(req: Request) {
  const { nomeCompleto, identidade, secao, ramal, senhaAtual, senhaNova } = await req.json();

  if (!identidadeValida(String(identidade ?? ""))) {
    return NextResponse.json({ erro: "A identidade precisa seguir o formato 111.222.333-4." }, { status: 400 });
  }
  const checagem = senhaValida(String(senhaNova ?? ""));
  if (!checagem.ok) return NextResponse.json({ erro: checagem.erro }, { status: 400 });

  const militar = await prisma.militar.findUnique({ where: { identidade } });
  if (!militar) return NextResponse.json({ erro: "Não há cadastro para esta identidade." }, { status: 404 });

  const normalizar = (v: unknown) => String(v ?? "").trim().toUpperCase();
  if (normalizar(nomeCompleto) !== normalizar(militar.nomeCompleto)) {
    return NextResponse.json({ erro: "O nome completo não confere com o cadastro." }, { status: 400 });
  }
  if (normalizar(secao) !== normalizar(militar.secao)) {
    return NextResponse.json({ erro: "A seção não confere com o cadastro." }, { status: 400 });
  }
  if (militar.ramal && String(ramal ?? "").trim() !== militar.ramal) {
    return NextResponse.json({ erro: "O ramal não confere com o cadastro." }, { status: 400 });
  }
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
