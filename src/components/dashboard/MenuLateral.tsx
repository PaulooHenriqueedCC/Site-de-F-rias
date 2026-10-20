"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, CalendarRange, ClipboardList, FileSignature, LayoutGrid, Menu, PenLine, Receipt,
  Scissors, Settings, ShieldCheck, ShieldQuestion, Users, X,
  type LucideIcon,
} from "lucide-react";
import { useUsuario } from "./ContextoUsuario";
import { itensVisiveis, rotuloPerfil } from "@/lib/permissoes";
import { rotuloPosto } from "@/lib/postos";

/** Icone de cada aba; a ordem e as regras de acesso vivem em @/lib/permissoes. */
const ICONES: Record<string, LucideIcon> = {
  "/dashboard": LayoutGrid,
  "/dashboard/calendario": CalendarDays,
  "/dashboard/plano-ferias": CalendarRange,
  "/dashboard/dispensa": ClipboardList,
  "/dashboard/desconto": Scissors,
  "/dashboard/pagamento": Receipt,
  "/dashboard/efetivo": Users,
  "/dashboard/assinar": PenLine,
  "/dashboard/assinados": FileSignature,
  "/dashboard/configuracoes": Settings,
  "/dashboard/aprovacoes": ShieldQuestion,
  "/dashboard/administradores": ShieldCheck,
};

export default function MenuLateral() {
  const caminho = usePathname();
  const usuario = useUsuario();
  const [aberto, setAberto] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  /** Documentos aguardando a assinatura de quem está logado. */
  const [aguardandoAssinatura, setAguardandoAssinatura] = useState(0);

  // Contador de inclusoes aguardando a segunda etapa da verificacao.
  useEffect(() => {
    if (usuario?.perfil === "USUARIO") return;
    fetch("/api/solicitacoes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPendentes(d?.pendentes ?? 0))
      .catch(() => setPendentes(0));
  }, [usuario?.perfil, caminho]);

  // A aba "Aprovar e assinar" só existe enquanto houver documento esperando.
  useEffect(() => {
    fetch("/api/assinaturas?escopo=minhas")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAguardandoAssinatura(d?.pendentes ?? 0))
      .catch(() => setAguardandoAssinatura(0));
  }, [caminho]);

  // Só entram no menu as abas que o perfil pode ver.
  const itens = itensVisiveis(usuario).filter(
    (i) => !i.somenteQuandoPendente || aguardandoAssinatura > 0
  );

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-5">
        <div className="flex items-center gap-3">
          <Image
            src="/brasao-cologo.png"
            alt="Brasão do Comando Logístico"
            width={99}
            height={138}
            priority
            className="h-11 w-auto shrink-0"
          />
          <p className="font-display text-2xl uppercase tracking-[0.28em] text-gold">SICOF</p>
        </div>

        {/* Quem está usando o sistema, logo abaixo do nome do site. */}
        <div className="mt-4 border-t border-line pt-3.5">
          <p className="truncate text-sm leading-snug" title={usuario?.nomeCompleto}>
            <span className="text-zinc-400">{rotuloPosto(usuario?.posto)} </span>
            <span className="font-semibold text-zinc-100">{usuario?.nomeGuerra}</span>
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-zinc-500">{usuario?.identidade}</p>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-gold">
            {rotuloPerfil(usuario?.perfil)}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {itens.map(({ href, rotulo }) => {
          const Icone = ICONES[href] ?? LayoutGrid;
          const ativo = href === "/dashboard" ? caminho === href : caminho.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setAberto(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                ativo ? "bg-gold/12 font-medium text-gold" : "text-zinc-400 hover:bg-graphite-700 hover:text-zinc-100"
              }`}
            >
              <Icone size={17} className="shrink-0" />
              <span className="leading-tight">{rotulo}</span>
              {href === "/dashboard/aprovacoes" && pendentes > 0 && (
                <span className="ml-auto rounded-full bg-gold px-1.5 py-0.5 font-mono text-[10px] leading-none text-graphite-900">
                  {pendentes}
                </span>
              )}
              {href === "/dashboard/assinar" && aguardandoAssinatura > 0 && (
                <span className="ml-auto rounded-full bg-gold px-1.5 py-0.5 font-mono text-[10px] leading-none text-graphite-900">
                  {aguardandoAssinatura}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Cabecalho de navegacao no celular */}
      <div className="flex items-center justify-between border-b border-line bg-graphite-800 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brasao-cologo.png"
            alt="Brasão do Comando Logístico"
            width={99}
            height={138}
            className="h-8 w-auto"
          />
          <p className="font-display text-xl uppercase tracking-[0.24em] text-gold">SICOF</p>
        </div>
        <button onClick={() => setAberto(true)} className="rounded p-2 text-zinc-300" aria-label="Abrir menu">
          <Menu size={20} />
        </button>
      </div>

      <aside className="hidden w-64 shrink-0 border-r border-line bg-graphite-800 lg:block">{conteudo}</aside>

      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setAberto(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-graphite-800 shadow-2xl">
            <button
              onClick={() => setAberto(false)}
              className="absolute right-3 top-4 rounded p-1.5 text-zinc-400"
              aria-label="Fechar menu"
            >
              <X size={19} />
            </button>
            {conteudo}
          </div>
        </div>
      )}

    </>
  );
}
