"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Plus, ShieldCheck, ShieldPlus, UserMinus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Aviso from "@/components/ui/Aviso";
import CampoSenha from "@/components/ui/CampoSenha";
import CamposIdentificacao, { identificacaoVazia, type DadosIdentificacao } from "@/components/ui/CamposIdentificacao";
import SeletorMilitarFiltrado from "@/components/dashboard/SeletorMilitarFiltrado";
import {
  PERMISSOES,
  normalizarNivel,
  permissoesPadraoAdmin,
  type ChavePermissao,
  type MapaPermissoes,
  type NivelPermissao,
} from "@/lib/permissoes";
import { rotuloPosto } from "@/lib/postos";

interface Administrador {
  id: string;
  nomeCompleto: string;
  nomeGuerra: string;
  identidade: string;
  posto: string;
  secao: string;
  perfil: string;
  permissoes: MapaPermissoes | null;
  senhaTemporaria: boolean;
}

interface MilitarSimples {
  id: string;
  nomeCompleto: string;
  nomeGuerra: string;
  posto: string;
  secao: string;
  identidade: string;
  perfil: string;
}

export default function PaginaAdministradores() {
  const [administradores, setAdministradores] = useState<Administrador[]>([]);
  const [militares, setMilitares] = useState<MilitarSimples[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [modalNovo, setModalNovo] = useState(false);
  const [dados, setDados] = useState<DadosIdentificacao>(identificacaoVazia);
  const [senha, setSenha] = useState("");
  const [permissoes, setPermissoes] = useState<MapaPermissoes>(permissoesPadraoAdmin());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Concessao de privilegios a quem ja esta no efetivo, sem novo cadastro.
  const [modalConceder, setModalConceder] = useState(false);
  const [alvoConceder, setAlvoConceder] = useState("");
  const [permissoesConceder, setPermissoesConceder] = useState<MapaPermissoes>(permissoesPadraoAdmin());
  const [erroConceder, setErroConceder] = useState<string | null>(null);
  const [concedendo, setConcedendo] = useState(false);

  const [modalSenha, setModalSenha] = useState(false);
  const [alvoSenha, setAlvoSenha] = useState("");
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const [a, m] = await Promise.all([fetch("/api/administradores"), fetch("/api/militares")]);
    setAdministradores((await a.json()).administradores ?? []);
    setMilitares((await m.json()).militares ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const resposta = await fetch("/api/administradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, senha, permissoes }),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível cadastrar o administrador.");
        return;
      }
      setModalNovo(false);
      setDados(identificacaoVazia);
      setSenha("");
      setPermissoes(permissoesPadraoAdmin());
      // O cadastro nao entra direto: fica aguardando aprovacao na aba Aprovações.
      setMensagem(retorno.aviso ?? "Cadastro enviado para a aba Aprovações.");
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  /**
   * Envia a concessao de privilegios de um militar do efetivo. Como o cadastro
   * de administrador, ela fica pendente ate ser aprovada na aba Aprovacoes.
   */
  async function conceder(e: React.FormEvent) {
    e.preventDefault();
    setErroConceder(null);
    setConcedendo(true);
    try {
      const resposta = await fetch("/api/administradores/promover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ militarId: alvoConceder, permissoes: permissoesConceder }),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErroConceder(retorno.erro ?? "Não foi possível conceder os privilégios.");
        return;
      }
      setModalConceder(false);
      setAlvoConceder("");
      setPermissoesConceder(permissoesPadraoAdmin());
      setMensagem(retorno.aviso ?? "Concessão enviada para a aba Aprovações.");
      await carregar();
    } finally {
      setConcedendo(false);
    }
  }

  /**
   * Ajusta um nivel de um administrador. Marcar "editar" implica "acessar";
   * desmarcar "acessar" retira tambem a edicao.
   */
  async function alterarNivel(
    admin: Administrador,
    chave: ChavePermissao,
    campo: keyof NivelPermissao,
    valor: boolean
  ) {
    const atual = normalizarNivel(admin.permissoes?.[chave]);
    const novo: NivelPermissao =
      campo === "editar"
        ? { ver: valor ? true : atual.ver, editar: valor }
        : { ver: valor, editar: valor ? atual.editar : false };

    const atualizadas: MapaPermissoes = { ...(admin.permissoes ?? {}), [chave]: novo };

    setAdministradores((lista) =>
      lista.map((a) => (a.id === admin.id ? { ...a, permissoes: atualizadas } : a))
    );

    await fetch(`/api/administradores/${admin.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissoes: atualizadas }),
    });
  }

  async function rebaixar(admin: Administrador) {
    if (!confirm(`Retirar as permissões de administrador de ${admin.nomeGuerra}?`)) return;
    const resposta = await fetch(`/api/administradores/${admin.id}`, { method: "DELETE" });
    const retorno = await resposta.json();
    if (!resposta.ok) {
      setMensagem(retorno.erro);
      return;
    }
    setMensagem(`${admin.nomeGuerra} voltou a ser usuário comum.`);
    await carregar();
  }

  async function gerarSenhaTemporaria(e: React.FormEvent) {
    e.preventDefault();
    setSenhaGerada(null);
    const resposta = await fetch("/api/auth/senha-temporaria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ militarId: alvoSenha }),
    });
    const retorno = await resposta.json();
    if (!resposta.ok) {
      setMensagem(retorno.erro);
      return;
    }
    setSenhaGerada(retorno.senhaTemporaria);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Área do Administrador Geral</p>
          <h1 className="titulo-secao">Administradores</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cadastre administradores e escolha o que cada um pode editar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setModalSenha(true); setSenhaGerada(null); }} className="botao-secundario">
            <KeyRound size={15} /> Gerar senha temporária
          </button>
          <button
            onClick={() => {
              setAlvoConceder("");
              setPermissoesConceder(permissoesPadraoAdmin());
              setErroConceder(null);
              setModalConceder(true);
            }}
            className="botao-secundario"
          >
            <ShieldPlus size={15} /> Conceder privilégios
          </button>
          <button onClick={() => setModalNovo(true)} className="botao-primario">
            <Plus size={15} /> Cadastrar administrador
          </button>
        </div>
      </div>

      <Aviso tipo="info" mensagem={mensagem} />

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando administradores…</p>
      ) : (
        <div className="space-y-3">
          {administradores.map((a) => {
            const ehGeral = a.perfil === "ADMINISTRADOR_GERAL";
            return (
              <article key={a.id} className="cartao">
                <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <p className="text-[15px]">
                      <span className="text-zinc-500">{rotuloPosto(a.posto)} </span>
                      <span className="font-semibold text-zinc-100">{a.nomeGuerra}</span>
                      {ehGeral && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded bg-gold/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">
                          <ShieldCheck size={12} /> Administrador Geral
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-zinc-500">{a.nomeCompleto}</p>
                    <p className="font-mono text-[12px] text-zinc-600">{a.identidade} · {a.secao}</p>
                  </div>

                  {!ehGeral && (
                    <button onClick={() => rebaixar(a)} className="botao-perigo">
                      <UserMinus size={15} /> Retirar permissões
                    </button>
                  )}
                </header>

                {ehGeral ? (
                  <p className="text-sm text-zinc-500">Acesso total a todas as áreas do sistema.</p>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-[12px] text-zinc-500">
                      <span className="text-zinc-300">Acessar</span> libera a aba no menu;{" "}
                      <span className="text-zinc-300">Editar</span> libera lançar, alterar e excluir.
                    </p>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {PERMISSOES.map((p) => {
                        const nivel = normalizarNivel(a.permissoes?.[p.chave]);
                        return (
                          <div
                            key={p.chave}
                            className="rounded-md border border-line bg-graphite-700/40 px-3.5 py-3 transition-colors hover:border-gold/50"
                          >
                            <p className="text-sm text-zinc-200">{p.rotulo}</p>
                            <p className="mb-2.5 text-[12px] text-zinc-500">{p.descricao}</p>

                            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                              {!p.apenasAcao && (
                                <label
                                  className={`flex items-center gap-1.5 text-[13px] ${
                                    p.sempreVisivel ? "cursor-default text-zinc-600" : "cursor-pointer text-zinc-300"
                                  }`}
                                  title={p.sempreVisivel ? "Aba livre: visível para todos os perfis." : undefined}
                                >
                                  <input
                                    type="checkbox"
                                    className="accent-gold"
                                    checked={p.sempreVisivel ? true : nivel.ver}
                                    disabled={p.sempreVisivel}
                                    onChange={(e) => alterarNivel(a, p.chave, "ver", e.target.checked)}
                                  />
                                  Acessar
                                </label>
                              )}

                              <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-zinc-300">
                                <input
                                  type="checkbox"
                                  className="accent-gold"
                                  checked={nivel.editar}
                                  onChange={(e) => alterarNivel(a, p.chave, "editar", e.target.checked)}
                                />
                                {p.apenasAcao ? "Permitir" : "Editar"}
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal
        aberto={modalConceder}
        titulo="Conceder privilégios"
        descricao="Escolha um militar já cadastrado no efetivo e marque o que ele poderá acessar e editar. Não é preciso cadastrá-lo de novo. A concessão vai para a aba Aprovações e só vale depois de aprovada."
        aoFechar={() => setModalConceder(false)}
        largura="max-w-3xl"
      >
        <form onSubmit={conceder} className="space-y-5">
          <Aviso tipo="erro" mensagem={erroConceder} />

          <SeletorMilitarFiltrado
            id="alvoConceder"
            rotulo="Militar do efetivo"
            valor={alvoConceder}
            militares={militares.filter((m) => m.perfil !== "ADMINISTRADOR_GERAL")}
            aoAlterar={setAlvoConceder}
          />

          <div>
            <p className="rotulo">Acessos e permissões</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {PERMISSOES.map((p) => {
                const nivel = normalizarNivel(permissoesConceder[p.chave]);
                const definirNivel = (campo: keyof NivelPermissao, valor: boolean) =>
                  setPermissoesConceder((atual) => ({
                    ...atual,
                    [p.chave]:
                      campo === "editar"
                        ? { ver: valor ? true : nivel.ver, editar: valor }
                        : { ver: valor, editar: valor ? nivel.editar : false },
                  }));

                return (
                  <div key={p.chave} className="rounded-md border border-line bg-graphite-700/40 px-3.5 py-3">
                    <p className="text-sm text-zinc-200">{p.rotulo}</p>
                    <p className="mb-2.5 text-[12px] text-zinc-500">{p.descricao}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {!p.apenasAcao && (
                        <label
                          className={`flex items-center gap-1.5 text-[13px] ${
                            p.sempreVisivel ? "cursor-default text-zinc-600" : "cursor-pointer text-zinc-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-gold"
                            checked={p.sempreVisivel ? true : nivel.ver}
                            disabled={p.sempreVisivel}
                            onChange={(e) => definirNivel("ver", e.target.checked)}
                          />
                          Acessar
                        </label>
                      )}

                      <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-zinc-300">
                        <input
                          type="checkbox"
                          className="accent-gold"
                          checked={nivel.editar}
                          onChange={(e) => definirNivel("editar", e.target.checked)}
                        />
                        {p.apenasAcao ? "Permitir" : "Editar"}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[12px] text-zinc-500">
            O militar continua com a mesma identidade e a mesma senha; só o perfil muda. Como todo
            acesso administrativo, a concessão passa pela verificação em duas etapas: ela fica na aba
            <span className="text-zinc-300"> Aprovações</span> e só entra em vigor depois de aprovada.
            As permissões podem ser ajustadas depois nesta mesma página.
          </p>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setModalConceder(false)} className="botao-secundario">Cancelar</button>
            <button type="submit" disabled={concedendo || !alvoConceder} className="botao-primario">
              {concedendo ? "Enviando…" : "Enviar para aprovação"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={modalNovo}
        titulo="Cadastrar administrador"
        descricao="A inclusão vai para a aba Aprovações e só entra no sistema depois de aprovada."
        aoFechar={() => setModalNovo(false)}
        largura="max-w-3xl"
      >
        <form onSubmit={cadastrar} className="space-y-5">
          <Aviso tipo="erro" mensagem={erro} />
          <CamposIdentificacao dados={dados} aoAlterar={setDados} />

          <CampoSenha id="senha" rotulo="Senha inicial" valor={senha} aoAlterar={setSenha} autoComplete="new-password" />

          <div>
            <p className="rotulo">Acessos e permissões</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {PERMISSOES.map((p) => {
                const nivel = normalizarNivel(permissoes[p.chave]);
                const definirNivel = (campo: keyof NivelPermissao, valor: boolean) =>
                  setPermissoes((atual) => ({
                    ...atual,
                    [p.chave]:
                      campo === "editar"
                        ? { ver: valor ? true : nivel.ver, editar: valor }
                        : { ver: valor, editar: valor ? nivel.editar : false },
                  }));

                return (
                  <div key={p.chave} className="rounded-md border border-line bg-graphite-700/40 px-3.5 py-3">
                    <p className="text-sm text-zinc-200">{p.rotulo}</p>
                    <p className="mb-2.5 text-[12px] text-zinc-500">{p.descricao}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {!p.apenasAcao && (
                        <label
                          className={`flex items-center gap-1.5 text-[13px] ${
                            p.sempreVisivel ? "cursor-default text-zinc-600" : "cursor-pointer text-zinc-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-gold"
                            checked={p.sempreVisivel ? true : nivel.ver}
                            disabled={p.sempreVisivel}
                            onChange={(e) => definirNivel("ver", e.target.checked)}
                          />
                          Acessar
                        </label>
                      )}

                      <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-zinc-300">
                        <input
                          type="checkbox"
                          className="accent-gold"
                          checked={nivel.editar}
                          onChange={(e) => definirNivel("editar", e.target.checked)}
                        />
                        {p.apenasAcao ? "Permitir" : "Editar"}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setModalNovo(false)} className="botao-secundario">Cancelar</button>
            <button type="submit" disabled={salvando} className="botao-primario">
              {salvando ? "Cadastrando…" : "Cadastrar administrador"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={modalSenha}
        titulo="Gerar senha temporária"
        descricao="O militar entra com esta senha e o sistema pede a troca em seguida."
        aoFechar={() => setModalSenha(false)}
      >
        <form onSubmit={gerarSenhaTemporaria} className="space-y-4">
          <div>
            <label className="rotulo" htmlFor="alvo">Militar</label>
            <select id="alvo" className="campo" value={alvoSenha} onChange={(e) => setAlvoSenha(e.target.value)} required>
              <option value="">Selecione o militar…</option>
              {militares.map((m) => (
                <option key={m.id} value={m.id}>
                  {rotuloPosto(m.posto)} {m.nomeGuerra} — {m.identidade}
                </option>
              ))}
            </select>
          </div>

          {senhaGerada && (
            <div className="rounded-md border border-gold/50 bg-gold/10 px-4 py-4 text-center">
              <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Senha temporária</p>
              <p className="my-2 select-all font-mono text-2xl text-zinc-100">{senhaGerada}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(senhaGerada)}
                className="botao-secundario"
              >
                <Copy size={14} /> Copiar
              </button>
              <p className="mt-3 text-[12px] text-zinc-400">
                Anote agora: esta senha não volta a ser exibida.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setModalSenha(false)} className="botao-secundario">Fechar</button>
            <button type="submit" className="botao-primario">Gerar senha</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
