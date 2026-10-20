import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao-servidor";

const selecao = {
  id: true, tipo: true, status: true, resumo: true, dados: true,
  justificativa: true, criadoEm: true, revisadoEm: true,
  solicitante: { select: { id: true, nomeGuerra: true, nomeCompleto: true, posto: true, secao: true } },
  revisor: { select: { id: true, nomeGuerra: true, posto: true } },
};

/**
 * O Administrador Geral ve toda a fila; os demais acompanham apenas as
 * inclusoes que eles proprios enviaram.
 */
export async function GET() {
  const { usuario, erro } = await exigirSessao();
  if (erro) return erro;

  const ehAdminGeral = usuario!.perfil === "ADMINISTRADOR_GERAL";

  const solicitacoes = await prisma.solicitacao.findMany({
    where: ehAdminGeral ? {} : { solicitanteId: usuario!.id },
    select: selecao,
    orderBy: [{ status: "asc" }, { criadoEm: "desc" }],
    take: 300,
  });

  return NextResponse.json({
    solicitacoes,
    pendentes: solicitacoes.filter((s) => s.status === "PENDENTE").length,
    ehAdminGeral,
  });
}
