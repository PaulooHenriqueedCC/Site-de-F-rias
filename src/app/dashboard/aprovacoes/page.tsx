"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, ShieldQuestion, Trash2, X } from "lucide-react";
import { useUsuario } from "@/components/dashboard/ContextoUsuario";
import Aviso from "@/components/ui/Aviso";
import EstadoVazio from "@/components/ui/EstadoVazio";
import Modal from "@/components/ui/Modal";
import { rotuloSolicitacao, type TipoSolicitacaoValor } from "@/lib/solicitacoes-modelo";
import { ordemPosto, rotuloPosto } from "@/lib/postos";

interface Solicitacao {
  id: string;
  tipo: TipoSolicitacaoValor;
  status: "PENDENTE" | "APROVADA" | "RECUSADA";
  resumo: string;
  dados: Record<string, unknown>;
  justificativa: string | null;
  criadoEm: string;
  revisadoEm: string | null;
  solicitante: { id: string; nomeGuerra: string; nomeCompleto: string; posto: string; secao: string };
  revisor: { id: string; nomeGuerra: string; posto: string } | null;
}

const ESTILO_STATUS: Record<string, string> = {
  PENDENTE: "bg-gold/20 text-gold",
  APROVADA: "bg-oliva/25 text-emerald-300",
  RECUSADA: "bg-rubro/20 text-red-300",
};

type Filtro = "PENDENTE" | "APROVADA" | "RECUSADA" | "TODAS";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "PENDENTE", rotulo: "Pendentes" },
  { valor: "APROVADA", rotulo: "Aprovadas" },
  { valor: "RECUSADA", rotulo: "Recusadas" },
  { valor: "TODAS", rotulo: "Todas" },
];

const normalizar = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Esconde a senha cifrada do cadastro de administrador na tela de detalhes. */
function semSegredos(dados: Record<string, unknown>): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...dados };
  if ("senhaHash" in copia) copia.senhaHash = "(senha cifrada)";
  if ("senha" in copia) copia.senha = "(oculta)";
  return copia;
}

function dataHora(valor: string | null) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function PaginaAprovacoes() {
  const usuario = useUsuario();
  const ehAdminGeral = usuario?.perfil === "ADMINISTRADOR_GERAL";

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("PENDENTE");
  const [busca, setBusca] = useState("");
  const [filtroPosto, setFiltroPosto] = useState("TODOS");
  const [filtroSecao, setFiltroSecao] = useState("TODAS");

  const [detalhe, setDetalhe] = useState<Solicitacao | null>(null);

  async function carregar() {
    setCarregando(true);
    const resposta = await fetch("/api/solicitacoes");
    setSolicitacoes(resposta.ok ? ((await resposta.json()).solicitacoes ?? []) : []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  // Postos e secoes presentes na fila, para alimentar os seletores.
  const postos = useMemo(
    () =>
      Array.from(new Set(solicitacoes.map((s) => s.solicitante.posto))).sort(
        (a, b) => ordemPosto(a) - ordemPosto(b)
      ),
    [solicitacoes]
  );

  const secoes = useMemo(
    () =>
      Array.from(new Set(solicitacoes.map((s) => s.solicitante.secao)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [solicitacoes]
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);

    return solicitacoes.filter((s) => {
      if (filtro !== "TODAS" && s.status !== filtro) return false;
      if (filtroPosto !== "TODOS" && s.solicitante.posto !== filtroPosto) return false;
      if (filtroSecao !== "TODAS" && s.solicitante.secao !== filtroSecao) return false;
      if (!termo) return true;

      // A busca cobre quem enviou e o resumo, que traz o militar envolvido.
      return (
        normalizar(s.solicitante.nomeCompleto).includes(termo) ||
        normalizar(s.solicitante.nomeGuerra).includes(termo) ||
        normalizar(s.solicitante.secao ?? "").includes(termo) ||
        normalizar(rotuloPosto(s.solicitante.posto)).includes(termo) ||
        normalizar(s.resumo).includes(termo)
      );
    });
  }, [solicitacoes, filtro, busca, filtroPosto, filtroSecao]);

  const pendentes = solicitacoes.filter((s) => s.status === "PENDENTE").length;

  async function decidir(s: Solicitacao, decisao: "APROVAR" | "RECUSAR") {
    const justificativa =
      decisao === "RECUSAR" ? prompt("Motivo da recusa (opcional):") ?? "" : "";

    setErro(null);
    setMensagem(null);
    setEmAndamento(s.id);
    try {
      const resposta = await fetch(`/api/solicitacoes/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao, justificativa }),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível concluir a revisão.");
        return;
      }
      setMensagem(
        decisao === "APROVAR"
          ? "Solicitação aprovada e registro gravado no sistema."
          : "Solicitação recusada."
      );
      await carregar();
    } finally {
      setEmAndamento(null);
    }
  }

  async function cancelar(s: Solicitacao) {
    if (!confirm("Cancelar esta solicitação pendente?")) return;
    setEmAndamento(s.id);
    try {
      const resposta = await fetch(`/api/solicitacoes/${s.id}`, { method: "DELETE" });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível cancelar.");
        return;
      }
      await carregar();
    } finally {
      setEmAndamento(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Verificação em duas etapas</p>
          <h1 className="titulo-secao">Aprovações</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {ehAdminGeral
              ? `${pendentes} inclusão(ões) aguardando a sua aprovação`
              : "Acompanhe aqui as inclusões que você enviou para aprovação"}
          </p>
        </div>

        {/* Abas de situação */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-graphite-900/50 p-1">
          {FILTROS.map((f) => {
            const quantidade =
              f.valor === "TODAS"
                ? solicitacoes.length
                : solicitacoes.filter((s) => s.status === f.valor).length;
            const ativa = filtro === f.valor;
            return (
              <button
                key={f.valor}
                onClick={() => setFiltro(f.valor)}
                className={`rounded-md px-3.5 py-2 text-sm transition-colors ${
                  ativa ? "bg-gold font-medium text-graphite-900" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {f.rotulo}
                <span className={`ml-1.5 font-mono text-[11px] ${ativa ? "text-graphite-900/70" : "text-zinc-600"}`}>
                  {quantidade}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pesquisa por nome, seção, posto e graduação */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            className="campo pl-9"
            placeholder="Buscar por nome, seção, posto ou graduação"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <select
          className="campo max-w-[230px]"
          value={filtroPosto}
          onChange={(e) => setFiltroPosto(e.target.value)}
          aria-label="Filtrar por posto ou graduação"
        >
          <option value="TODOS">Todos os postos/graduações</option>
          {postos.map((p) => (
            <option key={p} value={p}>{rotuloPosto(p)}</option>
          ))}
        </select>

        <select
          className="campo max-w-[230px]"
          value={filtroSecao}
          onChange={(e) => setFiltroSecao(e.target.value)}
          aria-label="Filtrar por seção"
        >
          <option value="TODAS">Todas as seções</option>
          {secoes.map((sec) => (
            <option key={sec} value={sec}>{sec}</option>
          ))}
        </select>
      </div>

      <Aviso tipo="sucesso" mensagem={mensagem} />
      <Aviso tipo="erro" mensagem={erro} />

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando solicitações…</p>
      ) : !visiveis.length ? (
        <EstadoVazio
          Icone={ShieldQuestion}
          titulo="Nada encontrado"
          descricao="Nenhuma solicitação corresponde aos filtros escolhidos. Toda inclusão aparece aqui até o Administrador Geral concluir a segunda etapa."
        />
      ) : (
        <div className="space-y-3">
          {visiveis.map((s) => (
            <article key={s.id} className="cartao">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[11px] uppercase tracking-[0.12em] text-gold">
                      {rotuloSolicitacao(s.tipo, s.dados)}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium tracking-wide ${ESTILO_STATUS[s.status]}`}>
                      {s.status}
                    </span>
                  </div>

                  <p className="mt-1.5 text-[15px] text-zinc-100">{s.resumo}</p>

                  <p className="mt-1 text-sm text-zinc-500">
                    Enviada por {rotuloPosto(s.solicitante.posto)}{" "}
                    <span className="text-zinc-400">{s.solicitante.nomeGuerra}</span>
                    {s.solicitante.secao && <span className="text-zinc-600"> · {s.solicitante.secao}</span>} em{" "}
                    {dataHora(s.criadoEm)}
                  </p>

                  {s.status !== "PENDENTE" && (
                    <p className="text-sm text-zinc-500">
                      {s.status === "APROVADA" ? "Aprovada" : "Recusada"} por{" "}
                      {s.revisor ? `${rotuloPosto(s.revisor.posto)} ${s.revisor.nomeGuerra}` : "—"} em{" "}
                      {dataHora(s.revisadoEm)}
                      {s.justificativa && <span className="text-zinc-400"> · {s.justificativa}</span>}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setDetalhe(s)} className="botao-secundario px-3">Detalhes</button>

                  {s.status === "PENDENTE" && ehAdminGeral && (
                    <>
                      <button
                        onClick={() => decidir(s, "APROVAR")}
                        disabled={emAndamento === s.id}
                        className="botao-primario"
                      >
                        <Check size={15} /> Aprovar
                      </button>
                      <button
                        onClick={() => decidir(s, "RECUSAR")}
                        disabled={emAndamento === s.id}
                        className="botao-perigo"
                      >
                        <X size={15} /> Recusar
                      </button>
                    </>
                  )}

                  {s.status === "PENDENTE" && s.solicitante.id === usuario?.id && (
                    <button
                      onClick={() => cancelar(s)}
                      disabled={emAndamento === s.id}
                      className="botao-secundario px-3"
                      aria-label="Cancelar solicitação"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </header>
            </article>
          ))}
        </div>
      )}

      <Modal
        aberto={Boolean(detalhe)}
        titulo="Conteúdo da solicitação"
        descricao="Dados exatamente como serão gravados após a aprovação."
        aoFechar={() => setDetalhe(null)}
        largura="max-w-3xl"
      >
        <pre className="rolagem-fina max-h-[60vh] overflow-auto rounded-md border border-line bg-graphite-900/60 p-4 font-mono text-[12px] text-zinc-300">
          {JSON.stringify(semSegredos(detalhe?.dados ?? {}), null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
