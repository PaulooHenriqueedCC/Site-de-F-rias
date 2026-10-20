import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdminGeral } from "@/lib/sessao-servidor";
import { criarAdministrador, validarAdministrador } from "@/lib/criacoes";
import { gerarHash } from "@/lib/senha";
import { inclusaoEmDuasEtapas, respostaDeErro } from "@/lib/aprovacoes";
import { MENSAGEM_PENDENTE_ADMIN } from "@/lib/solicitacoes-modelo";

export async function GET() {
  const { erro } = await exigirAdminGeral();
  if (erro) return erro;

  const administradores = await prisma.militar.findMany({
    where: { perfil: { in: ["ADMINISTRADOR", "ADMINISTRADOR_GERAL"] } },
    select: {
      id: true, nomeCompleto: true, nomeGuerra: true, identidade: true, posto: true,
      secao: true, perfil: true, permissoes: true, senhaTemporaria: true,
    },
    orderBy: { nomeGuerra: "asc" },
  });

  return NextResponse.json({ administradores });
}

/**
 * Cadastro de administrador. Mesmo partindo do Administrador Geral, a inclusao
 * vai para a fila de Aprovacoes e so entra no sistema depois de aprovada la.
 */
export async function POST(req: Request) {
  const { usuario, erro } = await exigirAdminGeral();
  if (erro) return erro;

  const dados = await req.json();

  try {
    await validarAdministrador(dados);

    // A solicitacao fica guardada no banco: cifra a senha antes de enfileirar.
    const { senha, ...semSenha } = dados;
    const pendente = { ...semSenha, senhaHash: await gerarHash(String(senha)) };

    return await inclusaoEmDuasEtapas({
      tipo: "ADMINISTRADOR",
      usuario: usuario!,
      resumo: `${dados.nomeGuerra} (${dados.nomeCompleto}) — cadastro de administrador`,
      dados: pendente,
      executar: () => criarAdministrador(pendente),
      forcarFila: true,
      mensagem: MENSAGEM_PENDENTE_ADMIN,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
