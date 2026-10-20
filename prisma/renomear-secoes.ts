/**
 * Renomeia as C/Asse/Sec ja gravadas no banco.
 *
 *   npm run db:secoes
 *
 * Aplica a mesma lista de `src/lib/secoes.ts` sobre as tabelas `militares` e
 * `plano_ferias`. A comparacao ignora acentos, pontos e espacos repetidos, de
 * modo que "Cl IX Bld" e "CL. IX  BLD" tambem sao alcancados.
 *
 * O script pode ser rodado quantas vezes for preciso: registros ja renomeados
 * simplesmente nao voltam na busca.
 */

import { PrismaClient } from "@prisma/client";
import { RENOMEACOES_SECAO, chaveSecao } from "../src/lib/secoes";

const prisma = new PrismaClient();

async function main() {
  console.log("Renomeando C/Asse/Seç…\n");

  const [militares, linhas] = await Promise.all([
    prisma.militar.findMany({ select: { id: true, secao: true } }),
    prisma.planoFerias.findMany({ select: { id: true, secao: true } }),
  ]);

  let totalMilitares = 0;
  let totalLinhas = 0;
  const resumo = new Map<string, number>();

  const novoNome = (atual: string) => RENOMEACOES_SECAO[chaveSecao(atual)];

  for (const m of militares) {
    const novo = novoNome(m.secao);
    if (!novo || novo === m.secao) continue;
    await prisma.militar.update({ where: { id: m.id }, data: { secao: novo } });
    resumo.set(`${m.secao} → ${novo}`, (resumo.get(`${m.secao} → ${novo}`) ?? 0) + 1);
    totalMilitares++;
  }

  for (const l of linhas) {
    const novo = novoNome(l.secao);
    if (!novo || novo === l.secao) continue;
    await prisma.planoFerias.update({ where: { id: l.id }, data: { secao: novo } });
    resumo.set(`${l.secao} → ${novo}`, (resumo.get(`${l.secao} → ${novo}`) ?? 0) + 1);
    totalLinhas++;
  }

  if (!resumo.size) {
    console.log("Nada a renomear: nenhum registro usa os nomes antigos.");
  } else {
    for (const [troca, quantidade] of Array.from(resumo.entries())) {
      console.log(`  ${troca}  (${quantidade} registro(s))`);
    }
  }

  console.log(
    `\nConcluído: ${totalMilitares} militar(es) e ${totalLinhas} linha(s) do plano atualizados.`
  );
}

main()
  .catch((e) => {
    console.error("Falha ao renomear as seções:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
