import { prisma } from "@/lib/prisma";
import { contarDias, paraData } from "@/lib/datas";
import { gerarHash, gerarSenhaTemporaria } from "@/lib/senha";
import { identidadeValida, senhaValida } from "@/lib/validacao";
import { permissoesPadraoAdmin } from "@/lib/permissoes";
import { quadrosDisponiveis } from "@/lib/postos";
import { normalizarSecao } from "@/lib/secoes";
import type { LinhaImportada } from "@/lib/importar-efetivo";
import type { CategoriaPlano, Posto, Quadro } from "@prisma/client";

/**
 * Validacao e gravacao das inclusoes do sistema, isoladas das rotas para que a
 * mesma logica sirva tanto ao lancamento direto quanto a aprovacao posterior
 * de uma solicitacao pendente.
 */

export class ErroValidacao extends Error {
  status: number;
  constructor(mensagem: string, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

/* ------------------------------------------------------------------ Militar */

export async function validarMilitar(dados: Record<string, unknown>) {
  if (!dados.nomeCompleto || !dados.nomeGuerra) {
    throw new ErroValidacao("Informe ao menos nome completo e nome de guerra.");
  }
  if (dados.identidade && !identidadeValida(String(dados.identidade))) {
    throw new ErroValidacao("A identidade precisa seguir o formato 111.222.333-4.");
  }
  if (dados.quadro && !quadrosDisponiveis(dados.posto as string).includes(dados.quadro as never)) {
    throw new ErroValidacao("O quadro selecionado não se aplica a este posto.");
  }
  if (dados.identidade) {
    const jaExiste = await prisma.militar.findUnique({ where: { identidade: String(dados.identidade) } });
    if (jaExiste) throw new ErroValidacao("Já existe militar com esta identidade.", 409);
  }
}

export async function criarMilitar(dados: Record<string, any>) {
  await validarMilitar(dados);

  const identidade = dados.identidade || `PEND-${Date.now().toString().slice(-9)}`;
  const jaExiste = await prisma.militar.findUnique({ where: { identidade } });
  if (jaExiste) throw new ErroValidacao("Já existe militar com esta identidade.", 409);

  const militar = await prisma.militar.create({
    data: {
      nomeCompleto: dados.nomeCompleto,
      identidade,
      nomeGuerra: dados.nomeGuerra,
      ramal: dados.ramal || null,
      secao: normalizarSecao(dados.secao) || "NAO INFORMADA",
      telefone: dados.telefone || null,
      posto: (dados.posto || "NAO_INFORMADO") as Posto,
      quadro: (dados.quadro || "NENHUM") as Quadro,
      senhaHash: await gerarHash(gerarSenhaTemporaria()),
      senhaTemporaria: true,
      identidadePendente: !dados.identidade,
    },
  });

  return { militar };
}

/* -------------------------------------------------- Importacao de efetivo */

export async function importarLinhasEfetivo(linhas: LinhaImportada[]) {
  if (!Array.isArray(linhas) || !linhas.length) {
    throw new ErroValidacao("Nenhuma linha selecionada para importar.");
  }

  let criados = 0;
  let atualizados = 0;
  const falhas: string[] = [];

  for (const linha of linhas) {
    try {
      const identidade = linha.identidade || `PEND-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
      const existente = linha.identidade
        ? await prisma.militar.findUnique({ where: { identidade: linha.identidade } })
        : null;

      const dados = {
        nomeCompleto: linha.nomeCompleto,
        nomeGuerra: linha.nomeGuerra,
        secao: normalizarSecao(linha.secao) || "NAO INFORMADA",
        ramal: linha.ramal || null,
        telefone: linha.telefone || null,
        posto: (linha.posto || "NAO_INFORMADO") as Posto,
        identidadePendente: !linha.identidade,
      };

      if (existente) {
        await prisma.militar.update({ where: { id: existente.id }, data: dados });
        atualizados++;
      } else {
        await prisma.militar.create({
          data: {
            ...dados,
            identidade,
            senhaHash: await gerarHash(gerarSenhaTemporaria()),
            senhaTemporaria: true,
          },
        });
        criados++;
      }
    } catch {
      falhas.push(linha.nomeCompleto);
    }
  }

  return { criados, atualizados, falhas };
}

/* ------------------------------------------------------------------ Ferias */

const selecaoFerias = {
  id: true, inicio: true, termino: true, prontoParaServico: true, anoAquisitivo: true,
  periodoAquisitivo: true, qtdDias: true, diasDesconto: true, diasDispensa: true,
  pagamento: true, observacao: true,
  militar: { select: { id: true, nomeCompleto: true, nomeGuerra: true, posto: true, secao: true, quadro: true } },
  substituto: { select: { id: true, nomeGuerra: true, posto: true } },
};

export function validarFerias(dados: Record<string, any>) {
  const inicio = paraData(dados.inicio);
  const termino = paraData(dados.termino);
  if (!dados.militarId) throw new ErroValidacao("Selecione o militar.");
  if (!inicio || !termino) throw new ErroValidacao("Informe o início e o término das férias.");
  if (termino < inicio) throw new ErroValidacao("O término não pode ser anterior ao início.");
  return { inicio, termino };
}

export async function criarFerias(dados: Record<string, any>) {
  const { inicio, termino } = validarFerias(dados);

  const ferias = await prisma.ferias.create({
    data: {
      militarId: dados.militarId,
      substitutoId: dados.substitutoId || null,
      inicio,
      termino,
      prontoParaServico: paraData(dados.prontoParaServico),
      anoAquisitivo: String(dados.anoAquisitivo || new Date().getFullYear()),
      periodoAquisitivo: String(dados.periodoAquisitivo || "1"),
      qtdDias: Number(dados.qtdDias) || contarDias(inicio, termino),
      diasDesconto: Number(dados.diasDesconto) || 0,
      diasDispensa: Number(dados.diasDispensa) || 0,
      pagamento: Boolean(dados.pagamento),
      observacao: dados.observacao || null,
    },
    select: selecaoFerias,
  });

  return { ferias };
}

/* --------------------------------------------------------- Plano de ferias */

export function validarPlano(dados: Record<string, any>) {
  if (!dados.nomeCompleto || !String(dados.nomeCompleto).trim()) {
    throw new ErroValidacao("Informe o nome completo da linha do plano.");
  }
  const inicio = paraData(dados.inicio);
  const termino = paraData(dados.termino);
  if (inicio && termino && termino < inicio) {
    throw new ErroValidacao("O término não pode ser anterior ao início.");
  }
  return { inicio, termino };
}

/** Normaliza o corpo recebido do formulario em dados prontos para o Prisma. */
export function dadosDoPlano(dados: Record<string, any>) {
  const { inicio, termino } = validarPlano(dados);

  // Os dias saem sempre das datas quando as duas existem; o campo manual foi
  // retirado do formulario justamente para nao divergir do periodo lancado.
  // Linhas antigas ou importadas sem datas preservam o valor que ja tinham.
  const dias = inicio && termino ? contarDias(inicio, termino) : Number(dados.dias) || 0;

  return {
    categoria: (dados.categoria || "ATIVA") as CategoriaPlano,
    secao: normalizarSecao(dados.secao) || "NAO INFORMADA",
    ano: Number(dados.ano) || new Date().getFullYear(),
    ordem: Number(dados.ordem) || 0,
    militarId: dados.militarId || null,
    nomeCompleto: String(dados.nomeCompleto).trim(),
    postoTexto: String(dados.postoTexto ?? "").trim(),
    substitutoId: dados.substitutoId || null,
    substitutoTexto: String(dados.substitutoTexto ?? "").trim(),
    periodoAquisitivo: String(dados.periodoAquisitivo ?? "").trim(),
    tipoReferencia: dados.tipoReferencia === "ANO" ? "ANO" : "PERIODO",
    mesAno: String(dados.mesAno ?? "").trim(),
    parcela: Number(dados.parcela) || 0,
    dias,
    descontoManual:
      dados.descontoManual === "" || dados.descontoManual === null || dados.descontoManual === undefined
        ? null
        : Number(dados.descontoManual),
    inicio,
    termino,
    observacao: dados.observacao || null,
  };
}

export async function criarPlanoFerias(dados: Record<string, any>) {
  const linha = await prisma.planoFerias.create({ data: dadosDoPlano(dados) });
  return { linha };
}

/** Grava em lote as linhas conferidas na importacao de planilha do plano. */
export async function importarLinhasPlano(linhas: Record<string, any>[]) {
  if (!Array.isArray(linhas) || !linhas.length) {
    throw new ErroValidacao("Nenhuma linha selecionada para importar.");
  }

  let criados = 0;
  const falhas: string[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    try {
      await prisma.planoFerias.create({ data: dadosDoPlano({ ...linha, ordem: linha.ordem ?? i }) });
      criados++;
    } catch {
      falhas.push(linha.nomeCompleto ?? `linha ${i + 1}`);
    }
  }

  return { criados, falhas };
}

/* --------------------------------------------- Dispensas / descontos (periodos) */

const selecaoPeriodo = {
  id: true, inicio: true, termino: true, dias: true, motivo: true, comentario: true, criadoEm: true,
  militar: { select: { id: true, nomeCompleto: true, nomeGuerra: true, posto: true, secao: true } },
};

export function validarPeriodo(dados: Record<string, any>) {
  const inicio = paraData(dados.inicio);
  const termino = paraData(dados.termino);
  if (!dados.militarId) throw new ErroValidacao("Selecione o militar.");
  if (!inicio || !termino) throw new ErroValidacao("Informe o início e o término do período.");
  if (termino < inicio) throw new ErroValidacao("O término não pode ser anterior ao início.");
  return { inicio, termino };
}

export async function criarPeriodo(rota: "dispensas" | "descontos", dados: Record<string, any>) {
  const { inicio, termino } = validarPeriodo(dados);

  const data = {
    militarId: dados.militarId,
    inicio,
    termino,
    dias: Number(dados.dias) || contarDias(inicio, termino),
    motivo: dados.motivo || null,
    comentario: dados.comentario || null,
  };

  const registro =
    rota === "dispensas"
      ? await prisma.dispensa.create({ data, select: selecaoPeriodo })
      : await prisma.desconto.create({ data, select: selecaoPeriodo });

  return { registro };
}

/* --------------------------------------------------------------- Pagamento */

const selecaoPagamento = {
  id: true, diex: true, dataDiex: true, pago: true, observacao: true, atualizadoEm: true,
  militar: { select: { id: true, nomeCompleto: true, nomeGuerra: true, posto: true, secao: true } },
};

export function validarPagamento(dados: Record<string, any>) {
  if (!dados.militarId) throw new ErroValidacao("Selecione o militar.");
}

export async function criarPagamento(dados: Record<string, any>) {
  validarPagamento(dados);

  const registro = await prisma.pagamento.create({
    data: {
      militarId: dados.militarId,
      diex: dados.diex || null,
      dataDiex: paraData(dados.dataDiex),
      pago: Boolean(dados.pago),
      observacao: dados.observacao || null,
    },
    select: selecaoPagamento,
  });

  return { registro };
}


/* -------------------------------------------------------- Administradores */

/**
 * Confere o militar antes de enfileirar a concessao de privilegios, para que
 * erros obvios apareçam na hora do envio e nao so na aprovacao.
 */
export async function validarPromocao(dados: Record<string, any>) {
  const militarId = String(dados.militarId ?? "").trim();
  if (!militarId) throw new ErroValidacao("Selecione o militar do efetivo.");

  const militar = await prisma.militar.findUnique({
    where: { id: militarId },
    select: { id: true, nomeGuerra: true, nomeCompleto: true, posto: true, secao: true, perfil: true },
  });
  if (!militar) throw new ErroValidacao("Militar não encontrado no efetivo.", 404);

  if (militar.perfil === "ADMINISTRADOR_GERAL") {
    throw new ErroValidacao("Este militar já é o Administrador Geral.", 409);
  }

  return militar;
}

/**
 * Concede privilegios de administrador a um militar que ja consta no efetivo,
 * sem refazer o cadastro: aproveita identidade, senha e demais dados existentes
 * e apenas troca o perfil e grava as permissoes escolhidas.
 *
 * So roda depois de aprovada a solicitacao correspondente.
 */
export async function promoverMilitar(dados: Record<string, any>) {
  const militar = await validarPromocao(dados);

  await prisma.militar.update({
    where: { id: militar.id },
    data: {
      perfil: "ADMINISTRADOR",
      permissoes: dados.permissoes ?? permissoesPadraoAdmin(),
    },
  });

  return {
    promovido: true,
    jaEraAdministrador: militar.perfil === "ADMINISTRADOR",
    nomeGuerra: militar.nomeGuerra,
  };
}

export async function validarAdministrador(dados: Record<string, any>) {
  const { nomeCompleto, nomeGuerra, secao, posto, identidade, senha, senhaHash, quadro } = dados;

  if (!nomeCompleto || !nomeGuerra || !secao || !posto) {
    throw new ErroValidacao("Preencha nome completo, nome de guerra, seção e posto.");
  }
  if (!identidadeValida(String(identidade ?? ""))) {
    throw new ErroValidacao("A identidade precisa seguir o formato 111.222.333-4.");
  }

  // Na aprovacao a senha ja chega cifrada; na solicitacao ela ainda vem em texto.
  if (!senhaHash) {
    const checagem = senhaValida(String(senha ?? ""));
    if (!checagem.ok) throw new ErroValidacao(checagem.erro ?? "Senha inválida.");
  }

  if (!quadrosDisponiveis(posto).includes(quadro)) {
    throw new ErroValidacao("O quadro selecionado não se aplica a este posto.");
  }

  const existente = await prisma.militar.findUnique({ where: { identidade } });
  if (existente?.perfil === "ADMINISTRADOR_GERAL") {
    throw new ErroValidacao("Esta identidade já é a do Administrador Geral.", 409);
  }
}

/**
 * Cria o administrador ou promove o militar que ja consta no efetivo.
 * So roda depois de aprovada a solicitacao correspondente.
 */
export async function criarAdministrador(dados: Record<string, any>) {
  // Concessao de privilegios a quem ja esta no efetivo: nao ha conta a criar.
  if (dados.militarId) return promoverMilitar(dados);

  await validarAdministrador(dados);

  const { nomeCompleto, identidade, nomeGuerra, ramal, secao, telefone, posto, quadro, senha, permissoes } = dados;

  const payload = {
    nomeCompleto,
    nomeGuerra,
    ramal: ramal || null,
    secao: normalizarSecao(secao) || "NAO INFORMADA",
    telefone: telefone || null,
    posto: posto as Posto,
    quadro: (quadro || "NENHUM") as Quadro,
    senhaHash: dados.senhaHash ?? (await gerarHash(senha)),
    perfil: "ADMINISTRADOR" as const,
    permissoes: permissoes ?? permissoesPadraoAdmin(),
  };

  const existente = await prisma.militar.findUnique({ where: { identidade } });
  if (existente) {
    await prisma.militar.update({ where: { id: existente.id }, data: payload });
    return { promovido: true };
  }

  await prisma.militar.create({ data: { ...payload, identidade } });
  return { promovido: false };
}
