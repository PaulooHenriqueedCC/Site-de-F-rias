import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const IDENTIDADE_ADMIN = process.env.ADMIN_GERAL_IDENTIDADE || "111.689.137-3";
const SENHA_ADMIN = process.env.ADMIN_GERAL_SENHA || "Sicof@2025";

async function main() {
  const senhaHash = await bcrypt.hash(SENHA_ADMIN, 10);

  const admin = await prisma.militar.upsert({
    where: { identidade: IDENTIDADE_ADMIN },
    update: { perfil: "ADMINISTRADOR_GERAL", ativo: true },
    create: {
      nomeCompleto: "Administrador Geral do Sistema",
      identidade: IDENTIDADE_ADMIN,
      nomeGuerra: "ADMIN",
      secao: "SEÇÃO DE PESSOAL",
      ramal: "0000",
      posto: "CEL",
      quadro: "NENHUM",
      senhaHash,
      perfil: "ADMINISTRADOR_GERAL",
    },
  });

  // Cabecalho do ANEXO A usado pelo Plano de Ferias e pela exportacao do quadro.
  await prisma.configuracaoPlano.upsert({
    where: { id: "unica" },
    update: {},
    create: {
      id: "unica",
      linha1: "MINISTÉRIO DA DEFESA",
      linha2: "EXÉRCITO BRASILEIRO",
      linha3: "COMANDO LOGÍSTICO",
      linha4: "DEPARTAMENTO MARECHAL FALCONIERI",
      anexo: "ANEXO A",
    },
  });

  console.log("Administrador Geral pronto:", admin.identidade);
  console.log("Cabeçalho do plano de férias pronto (ANEXO A).");
  console.log("Senha inicial:", SENHA_ADMIN, "(troque no primeiro acesso)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
