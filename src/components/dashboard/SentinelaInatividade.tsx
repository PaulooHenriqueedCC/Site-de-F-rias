"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { TimerReset } from "lucide-react";

/** 15 minutos sem uso encerram a sessao. */
const LIMITE_MS = 15 * 60 * 1000;

/** Aviso na tela durante o ultimo minuto, com a chance de continuar. */
const AVISO_MS = 60 * 1000;

/** Gestos que contam como \"a pagina esta sendo usada\". */
const EVENTOS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Vigia a inatividade do painel. Passados 15 minutos sem qualquer interacao,
 * derruba a sessao no servidor e leva de volta ao login, que exibe o motivo.
 *
 * A chave `sicof:encerrada-por-inatividade` no sessionStorage e o recado
 * deixado para a pagina de login; ela apaga a chave assim que mostra o aviso.
 */
export default function SentinelaInatividade() {
  const router = useRouter();
  const [restante, setRestante] = useState<number | null>(null);
  const ultimoUso = useRef(Date.now());
  const encerrando = useRef(false);

  const encerrar = useCallback(async () => {
    if (encerrando.current) return;
    encerrando.current = true;

    try {
      sessionStorage.setItem("sicof:encerrada-por-inatividade", "1");
    } catch {
      /* sessionStorage indisponível: o login apenas não exibirá o aviso. */
    }

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* mesmo sem resposta do servidor, tira o usuário da tela. */
    }

    router.push("/login");
    router.refresh();
  }, [router]);

  const registrarUso = useCallback(() => {
    if (encerrando.current) return;
    ultimoUso.current = Date.now();
    setRestante(null);
  }, []);

  useEffect(() => {
    for (const evento of EVENTOS) {
      window.addEventListener(evento, registrarUso, { passive: true });
    }

    // Voltar para a aba conta como uso; sair dela apenas deixa o relógio correr.
    const aoTrocarAba = () => {
      if (document.visibilityState === "visible") registrarUso();
    };
    document.addEventListener("visibilitychange", aoTrocarAba);

    const relogio = setInterval(() => {
      const parado = Date.now() - ultimoUso.current;

      if (parado >= LIMITE_MS) {
        setRestante(0);
        void encerrar();
        return;
      }

      const faltando = LIMITE_MS - parado;
      setRestante(faltando <= AVISO_MS ? Math.ceil(faltando / 1000) : null);
    }, 1000);

    return () => {
      for (const evento of EVENTOS) window.removeEventListener(evento, registrarUso);
      document.removeEventListener("visibilitychange", aoTrocarAba);
      clearInterval(relogio);
    };
  }, [encerrar, registrarUso]);

  return (
    <AnimatePresence>
      {restante !== null && restante > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          role="alert"
          className="fixed bottom-5 right-5 z-[60] w-[300px] rounded-lg border border-gold/60 bg-graphite-800 p-4 shadow-2xl"
        >
          <p className="flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.14em] text-gold">
            <TimerReset size={15} /> Sessão ociosa
          </p>
          <p className="mt-2 text-sm text-zinc-300">
            Sem uso há 14 minutos. A sessão será encerrada em{" "}
            <span className="font-mono text-gold">{restante}s</span>.
          </p>
          <button onClick={registrarUso} className="botao-secundario mt-3 w-full">
            Continuar conectado
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
