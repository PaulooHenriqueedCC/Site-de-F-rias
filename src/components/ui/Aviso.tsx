"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

type Tipo = "erro" | "sucesso" | "info";

const estilos: Record<Tipo, { classe: string; Icone: typeof Info }> = {
  erro: { classe: "border-rubro/60 bg-rubro/10 text-red-200", Icone: AlertTriangle },
  sucesso: { classe: "border-oliva/70 bg-oliva/15 text-emerald-200", Icone: CheckCircle2 },
  info: { classe: "border-line bg-graphite-700 text-zinc-300", Icone: Info },
};

export default function Aviso({ tipo = "info", mensagem }: { tipo?: Tipo; mensagem?: string | null }) {
  const { classe, Icone } = estilos[tipo];
  return (
    <AnimatePresence mode="wait">
      {mensagem && (
        <motion.div
          key={mensagem}
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.25 }}
          role={tipo === "erro" ? "alert" : "status"}
          className="overflow-hidden"
        >
          <div className={`mb-4 flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm ${classe}`}>
            <Icone size={17} className="mt-0.5 shrink-0" />
            <span>{mensagem}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
