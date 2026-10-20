import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirSessao } from "@/lib/sessao-servidor";
import { criarFerias, validarFerias } from "@/lib/criacoes";
import { inclusaoEmDuasEtapas, respostaDeErro } from "@/lib/aprovacoes";
import { ordemPosto } from "@/lib/postos";

const selecao = {
  id: true, inicio: true, termino: true, prontoParaServico: true, anoAquisitivo: true,
  periodoAquisitivo: true, qtdDias: true, diasDesconto: true, diasDispensa: true,
  pagamento: true, observacao: true,
  militar: { select: { id: true, nomeCompleto: true, nomeGuerra: true, posto: true, secao: true, quadro: true } },
  substituto: { select: { id: true, nomeGuerra: true, posto: true } },
};

export async function GET() {
  const { erro } = await exigirSessao();
  if (erro) return erro;

  const ferias = await prisma.ferias.findMany({ select: selecao });
  ferias.sort(
    (a, b) =>
      ordemPosto(a.militar.posto) - ordemPosto(b.militar.posto) ||
      a.militar.nomeGuerra.localeCompare(b.militar.nomeGuerra)
  );

  return NextResponse.json({ ferias });
}

export async function POST(req: Request) {
  const { usuario, erro } = await exigirPermissao("paginaInicial");
  if (erro) return erro;

  const dados = await req.json();

  try {
    validarFerias(dados);
    return await inclusaoEmDuasEtapas({
      tipo: "FERIAS",
      usuario: usuario!,
      resumo: `Férias de ${dados.inicio} a ${dados.termino}`,
      dados,
      executar: () => criarFerias(dados),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
