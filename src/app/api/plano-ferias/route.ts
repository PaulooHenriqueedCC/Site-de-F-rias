import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirSessao } from "@/lib/sessao-servidor";
import { criarPlanoFerias, validarPlano } from "@/lib/criacoes";
import { inclusaoEmDuasEtapas, respostaDeErro } from "@/lib/aprovacoes";
import { distribuirDescontos, ordenarLinhasPlano, CABECALHO_PADRAO } from "@/lib/plano-modelo";

const selecao = {
  id: true, categoria: true, secao: true, ano: true, ordem: true,
  militarId: true, nomeCompleto: true, postoTexto: true,
  substitutoId: true, substitutoTexto: true,
  periodoAquisitivo: true, tipoReferencia: true, mesAno: true, parcela: true,
  dias: true, descontoManual: true, inicio: true, termino: true, observacao: true,
  militar: { select: { id: true, nomeGuerra: true, posto: true, secao: true, quadro: true, antiguidade: true } },
  substituto: { select: { id: true, nomeGuerra: true, posto: true } },
};

/**
 * Preferencia de numeracao gravada no cabecalho.
 *
 * O campo `ordemPorAntiguidade` foi acrescentado nesta versao; a leitura
 * tolerante mantem o padrao (antiguidade) mesmo em bancos onde o `db push`
 * ainda nao rodou.
 */
function ordemPorAntiguidadeDe(config: { id: string; ordemPorAntiguidade?: boolean | null }): boolean {
  return config.ordemPorAntiguidade !== false;
}

/// Garante que exista o registro unico com o cabecalho do ANEXO A.
async function cabecalhoAtual() {
  const existente = await prisma.configuracaoPlano.findUnique({ where: { id: "unica" } });
  if (existente) return existente;

  // upsert evita erro de chave duplicada se duas telas abrirem ao mesmo tempo.
  return prisma.configuracaoPlano.upsert({
    where: { id: "unica" },
    update: {},
    create: { id: "unica", ...CABECALHO_PADRAO },
  });
}

export async function GET() {
  const { erro } = await exigirSessao();
  if (erro) return erro;

  const [linhas, descontos, cabecalho] = await Promise.all([
    prisma.planoFerias.findMany({ select: selecao, orderBy: [{ ordem: "asc" }, { inicio: "asc" }] }),
    prisma.desconto.findMany({ select: { militarId: true, inicio: true, dias: true } }),
    cabecalhoAtual(),
  ]);

  // Total de dias lancados em "Desconto em ferias" por militar e por ano.
  const totais = new Map<string, number>();
  for (const d of descontos) {
    const chave = `${d.militarId}|${d.inicio.getFullYear()}`;
    totais.set(chave, (totais.get(chave) ?? 0) + d.dias);
  }

  const comDesconto = distribuirDescontos(
    linhas.map((l) => ({ ...l, militarId: l.militarId ?? null })),
    totais
  );

  // O Nr Ord e a posicao da linha dentro do grupo, entao a ordenacao escolhida
  // ja sai daqui pronta e vale para a tela, para o CSV e para o PDF.
  const ordenadas = ordenarLinhasPlano(comDesconto, ordemPorAntiguidadeDe(cabecalho));

  return NextResponse.json({
    linhas: ordenadas,
    cabecalho,
    descontosPorMilitarAno: Array.from(totais.entries()).map(([chave, dias]) => ({ chave, dias })),
  });
}

export async function POST(req: Request) {
  const { usuario, erro } = await exigirPermissao("planoFerias");
  if (erro) return erro;

  const dados = await req.json();

  try {
    validarPlano(dados);
    return await inclusaoEmDuasEtapas({
      tipo: "PLANO_FERIAS",
      usuario: usuario!,
      resumo: `${dados.nomeCompleto} — linha do plano de férias (${dados.secao || "sem seção"})`,
      dados,
      executar: () => criarPlanoFerias(dados),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** Atualiza o cabecalho institucional do documento. */
export async function PUT(req: Request) {
  const { erro } = await exigirPermissao("planoFerias");
  if (erro) return erro;

  const { linha1, linha2, linha3, linha4, anexo, ordemPorAntiguidade } = await req.json();

  const atual = await cabecalhoAtual();

  // Cada campo omitido no corpo conserva o valor que ja estava gravado, o que
  // permite alternar so a ordenacao sem reenviar o cabecalho inteiro.
  const valores = {
    linha1: linha1 ?? atual.linha1 ?? CABECALHO_PADRAO.linha1,
    linha2: linha2 ?? atual.linha2 ?? CABECALHO_PADRAO.linha2,
    linha3: linha3 ?? atual.linha3 ?? CABECALHO_PADRAO.linha3,
    linha4: linha4 ?? atual.linha4 ?? CABECALHO_PADRAO.linha4,
    anexo: anexo ?? atual.anexo ?? CABECALHO_PADRAO.anexo,
    ordemPorAntiguidade:
      typeof ordemPorAntiguidade === "boolean" ? ordemPorAntiguidade : ordemPorAntiguidadeDe(atual),
  };

  const cabecalho = await prisma.configuracaoPlano.upsert({
    where: { id: "unica" },
    update: valores,
    create: { id: "unica", ...valores },
  });

  return NextResponse.json({ ok: true, cabecalho });
}
