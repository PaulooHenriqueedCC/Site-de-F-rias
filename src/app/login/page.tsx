"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, Loader2, ShieldCheck, TimerReset, User } from "lucide-react";
import MolduraAuth from "@/components/auth/MolduraAuth";
import Aviso from "@/components/ui/Aviso";
import CampoSenha from "@/components/ui/CampoSenha";
import { identidadeValida, mascararIdentidade } from "@/lib/validacao";

type Aba = "USUARIO" | "ADMINISTRADOR";

const ABAS: { valor: Aba; rotulo: string; Icone: typeof User; subtitulo: string }[] = [
  {
    valor: "USUARIO",
    rotulo: "Usuário",
    Icone: User,
    subtitulo: "Identifique-se para consultar seus lançamentos de férias.",
  },
  {
    valor: "ADMINISTRADOR",
    rotulo: "Administrador",
    Icone: ShieldCheck,
    subtitulo: "Acesso restrito aos administradores do sistema.",
  },
];

export default function PaginaLogin() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("USUARIO");
  const [identidade, setIdentidade] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [encerradaPorInatividade, setEncerradaPorInatividade] = useState(false);

  // Recado deixado pelo painel quando a sessão cai por falta de uso.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("sicof:encerrada-por-inatividade")) {
        sessionStorage.removeItem("sicof:encerrada-por-inatividade");
        setEncerradaPorInatividade(true);
      }
    } catch {
      /* sessionStorage indisponível: segue sem o aviso. */
    }
  }, []);

  const abaAtual = ABAS.find((a) => a.valor === aba)!;
  const ehAdmin = aba === "ADMINISTRADOR";

  function trocarAba(nova: Aba) {
    setAba(nova);
    setErro(null);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEncerradaPorInatividade(false);

    if (!identidadeValida(identidade)) {
      setErro("A identidade precisa seguir o formato 111.222.333-4.");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A aba escolhida diz ao servidor qual perfil e esperado nesta entrada.
        body: JSON.stringify({ identidade, senha, exigirAdministrador: ehAdmin }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível entrar.");
        return;
      }

      router.push(dados.senhaTemporaria ? "/dashboard/configuracoes?trocar=1" : "/dashboard");
      router.refresh();
    } catch {
      setErro("Servidor indisponível. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MolduraAuth titulo="Acesso ao sistema" subtitulo={abaAtual.subtitulo}>
      {/* Abas de entrada: usuário comum ou administrador */}
      <div
        role="tablist"
        aria-label="Tipo de acesso"
        className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-line bg-graphite-900/60 p-1"
      >
        {ABAS.map(({ valor, rotulo, Icone }) => {
          const ativa = aba === valor;
          return (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => trocarAba(valor)}
              className={`relative flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors ${
                ativa ? "text-graphite-900" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {ativa && (
                <motion.span
                  layoutId="aba-login"
                  className="absolute inset-0 rounded-md bg-gold"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2 font-medium">
                <Icone size={15} /> {rotulo}
              </span>
            </button>
          );
        })}
      </div>

      {encerradaPorInatividade && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-gold/50 bg-gold/10 px-4 py-3">
          <TimerReset size={16} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-sm text-zinc-200">
            Sua sessão foi encerrada por inatividade. Entre novamente para continuar.
          </p>
        </div>
      )}

      <form onSubmit={entrar} className="space-y-4">
        <Aviso tipo="erro" mensagem={erro} />

        <div>
          <label className="rotulo" htmlFor="identidade">Identidade militar</label>
          <input
            id="identidade"
            className="campo-mono text-center text-lg"
            value={identidade}
            onChange={(e) => setIdentidade(mascararIdentidade(e.target.value))}
            placeholder="111.222.333-4"
            inputMode="numeric"
            maxLength={14}
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <CampoSenha
          id="senha"
          rotulo="Senha"
          valor={senha}
          aoAlterar={setSenha}
          dica="Até 16 caracteres."
          centralizado
        />

        <motion.button
          type="submit"
          disabled={enviando}
          whileTap={{ scale: 0.985 }}
          className="botao-primario w-full"
        >
          <span className="relative z-10 flex items-center gap-2">
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {enviando ? "Entrando…" : ehAdmin ? "Entrar como administrador" : "Entrar"}
          </span>
          {!enviando && (
            <span className="absolute inset-y-0 w-1/3 animate-brilho bg-white/35 blur-md" aria-hidden />
          )}
        </motion.button>
      </form>

      <div className="mt-6 space-y-1.5 text-center text-sm">
        <p>
          <Link href="/redefinir-senha" className="text-zinc-400 underline-offset-4 hover:text-gold hover:underline">
            Redefinir Senha
          </Link>
        </p>
        {!ehAdmin && (
          <p>
            <Link href="/cadastro" className="text-zinc-400 underline-offset-4 hover:text-gold hover:underline">
              Cadastrar Usuário
            </Link>
          </p>
        )}
      </div>
    </MolduraAuth>
  );
}
