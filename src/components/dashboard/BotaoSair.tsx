"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useUsuario } from "./ContextoUsuario";
import Modal from "@/components/ui/Modal";
import { rotuloPosto } from "@/lib/postos";

/**
 * Botao de sair do cabecalho, ao lado do relogio.
 *
 * Ficava no rodape do menu lateral; foi trazido para ca junto com a data e a
 * hora, deixando o menu so com a navegacao.
 */
export default function BotaoSair() {
  const router = useRouter();
  const usuario = useUsuario();
  const [confirmar, setConfirmar] = useState(false);
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSaindo(false);
      setConfirmar(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirmar(true)}
        className="botao-secundario shrink-0"
        aria-label="Sair do sistema"
      >
        <LogOut size={15} /> Sair
      </button>

      <Modal
        aberto={confirmar}
        titulo="Sair do sistema"
        descricao="A sessão será encerrada e você voltará à tela de login."
        aoFechar={() => setConfirmar(false)}
        largura="max-w-md"
      >
        <p className="text-sm text-zinc-300">
          Deseja realmente sair,{" "}
          <span className="font-semibold text-zinc-100">
            {rotuloPosto(usuario?.posto)} {usuario?.nomeGuerra}
          </span>
          ?
        </p>

        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={() => setConfirmar(false)} className="botao-secundario">
            Cancelar
          </button>
          <button type="button" onClick={sair} disabled={saindo} className="botao-perigo">
            <LogOut size={15} /> {saindo ? "Saindo…" : "Sim, sair"}
          </button>
        </div>
      </Modal>
    </>
  );
}
