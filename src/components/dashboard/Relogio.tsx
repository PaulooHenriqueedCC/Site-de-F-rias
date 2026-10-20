"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Relogio do painel: data e hora do lugar de onde o sistema esta sendo acessado.
 *
 * O fuso vem do proprio navegador (`Intl.DateTimeFormat`), entao quem acessa de
 * Manaus ve o horario de Manaus sem precisar configurar nada.
 *
 * O relogio do computador costuma estar adiantado ou atrasado alguns segundos.
 * Para nao depender dele, o componente pergunta a hora ao servidor e guarda a
 * diferenca entre as duas. A sincronizacao se repete a cada dez minutos.
 */

/** De quanto em quanto tempo perguntar a hora ao servidor. */
const INTERVALO_SINCRONIA_MS = 10 * 60 * 1000;

export default function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  const [sincronizado, setSincronizado] = useState(false);

  /** Diferença, em milissegundos, entre a hora do servidor e a do computador. */
  const desvio = useRef(0);
  const quadro = useRef(0);

  // Sincronização com a hora do servidor.
  useEffect(() => {
    let ativo = true;

    async function sincronizar() {
      try {
        // O ida-e-volta é descontado pela metade, supondo caminhos simétricos.
        const partida = performance.now();
        const resposta = await fetch("/api/hora", { cache: "no-store" });
        if (!resposta.ok) return;

        const { epocaMs } = await resposta.json();
        if (!ativo || typeof epocaMs !== "number") return;

        const viagem = performance.now() - partida;
        desvio.current = epocaMs + viagem / 2 - Date.now();
        setSincronizado(true);
      } catch {
        // Sem rede, o relógio segue com a hora do computador.
      }
    }

    sincronizar();
    const repetir = setInterval(sincronizar, INTERVALO_SINCRONIA_MS);

    return () => {
      ativo = false;
      clearInterval(repetir);
    };
  }, []);

  // Contagem quadro a quadro, já com o desvio aplicado.
  useEffect(() => {
    const atualizar = () => {
      setAgora(new Date(Date.now() + desvio.current));
      quadro.current = requestAnimationFrame(atualizar);
    };
    quadro.current = requestAnimationFrame(atualizar);
    return () => cancelAnimationFrame(quadro.current);
  }, []);

  if (!agora) {
    return <span className="font-mono text-sm text-zinc-600">--:--:--.---</span>;
  }

  const dois = (n: number) => String(n).padStart(2, "0");
  const tres = (n: number) => String(n).padStart(3, "0");

  // O fuso do navegador continua valendo para a exibição; só não é escrito.
  const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";

  return (
    <div className="text-right leading-tight">
      <p className="font-mono text-lg tabular-nums text-gold">
        {dois(agora.getHours())}:{dois(agora.getMinutes())}:{dois(agora.getSeconds())}
        <span className="text-sm text-gold/60">.{tres(agora.getMilliseconds())}</span>
      </p>
      <p
        className="text-[11px] uppercase tracking-[0.14em] text-zinc-500"
        title={
          sincronizado
            ? `Fuso ${fuso}, sincronizado com o servidor`
            : `Fuso ${fuso}, usando a hora deste computador`
        }
      >
        {agora.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
