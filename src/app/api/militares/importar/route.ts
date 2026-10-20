import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao-servidor";
import { importarLinhasEfetivo } from "@/lib/criacoes";
import { inclusaoEmDuasEtapas, respostaDeErro } from "@/lib/aprovacoes";
import { lerPlanilha, lerTextoPdf, type LinhaImportada } from "@/lib/importar-efetivo";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Etapa 1: le o arquivo e devolve a previa, sem gravar nada. */
export async function POST(req: Request) {
  const { erro } = await exigirPermissao("efetivo");
  if (erro) return erro;

  const formulario = await req.formData();
  const arquivo = formulario.get("arquivo") as File | null;
  if (!arquivo) return NextResponse.json({ erro: "Selecione um arquivo para importar." }, { status: 400 });

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const nome = arquivo.name.toLowerCase();

  let linhas: LinhaImportada[] = [];
  try {
    if (nome.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const { text } = await pdfParse(buffer);
      linhas = lerTextoPdf(text);
    } else if (/\.(xlsx|xlsm|xls|csv|ods)$/.test(nome)) {
      linhas = lerPlanilha(buffer);
    } else {
      return NextResponse.json({ erro: "Formato aceito: XLSX, XLS, CSV, ODS ou PDF." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ erro: "Não foi possível ler o arquivo. Confira se ele não está protegido." }, { status: 400 });
  }

  if (!linhas.length) {
    return NextResponse.json(
      { erro: "Nenhum militar reconhecido no arquivo. Verifique se há uma coluna com o nome." },
      { status: 422 }
    );
  }

  // Remove duplicatas dentro do proprio arquivo e marca quem ja existe no banco.
  const vistos = new Set<string>();
  const unicas = linhas.filter((l) => {
    const chave = `${l.nomeCompleto}|${l.identidade ?? ""}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const identidades = unicas.map((l) => l.identidade).filter(Boolean) as string[];
  const existentes = await prisma.militar.findMany({
    where: { identidade: { in: identidades } },
    select: { identidade: true },
  });
  const jaCadastradas = new Set(existentes.map((e) => e.identidade));

  const previa = unicas.map((l, i) => ({
    ...l,
    indice: i,
    jaCadastrado: l.identidade ? jaCadastradas.has(l.identidade) : false,
  }));

  return NextResponse.json({
    ok: true,
    total: previa.length,
    comPendencia: previa.filter((l) => l.observacoes.length > 0).length,
    duplicados: previa.filter((l) => l.jaCadastrado).length,
    previa,
  });
}

/** Etapa 2: confirma as linhas. A gravacao ainda passa pelo Administrador Geral. */
export async function PUT(req: Request) {
  const { usuario, erro } = await exigirPermissao("efetivo");
  if (erro) return erro;

  const { linhas } = (await req.json()) as { linhas: LinhaImportada[] };
  if (!Array.isArray(linhas) || !linhas.length) {
    return NextResponse.json({ erro: "Nenhuma linha selecionada para importar." }, { status: 400 });
  }

  try {
    return await inclusaoEmDuasEtapas({
      tipo: "IMPORTACAO_EFETIVO",
      usuario: usuario!,
      resumo: `Importação de ${linhas.length} militar(es) para o efetivo`,
      dados: { linhas },
      executar: () => importarLinhasEfetivo(linhas),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
