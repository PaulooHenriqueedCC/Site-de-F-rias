"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SENHA_MAX } from "@/lib/validacao";

export default function CampoSenha({
  id,
  rotulo,
  valor,
  aoAlterar,
  autoComplete = "current-password",
  dica,
  centralizado = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoAlterar: (v: string) => void;
  autoComplete?: string;
  dica?: string;
  /** Centraliza o texto digitado, como no campo de identidade do login. */
  centralizado?: boolean;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div>
      <label className="rotulo" htmlFor={id}>{rotulo}</label>
      <div className="relative">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          className={`campo pr-11 ${centralizado ? "pl-11 text-center text-lg tracking-widest" : ""}`}
          value={valor}
          maxLength={SENHA_MAX}
          autoComplete={autoComplete}
          onChange={(e) => aoAlterar(e.target.value.slice(0, SENHA_MAX))}
          required
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2 text-zinc-500 hover:text-gold"
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        >
          {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p className={`mt-1 text-[11px] text-zinc-500 ${centralizado ? "text-center" : ""}`}>
        {dica ?? `Até ${SENHA_MAX} caracteres.`}
      </p>
    </div>
  );
}
