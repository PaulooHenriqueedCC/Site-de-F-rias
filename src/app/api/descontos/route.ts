import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirVisualizacao } from "@/lib/sessao-servidor";
import { criarPeriodo, validarPeriodo } from "@/lib/criacoes";
import { inclusaoEmDuasEtapas, respostaDeErro } from "@/lib/aprovacoes";
import { ordemPosto } from "@/lib/postos";

const selecao = {
  id: true, inicio: true, termino: true, dias: true, motivo: true, comentario: true, criadoEm: true,
  militar: { select: { id: true, nomeCompleto: true, nomeGuerra: true, posto: true, secao: true } },
};

export async function GET() {
  const { erro } = await exigirVisualizacao("desconto");
  if (erro) return erro;

  const registros = await prisma.desconto.findMany({ select: selecao, orderBy: { inicio: "desc" } });
  registros.sort(
    (a, b) =>
      ordemPosto(a.militar.posto) - ordemPosto(b.militar.posto) ||
      a.militar.nomeGuerra.localeCompare(b.militar.nomeGuerra) ||
      b.inicio.getTime() - a.inicio.getTime()
  );

  return NextResponse.json({ registros });
}

export async function POST(req: Request) {
  const { usuario, erro } = await exigirPermissao("desconto");
  if (erro) return erro;

  const dados = await req.json();

  try {
    validarPeriodo(dados);
    return await inclusaoEmDuasEtapas({
      tipo: "DESCONTO",
      usuario: usuario!,
      resumo: `Desconto de ${dados.dias} dia(s), de ${dados.inicio} a ${dados.termino}`,
      dados,
      executar: () => criarPeriodo("descontos", dados),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
