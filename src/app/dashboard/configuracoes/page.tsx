"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Save } from "lucide-react";
import Aviso from "@/components/ui/Aviso";
import CampoSenha from "@/components/ui/CampoSenha";
import CamposIdentificacao, { identificacaoVazia, type DadosIdentificacao } from "@/components/ui/CamposIdentificacao";

function ConteudoConfiguracoes() {
  const parametros = useSearchParams();
  const chegouComSenhaTemporaria = parametros.get("trocar") === "1";

  const [dados, setDados] = useState<DadosIdentificacao>(identificacaoVazia);
  const [carregando, setCarregando] = useState(true);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);
  const [sucessoPerfil, setSucessoPerfil] = useState<string | null>(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [sucessoSenha, setSucessoSenha] = useState<string | null>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => r.json())
      .then((d) => {
        const m = d.militar;
        if (!m) return;
        setDados({
          nomeCompleto: m.nomeCompleto,
          identidade: m.identidade,
          nomeGuerra: m.nomeGuerra,
          ramal: m.ramal ?? "",
          secao: m.secao,
          telefone: m.telefone ?? "",
          posto: m.posto,
          quadro: m.quadro,
        });
      })
      .finally(() => setCarregando(false));
  }, []);

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    setErroPerfil(null);
    setSucessoPerfil(null);
    setSalvandoPerfil(true);
    try {
      const resposta = await fetch("/api/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErroPerfil(retorno.erro ?? "Não foi possível salvar o perfil.");
        return;
      }
      setSucessoPerfil("Perfil atualizado.");
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroSenha(null);
    setSucessoSenha(null);
    setSalvandoSenha(true);
    try {
      const resposta = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, senhaNova, confirmacao }),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErroSenha(retorno.erro ?? "Não foi possível trocar a senha.");
        return;
      }
      setSucessoSenha("Senha alterada.");
      setSenhaAtual("");
      setSenhaNova("");
      setConfirmacao("");
    } finally {
      setSalvandoSenha(false);
    }
  }

  if (carregando) {
    return <p className="py-16 text-center text-sm text-zinc-500">Carregando perfil…</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="eyebrow">Configurações</p>
        <h1 className="titulo-secao">Perfil e acesso</h1>
      </div>

      {chegouComSenhaTemporaria && (
        <Aviso
          tipo="info"
          mensagem="Você entrou com uma senha temporária. Defina uma senha própria antes de continuar."
        />
      )}

      <section className="cartao">
        <h2 className="mb-5 font-display text-sm uppercase tracking-[0.16em] text-gold">Dados do perfil</h2>
        <form onSubmit={salvarPerfil} className="space-y-5">
          <Aviso tipo="erro" mensagem={erroPerfil} />
          <Aviso tipo="sucesso" mensagem={sucessoPerfil} />

          <CamposIdentificacao dados={dados} aoAlterar={setDados} travarIdentidade />
          <p className="text-[13px] text-zinc-500">
            A identidade militar é a sua chave de acesso e só pode ser alterada pelo Administrador Geral.
          </p>

          <div className="flex justify-end border-t border-line pt-4">
            <button type="submit" disabled={salvandoPerfil} className="botao-primario">
              <Save size={15} /> {salvandoPerfil ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </form>
      </section>

      <section className="cartao">
        <h2 className="mb-5 font-display text-sm uppercase tracking-[0.16em] text-gold">Alterar senha</h2>
        <form onSubmit={trocarSenha} className="space-y-4">
          <Aviso tipo="erro" mensagem={erroSenha} />
          <Aviso tipo="sucesso" mensagem={sucessoSenha} />

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

          <p className="rounded-md border border-line bg-graphite-700/50 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-400">
            Não lembra a senha atual? Procure o Administrador Geral, que gera uma senha temporária do sistema para você
            entrar e definir a sua.
          </p>

          <div className="flex justify-end border-t border-line pt-4">
            <button type="submit" disabled={salvandoSenha} className="botao-primario">
              <KeyRound size={15} /> {salvandoSenha ? "Salvando…" : "Salvar senha nova"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function PaginaConfiguracoes() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-zinc-500">Carregando perfil…</p>}>
      <ConteudoConfiguracoes />
    </Suspense>
  );
}
