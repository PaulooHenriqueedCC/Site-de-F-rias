"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import MolduraAuth from "@/components/auth/MolduraAuth";
import Aviso from "@/components/ui/Aviso";
import CampoSenha from "@/components/ui/CampoSenha";
import CamposIdentificacao, { identificacaoVazia, type DadosIdentificacao } from "@/components/ui/CamposIdentificacao";
import { identidadeValida, senhaValida } from "@/lib/validacao";

export default function PaginaCadastro() {
  const router = useRouter();
  const [dados, setDados] = useState<DadosIdentificacao>(identificacaoVazia);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!identidadeValida(dados.identidade)) return setErro("A identidade precisa seguir o formato 111.222.333-4.");
    if (!dados.posto) return setErro("Selecione o posto ou graduação.");

    const checagem = senhaValida(senha);
    if (!checagem.ok) return setErro(checagem.erro!);
    if (senha !== confirmacao) return setErro("A confirmação não confere com a senha nova.");

    setEnviando(true);
    try {
      const resposta = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, senha }),
      });
      const retorno = await resposta.json();

      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível concluir o cadastro.");
        return;
      }

      setSucesso("Cadastro concluído. Redirecionando para o acesso…");
      setTimeout(() => router.push("/login"), 1400);
    } catch {
      setErro("Servidor indisponível. Verifique a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MolduraAuth
      titulo="Cadastrar usuário"
      subtitulo="Preencha os dados como constam na ficha funcional."
      largura="max-w-2xl"
      rodape={
        <Link href="/login" className="text-zinc-400 underline-offset-4 hover:text-gold hover:underline">
          Voltar para o acesso
        </Link>
      }
    >
      <form onSubmit={cadastrar} className="space-y-5">
        <Aviso tipo="erro" mensagem={erro} />
        <Aviso tipo="sucesso" mensagem={sucesso} />

        <CamposIdentificacao dados={dados} aoAlterar={setDados} />

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSenha id="senha" rotulo="Senha" valor={senha} aoAlterar={setSenha} autoComplete="new-password" />
          <CampoSenha
            id="confirmacao"
            rotulo="Confirmar senha"
            valor={confirmacao}
            aoAlterar={setConfirmacao}
            autoComplete="new-password"
            dica="Repita exatamente a senha acima."
          />
        </div>

        <button type="submit" disabled={enviando} className="botao-primario w-full">
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {enviando ? "Cadastrando…" : "Cadastrar"}
        </button>
      </form>
    </MolduraAuth>
  );
}
