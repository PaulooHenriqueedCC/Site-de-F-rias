import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, lerSessao } from "@/lib/auth";
import { podeAcessarRota } from "@/lib/permissoes";

const ROTAS_PUBLICAS = ["/login", "/cadastro", "/redefinir-senha"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const usuario = await lerSessao(req.cookies.get(COOKIE_SESSAO)?.value);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(usuario ? "/dashboard" : "/login", req.url));
  }

  if (ROTAS_PUBLICAS.includes(pathname) && usuario) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/dashboard") && !usuario) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Digitar a URL na mao nao contorna o que o Administrador Geral autorizou.
  if (pathname.startsWith("/dashboard") && !podeAcessarRota(usuario, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/cadastro", "/redefinir-senha", "/dashboard/:path*"],
};
