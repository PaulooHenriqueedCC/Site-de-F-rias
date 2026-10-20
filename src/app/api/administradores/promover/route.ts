import { exigirAdminGeral } from "@/lib/sessao-servidor";
import { promoverMilitar, validarPromocao } from "@/lib/criacoes";
import { inclusaoEmDuasEtapas, respostaDeErro } from "@/lib/aprovacoes";
import { MENSAGEM_PENDENTE_PRIVILEGIOS } from "@/lib/solicitacoes-modelo";

/**
 * Concede privilegios de administrador a um militar ja cadastrado no efetivo.
 *
 * Assim como o cadastro de administrador, a concessao passa pela fila de
 * Aprovacoes mesmo quando quem envia e o proprio Administrador Geral: nenhum
 * perfil administrativo novo entra no sistema sem a segunda etapa. O perfil so
 * muda quando a solicitacao e aprovada.
 */
export async function POST(req: Request) {
  const { usuario, erro } = await exigirAdminGeral();
  if (erro) return erro;

  try {
    const { militarId, permissoes } = await req.json();
    const militar = await validarPromocao({ militarId });

    const dados = { militarId: militar.id, permissoes };

    // A fila ja prefixa o resumo com o nome do militar indicado em `militarId`.
    return await inclusaoEmDuasEtapas({
      tipo: "ADMINISTRADOR",
      usuario: usuario!,
      resumo: "concessão de privilégios de administrador",
      dados,
      executar: () => promoverMilitar(dados),
      forcarFila: true,
      mensagem: MENSAGEM_PENDENTE_PRIVILEGIOS,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
