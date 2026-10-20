import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirSessao } from "@/lib/sessao-servidor";
import { criarMilitar, validarMilitar } from "@/lib/criacoes";
import { inclusaoEmDuasEtapas, respostaDeErro } from "@/lib/aprovacoes";
import { ordenarPorAntiguidade } from "@/lib/postos";

export async function GET() {
  const { erro } = await exigirSessao();
  if (erro) return erro;

  const militares = await prisma.militar.findMany({
    where: { ativo: true },
    select: {
      id: true, nomeCompleto: true, identidade: true, nomeGuerra: true, ramal: true,
      secao: true, telefone: true, posto: true, quadro: true, perfil: true,
      identidadePendente: true, antiguidade: true,
      _count: { select: { ferias: true, dispensas: true, descontos: true } },
    },
  });

  // A antiguidade definida na aba Efetivo manda em toda lista do sistema.
  return NextResponse.json({ militares: ordenarPorAntiguidade(militares) });
}

export async function POST(req: Request) {
  const { usuario, erro } = await exigirPermissao("efetivo");
  if (erro) return erro;

  const dados = await req.json();

  try {
    await validarMilitar(dados);
  } catch (e) {
    return respostaDeErro(e);
  }

  // Etapa 1 da verificacao: a inclusao aguarda o aval do Administrador Geral.
  try {
    return await inclusaoEmDuasEtapas({
      tipo: "MILITAR",
      usuario: usuario!,
      resumo: `${dados.nomeGuerra ?? dados.nomeCompleto} — inclusão no efetivo`,
      dados,
      executar: () => criarMilitar(dados),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
