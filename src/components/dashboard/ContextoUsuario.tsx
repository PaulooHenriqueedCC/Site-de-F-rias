"use client";

import { createContext, useContext } from "react";
import type { UsuarioSessao } from "@/lib/permissoes";

const Contexto = createContext<UsuarioSessao | null>(null);

export function ProvedorUsuario({ usuario, children }: { usuario: UsuarioSessao; children: React.ReactNode }) {
  return <Contexto.Provider value={usuario}>{children}</Contexto.Provider>;
}

export function useUsuario(): UsuarioSessao | null {
  return useContext(Contexto);
}
