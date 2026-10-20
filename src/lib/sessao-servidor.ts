import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_SESSAO, lerSessao } from "@/lib/auth";
import type { ChavePermissao, UsuarioSessao } from "@/lib/permissoes";
import { podeEditar, podeVer } from "@/lib/permissoes";

export async function sessaoAtual(): Promise<UsuarioSessao | null> {
  const token = cookies().get(COOKIE_SESSAO)?.value;
  return lerSessao(token);
}

/** Uso em rotas de API: devolve o usuario ou uma resposta 401 pronta. */
export async function exigirSessao() {
  const usuario = await sessaoAtual();
  if (!usuario) {
    return { usuario: null, erro: NextResponse.json({ erro: "Sessão expirada. Entre novamente." }, { status: 401 }) };
  }
  return { usuario, erro: null };
}

export async function exigirPermissao(chave: ChavePermissao) {
  const { usuario, erro } = await exigirSessao();
  if (erro) return { usuario: null, erro };
  if (!podeEditar(usuario, chave)) {
    return {
      usuario: null,
      erro: NextResponse.json({ erro: "Seu perfil não tem permissão para esta ação." }, { status: 403 }),
    };
  }
  return { usuario, erro: null };
}

/** Leitura da area: barra quem nem sequer enxerga a aba no menu. */
export async function exigirVisualizacao(chave: ChavePermissao) {
  const { usuario, erro } = await exigirSessao();
  if (erro) return { usuario: null, erro };
  if (!podeVer(usuario, chave)) {
    return {
      usuario: null,
      erro: NextResponse.json({ erro: "Seu perfil não tem acesso a esta área." }, { status: 403 }),
    };
  }
  return { usuario, erro: null };
}

export async function exigirAdminGeral() {
  const { usuario, erro } = await exigirSessao();
  if (erro) return { usuario: null, erro };
  if (usuario!.perfil !== "ADMINISTRADOR_GERAL") {
    return {
      usuario: null,
      erro: NextResponse.json({ erro: "Ação restrita ao Administrador Geral." }, { status: 403 }),
    };
  }
  return { usuario, erro: null };
}
