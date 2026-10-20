import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirVisualizacao } from "@/lib/sessao-servidor";
import { criarPagamento, validarPagamento } from "@/lib/criacoes";
import { inclusaoEmDuasEtapas, respostaDeErro } from "@/lib/aprovacoes";
import { ordemPosto } from "@/lib/postos";

const selecao = {
  id: true, diex: true, dataDiex: true, pago: true, observacao: true, atualizadoEm: true,
  militar: { select: { id: true, nomeCompleto: true, nomeGuerra: true, posto: true, secao: true } },
};

export async function GET() {
  const { erro } = await exigirVisualizacao("pagamento");
  if (erro) return erro;

  const registros = await prisma.pagamento.findMany({ select: selecao });
  registros.sort(
    (a, b) =>
      ordemPosto(a.militar.posto) - ordemPosto(b.militar.posto) ||
      a.militar.nomeGuerra.localeCompare(b.militar.nomeGuerra)
  );

  return NextResponse.json({ registros });
}

export async function POST(req: Request) {
  const { usuario, erro } = await exigirPermissao("pagamento");
  if (erro) return erro;

  const dados = await req.json();

  try {
    validarPagamento(dados);
    return await inclusaoEmDuasEtapas({
      tipo: "PAGAMENTO",
      usuario: usuario!,
      resumo: `Pagamento${dados.diex ? ` — DIEx ${dados.diex}` : ""}`,
      dados,
      executar: () => criarPagamento(dados),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
