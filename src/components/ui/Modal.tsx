"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function Modal({
  aberto,
  titulo,
  descricao,
  aoFechar,
  children,
  largura = "max-w-2xl",
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  aoFechar: () => void;
  children: React.ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    if (aberto) document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 py-10 backdrop-blur-sm"
          onClick={aoFechar}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className={`w-full ${largura} rounded-lg border border-line bg-graphite-800 shadow-2xl`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                <h2 className="font-display text-lg uppercase tracking-[0.12em] text-zinc-100">{titulo}</h2>
                {descricao && <p className="mt-1 text-sm text-zinc-400">{descricao}</p>}
              </div>
              <button onClick={aoFechar} className="rounded p-1.5 text-zinc-500 hover:text-gold" aria-label="Fechar">
                <X size={19} />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
