import { SignJWT, jwtVerify } from "jose";
import type { UsuarioSessao } from "@/lib/permissoes";

const chave = new TextEncoder().encode(
  process.env.JWT_SECRET || "sicof-chave-de-desenvolvimento-troque-em-producao"
);

export const COOKIE_SESSAO = "sicof_sessao";

export async function assinarSessao(usuario: UsuarioSessao): Promise<string> {
  return new SignJWT({ ...usuario })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(chave);
}

export async function lerSessao(token?: string | null): Promise<UsuarioSessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave);
    return payload as unknown as UsuarioSessao;
  } catch {
    return null;
  }
}
