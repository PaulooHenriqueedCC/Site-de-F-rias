"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import FundoNebuloso from "./FundoNebuloso";
import OrbitasOnduladas from "./OrbitasOnduladas";

export default function MolduraAuth({
  titulo,
  subtitulo,
  children,
  rodape,
  largura = "max-w-md",
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: string;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <FundoNebuloso />
      <OrbitasOnduladas />

      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className={`relative w-full ${largura} rounded-xl border border-line/80 bg-graphite-800/85 p-7 shadow-2xl backdrop-blur-md sm:p-9`}
      >
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-7 text-center"
        >
          <Link href="/login" className="inline-flex flex-col items-center gap-3">
            <Image
              src="/brasao-cologo.png"
              alt="Brasão do Comando Logístico"
              width={99}
              height={138}
              priority
              className="h-[74px] w-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
            />
            <p className="font-display text-4xl font-medium uppercase tracking-[0.3em] text-gold">SICOF</p>
          </Link>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            Sistema Integrado de Controle de Férias
          </p>
          <div className="mx-auto my-5 h-px w-24 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
          <h1 className="font-display text-xl uppercase tracking-[0.14em] text-zinc-100">{titulo}</h1>
          {subtitulo && <p className="mt-2 text-sm text-zinc-400">{subtitulo}</p>}
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          {children}
        </motion.div>

        {rodape && <div className="mt-7 border-t border-line pt-5 text-center text-sm">{rodape}</div>}
      </motion.section>
    </main>
  );
}
