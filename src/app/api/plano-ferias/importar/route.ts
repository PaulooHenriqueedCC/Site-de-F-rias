import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/sessao-servidor";
import { importarLinhasPlano } from "@/lib/criacoes";
import { inclusaoEmDuasEtapas, respostaDeErro } from "@/lib/aprovacoes";
import { lerPlanilhaPlano, type LinhaPlanoImportada } from "@/lib/importar-plano";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Etapa 1: le a planilha e devolve a previa, sem gravar nada. */
export async function POST(req: Request) {
  const { erro } = await exigirPermissao("planoFerias");
  if (erro) return erro;

  const formulario = await req.formData();
  const arquivo = formulario.get("arquivo") as File | null;
  if (!arquivo) return NextResponse.json({ erro: "Selecione um arquivo para importar." }, { status: 400 });

  const nome = arquivo.name.toLowerCase();
  if (!/\.(xlsx|xlsm|xls|csv|ods)$/.test(nome)) {
    return NextResponse.json({ erro: "Formato aceito: XLSX, XLS, CSV ou ODS." }, { status: 400 });
  }

  let linhas: LinhaPlanoImportada[] = [];
  try {
    linhas = lerPlanilhaPlano(Buffer.from(await arquivo.arrayBuffer()));
  } catch {
    return NextResponse.json(
      { erro: "Não foi possível ler a planilha. Confira se ela não está protegida." },
      { status: 400 }
    );
  }

  if (!linhas.length) {
    return NextResponse.json(
      {
        erro:
          "Nenhuma linha reconhecida. A planilha precisa ter uma coluna com o nome completo e ao menos " +
          "uma das colunas Dias, Início, Término, Per ou P/G.",
      },
      { status: 422 }
    );
  }

  const previa = linhas.map((l, i) => ({ ...l, indice: i }));

  return NextResponse.json({
    ok: true,
    total: previa.length,
    comPendencia: previa.filter((l) => l.observacoes.length > 0).length,
    previa,
  });
}

/** Etapa 2: confirma as linhas. A gravacao ainda passa pelo Administrador Geral. */
export async function PUT(req: Request) {
  const { usuario, erro } = await exigirPermissao("planoFerias");
  if (erro) return erro;

  const { linhas } = (await req.json()) as { linhas: LinhaPlanoImportada[] };
  if (!Array.isArray(linhas) || !linhas.length) {
    return NextResponse.json({ erro: "Nenhuma linha selecionada para importar." }, { status: 400 });
  }

  try {
    return await inclusaoEmDuasEtapas({
      tipo: "IMPORTACAO_PLANO",
      usuario: usuario!,
      resumo: `Importação de ${linhas.length} linha(s) para o plano de férias`,
      dados: { linhas },
      executar: () => importarLinhasPlano(linhas as unknown as Record<string, unknown>[]),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
