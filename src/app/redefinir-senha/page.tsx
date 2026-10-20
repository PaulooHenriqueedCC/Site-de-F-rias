"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import MolduraAuth from "@/components/auth/MolduraAuth";
import Aviso from "@/components/ui/Aviso";
import CampoSenha from "@/components/ui/CampoSenha";
import { identidadeValida, mascararIdentidade, senhaValida } from "@/lib/validacao";

export default function PaginaRedefinirSenha() {
  const router = useRouter();
  const [form, setForm] = useState({
    nomeCompleto: "",
    identidade: "",
    secao: "",
    ramal: "",
  });
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const definir = (campo: keyof typeof form, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  async function redefinir(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!identidadeValida(form.identidade)) return setErro("A identidade precisa seguir o formato 111.222.333-4.");
    const checagem = senhaValida(senhaNova);
    if (!checagem.ok) return setErro(checagem.erro!);
    if (senhaNova !== confirmacao) return setErro("A confirmação não confere com a senha nova.");

    setEnviando(true);
    try {
      const resposta = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, senhaAtual, senhaNova }),
      });
      const retorno = await resposta.json();

      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível redefinir a senha.");
        return;
      }

      setSucesso("Senha alterada. Redirecionando para o acesso…");
      setTimeout(() => router.push("/login"), 1400);
    } catch {
      setErro("Servidor indisponível. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MolduraAuth
      titulo="Redefinir senha"
      subtitulo="Confirme seus dados e informe a senha nova."
      largura="max-w-xl"
      rodape={
        <Link href="/login" className="text-zinc-400 underline-offset-4 hover:text-gold hover:underline">
          Voltar para o acesso
        </Link>
      }
    >
      <form onSubmit={redefinir} className="space-y-4">
        <Aviso tipo="erro" mensagem={erro} />
        <Aviso tipo="sucesso" mensagem={sucesso} />

        <div>
          <label className="rotulo" htmlFor="nomeCompleto">Nome completo</label>
          <input
            id="nomeCompleto"
            className="campo"
            value={form.nomeCompleto}
            onChange={(e) => definir("nomeCompleto", e.target.value.toUpperCase())}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="identidade">Identidade</label>
            <input
              id="identidade"
              className="campo-mono"
              value={form.identidade}
              onChange={(e) => definir("identidade", mascararIdentidade(e.target.value))}
              placeholder="111.222.333-4"
              inputMode="numeric"
              maxLength={14}
              required
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="secao">Seção</label>
            <input id="secao" className="campo" value={form.secao} onChange={(e) => definir("secao", e.target.value.toUpperCase())} required />
          </div>
          <div>
            <label className="rotulo" htmlFor="ramal">Ramal</label>
            <input
              id="ramal"
              className="campo-mono"
              value={form.ramal}
              onChange={(e) => definir("ramal", e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
            />
          </div>
        </div>

        <CampoSenha
          id="senhaAtual"
          rotulo="Senha atual"
          valor={senhaAtual}
          aoAlterar={setSenhaAtual}
          dica="Use a senha temporária, se o Administrador Geral tiver gerado uma."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSenha id="senhaNova" rotulo="Senha nova" valor={senhaNova} aoAlterar={setSenhaNova} autoComplete="new-password" />
          <CampoSenha
            id="confirmacao"
            rotulo="Confirmar senha nova"
            valor={confirmacao}
            aoAlterar={setConfirmacao}
            autoComplete="new-password"
            dica="Repita exatamente a senha nova."
          />
        </div>

        <button type="submit" disabled={enviando} className="botao-primario w-full">
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {enviando ? "Salvando…" : "Salvar senha nova"}
        </button>

        <p className="rounded-md border border-line bg-graphite-700/60 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-400">
          Não lembra a senha atual? Peça ao Administrador Geral uma senha temporária do sistema. Ela funciona uma vez e
          o sistema pede a troca logo no primeiro acesso.
        </p>
      </form>
    </MolduraAuth>
  );
}
