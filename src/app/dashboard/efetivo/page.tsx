"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Download, FileUp, ListOrdered, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useUsuario } from "@/components/dashboard/ContextoUsuario";
import Modal from "@/components/ui/Modal";
import Aviso from "@/components/ui/Aviso";
import EstadoVazio from "@/components/ui/EstadoVazio";
import CamposIdentificacao, { identificacaoVazia, type DadosIdentificacao } from "@/components/ui/CamposIdentificacao";
import { podeEditar } from "@/lib/permissoes";
import { POSTOS, ordemPosto, rotuloPosto, rotuloQuadro } from "@/lib/postos";
import { mascararIdentidade } from "@/lib/validacao";

interface Militar {
  id: string;
  nomeCompleto: string;
  identidade: string;
  nomeGuerra: string;
  ramal: string | null;
  secao: string;
  telefone: string | null;
  posto: string;
  quadro: string;
  perfil: string;
  identidadePendente: boolean;
  antiguidade: number;
}

interface LinhaPrevia {
  indice: number;
  nomeCompleto: string;
  nomeGuerra: string;
  identidade: string | null;
  identidadePendente: boolean;
  posto: string;
  secao: string;
  ramal: string | null;
  telefone: string | null;
  origem: string;
  observacoes: string[];
  jaCadastrado: boolean;
}

const normalizar = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function PaginaEfetivo() {
  const usuario = useUsuario();
  const podeGerir = podeEditar(usuario, "efetivo");

  const [militares, setMilitares] = useState<Militar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroPosto, setFiltroPosto] = useState("TODOS");
  const [filtroSecao, setFiltroSecao] = useState("TODAS");

  /** Antiguidade digitada na tabela, por militar, ainda não aplicada. */
  const [numeracao, setNumeracao] = useState<Record<string, string>>({});
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);

  const [modalEdicao, setModalEdicao] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosIdentificacao>(identificacaoVazia);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [modalPrevia, setModalPrevia] = useState(false);
  const [previa, setPrevia] = useState<LinhaPrevia[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [importando, setImportando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  async function carregar() {
    setCarregando(true);
    const resposta = await fetch("/api/militares");
    setMilitares((await resposta.json()).militares ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const secoes = useMemo(() => Array.from(new Set(militares.map((m) => m.secao))).sort(), [militares]);

  // Postos e graduacoes presentes no efetivo, na ordem hierarquica oficial.
  const postos = useMemo(
    () => Array.from(new Set(militares.map((m) => m.posto))).sort((a, b) => ordemPosto(a) - ordemPosto(b)),
    [militares]
  );

  /* ------------------------------------------------- Antiguidade da unidade */

  /**
   * Grava a antiguidade de todo o efetivo, numerando de 1 em diante na ordem
   * recebida. O número vale em todas as listas do sistema.
   */
  async function gravarAntiguidade(ordenados: Militar[]) {
    setSalvandoOrdem(true);
    try {
      await fetch("/api/militares/antiguidade", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordens: ordenados.map((m, i) => ({ id: m.id, antiguidade: i + 1 })),
        }),
      });
      setNumeracao({});
      await carregar();
    } finally {
      setSalvandoOrdem(false);
    }
  }

  /** Sobe ou desce um militar uma posição na antiguidade. */
  async function mover(posicao: number, passo: -1 | 1) {
    const destino = posicao + passo;
    if (destino < 0 || destino >= militares.length) return;

    const lista = [...militares];
    const [movido] = lista.splice(posicao, 1);
    lista.splice(destino, 0, movido);
    await gravarAntiguidade(lista);
  }

  /**
   * Aplica os números digitados na coluna de antiguidade.
   *
   * Mesma regra do Nr Ord do plano de férias: o número digitado é a posição de
   * destino, e o meio ponto de deslocamento faz a linha ocupar *aquele* lugar,
   * empurrando quem estava lá para cima ou para baixo conforme a direção.
   */
  async function aplicarAntiguidade() {
    const comChave = militares.map((militar, i) => {
      const atual = i + 1;
      const digitado = Number(numeracao[militar.id]);
      const desejado = Number.isFinite(digitado) && digitado > 0 ? digitado : atual;
      const chave = desejado === atual ? atual : desejado > atual ? desejado + 0.5 : desejado - 0.5;
      return { militar, atual, chave };
    });

    comChave.sort((a, b) => a.chave - b.chave || a.atual - b.atual);
    await gravarAntiguidade(comChave.map((c) => c.militar));
  }

  /** Quantos militares tiveram a antiguidade digitada e ainda não aplicada. */
  const edicoesDeOrdem = militares.reduce((total, m, i) => {
    const digitado = numeracao[m.id];
    return digitado !== undefined && Number(digitado) !== i + 1 ? total + 1 : total;
  }, 0);

  /** A antiguidade só pode ser mexida com a lista inteira à vista. */
  const listaCompleta =
    busca.trim() === "" && filtroPosto === "TODOS" && filtroSecao === "TODAS";
  const podeOrdenar = podeGerir && listaCompleta;

  const visiveis = useMemo(() => {    const termo = normalizar(busca);
    return militares.filter((m) => {
      if (filtroPosto !== "TODOS" && m.posto !== filtroPosto) return false;
      if (filtroSecao !== "TODAS" && m.secao !== filtroSecao) return false;
      if (!termo) return true;
      return (
        normalizar(m.nomeCompleto).includes(termo) ||
        normalizar(m.nomeGuerra).includes(termo) ||
        normalizar(m.identidade).includes(termo) ||
        normalizar(rotuloPosto(m.posto)).includes(termo)
      );
    });
  }, [militares, busca, filtroPosto, filtroSecao]);

  const pendentes = militares.filter((m) => m.identidadePendente).length;

  function abrirNovo() {
    setEditandoId(null);
    setDados(identificacaoVazia);
    setErro(null);
    setModalEdicao(true);
  }

  function abrirEdicao(m: Militar) {
    setEditandoId(m.id);
    setDados({
      nomeCompleto: m.nomeCompleto,
      identidade: m.identidadePendente ? "" : m.identidade,
      nomeGuerra: m.nomeGuerra,
      ramal: m.ramal ?? "",
      secao: m.secao,
      telefone: m.telefone ?? "",
      posto: m.posto,
      quadro: m.quadro,
    });
    setErro(null);
    setModalEdicao(true);
  }

  async function salvarMilitar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const url = editandoId ? `/api/militares/${editandoId}` : "/api/militares";
      const resposta = await fetch(url, {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível salvar o militar.");
        return;
      }
      setModalEdicao(false);
      // Inclusoes de Administrador ficam pendentes ate o aval do Administrador Geral.
      setMensagem(retorno.pendente ? retorno.aviso : null);
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(m: Militar) {
    if (!confirm(`Excluir ${m.nomeGuerra} do efetivo? Os lançamentos vinculados também serão removidos.`)) return;
    const resposta = await fetch(`/api/militares/${m.id}`, { method: "DELETE" });
    const retorno = await resposta.json();
    if (!resposta.ok) {
      setMensagem(retorno.erro);
      return;
    }
    await carregar();
  }

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setMensagem(null);
    setImportando(true);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const resposta = await fetch("/api/militares/importar", { method: "POST", body: corpo });
      const retorno = await resposta.json();

      if (!resposta.ok) {
        setMensagem(retorno.erro ?? "Não foi possível ler o arquivo.");
        return;
      }

      setPrevia(retorno.previa);
      setSelecionadas(new Set<number>(retorno.previa.map((l: LinhaPrevia) => l.indice)));
      setModalPrevia(true);
    } finally {
      setImportando(false);
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  }

  function alternarLinha(indice: number) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(indice)) proximo.delete(indice);
      else proximo.add(indice);
      return proximo;
    });
  }

  function editarIdentidadePrevia(indice: number, valor: string) {
    const formatada = mascararIdentidade(valor);
    setPrevia((atual) =>
      atual.map((l) =>
        l.indice === indice
          ? { ...l, identidade: formatada || null, identidadePendente: formatada.length !== 14 }
          : l
      )
    );
  }

  function editarPostoPrevia(indice: number, valor: string) {
    setPrevia((atual) => atual.map((l) => (l.indice === indice ? { ...l, posto: valor } : l)));
  }

  async function confirmarImportacao() {
    setImportando(true);
    try {
      const linhas = previa.filter((l) => selecionadas.has(l.indice));
      const resposta = await fetch("/api/militares/importar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linhas }),
      });
      const retorno = await resposta.json();

      if (!resposta.ok) {
        setMensagem(retorno.erro ?? "Não foi possível concluir a importação.");
        return;
      }

      setModalPrevia(false);
      setMensagem(
        retorno.pendente
          ? retorno.aviso
          : `Importação concluída: ${retorno.criados} incluído(s), ${retorno.atualizados} atualizado(s)` +
            (retorno.falhas?.length ? `, ${retorno.falhas.length} com falha.` : ".")
      );
      await carregar();
    } finally {
      setImportando(false);
    }
  }

  function exportarCsv() {
    const cabecalho = ["Posto/Grad", "Nome completo", "Nome de guerra", "Identidade", "Secao", "Ramal", "Telefone"];
    const linhas = visiveis.map((m) => [
      rotuloPosto(m.posto), m.nomeCompleto, m.nomeGuerra,
      m.identidadePendente ? "PENDENTE" : m.identidade,
      m.secao, m.ramal ?? "", m.telefone ?? "",
    ]);
    const csv = [cabecalho, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "efetivo.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Efetivo</p>
          <h1 className="titulo-secao">Efetivo da unidade</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {visiveis.length} de {militares.length} militares cadastrados
            {pendentes > 0 && <span className="text-gold"> · {pendentes} com identidade pendente</span>}
          </p>
        </div>

        {podeGerir && (
          <div className="flex flex-wrap gap-2">
            <button onClick={exportarCsv} className="botao-secundario" disabled={!visiveis.length}>
              <Download size={15} /> Exportar CSV
            </button>
            <button onClick={() => inputArquivo.current?.click()} className="botao-secundario" disabled={importando}>
              <FileUp size={15} /> {importando ? "Lendo arquivo…" : "Importar tabela ou PDF"}
            </button>
            <input
              ref={inputArquivo}
              type="file"
              accept=".xlsx,.xls,.csv,.ods,.pdf"
              onChange={enviarArquivo}
              className="hidden"
            />
            <button onClick={abrirNovo} className="botao-primario">
              <Plus size={15} /> Incluir militar
            </button>
          </div>
        )}
      </div>

      <Aviso tipo="info" mensagem={mensagem} />

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            className="campo pl-9"
            placeholder="Buscar por nome, nome de guerra, graduação, posto ou identidade"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select
          className="campo max-w-[220px]"
          value={filtroPosto}
          onChange={(e) => setFiltroPosto(e.target.value)}
          aria-label="Filtrar por posto ou graduação"
        >
          <option value="TODOS">Todos os postos/graduações</option>
          {postos.map((p) => (
            <option key={p} value={p}>{rotuloPosto(p)}</option>
          ))}
        </select>
        <select className="campo max-w-[220px]" value={filtroSecao} onChange={(e) => setFiltroSecao(e.target.value)}>
          <option value="TODAS">Todas as seções</option>
          {secoes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Antiguidade da unidade: vale em todas as listas do sistema */}
      {podeGerir && militares.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-graphite-800/50 px-4 py-3">
          <span className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.12em] text-gold">
            <ListOrdered size={15} /> Antiguidade
          </span>

          <p className="text-[13px] text-zinc-500">
            {podeOrdenar
              ? "Digite o número na coluna Antiguidade e clique em Atualizar, ou use as setas ↑ ↓ de cada linha. A ordem definida aqui vale em todo o sistema."
              : "Limpe a busca e os filtros para poder mexer na antiguidade — ela é definida com o efetivo inteiro à vista."}
          </p>

          {podeOrdenar && edicoesDeOrdem > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setNumeracao({})}
                disabled={salvandoOrdem}
                className="botao-secundario"
              >
                Descartar
              </button>
              <button onClick={aplicarAntiguidade} disabled={salvandoOrdem} className="botao-primario">
                <Check size={15} />
                {salvandoOrdem ? "Atualizando…" : `Atualizar antiguidade (${edicoesDeOrdem})`}
              </button>
            </div>
          )}
        </div>
      )}

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando efetivo…</p>
      ) : !visiveis.length ? (
        <EstadoVazio
          Icone={Users}
          titulo="Efetivo vazio"
          descricao="Importe a relação da unidade em planilha ou PDF, ou inclua os militares um a um."
          acao={
            podeGerir && (
              <button onClick={() => inputArquivo.current?.click()} className="botao-primario">
                <FileUp size={15} /> Importar tabela ou PDF
              </button>
            )
          }
        />
      ) : (
        <div className="rolagem-fina overflow-x-auto rounded-lg border border-line bg-graphite-800/50">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-graphite-700">
              <tr>
                <th className="cabecalho-tabela">Antiguidade</th>
                <th className="cabecalho-tabela">Posto/Grad</th>
                <th className="cabecalho-tabela">Nome de guerra</th>
                <th className="cabecalho-tabela">Nome completo</th>
                <th className="cabecalho-tabela">Identidade</th>
                <th className="cabecalho-tabela">Seção</th>
                <th className="cabecalho-tabela">Ramal</th>
                <th className="cabecalho-tabela">Telefone</th>
                <th className="cabecalho-tabela">Perfil</th>
                {podeGerir && <th className="cabecalho-tabela text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((m, i) => (
                <tr key={m.id} className="transition-colors hover:bg-graphite-700/50">
                  <td className="celula font-mono text-zinc-500">
                    {podeOrdenar ? (
                      <input
                        className={`w-16 rounded border bg-graphite-900/70 px-1.5 py-1 text-center font-mono text-sm text-zinc-100 focus:border-gold focus:outline-none ${
                          numeracao[m.id] !== undefined ? "border-gold/70" : "border-line"
                        }`}
                        value={numeracao[m.id] ?? String(i + 1).padStart(3, "0")}
                        inputMode="numeric"
                        aria-label={`Antiguidade de ${m.nomeGuerra}`}
                        onChange={(e) => {
                          const valor = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setNumeracao((atual) => ({ ...atual, [m.id]: valor }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            aplicarAntiguidade();
                          }
                        }}
                      />
                    ) : (
                      String(i + 1).padStart(3, "0")
                    )}
                  </td>
                  <td className="celula">
                    {rotuloPosto(m.posto)}
                    <span className="ml-1.5 text-[11px] text-gold">{rotuloQuadro(m.quadro)}</span>
                  </td>
                  <td className="celula font-semibold text-zinc-100">{m.nomeGuerra}</td>
                  <td className="celula max-w-[300px] truncate" title={m.nomeCompleto}>{m.nomeCompleto}</td>
                  <td className="celula font-mono">
                    {m.identidadePendente ? (
                      <span className="flex items-center gap-1.5 text-gold">
                        <AlertTriangle size={13} /> pendente
                      </span>
                    ) : (
                      m.identidade
                    )}
                  </td>
                  <td className="celula">{m.secao}</td>
                  <td className="celula font-mono">{m.ramal || "—"}</td>
                  <td className="celula font-mono">{m.telefone || "—"}</td>
                  <td className="celula text-[12px] uppercase tracking-wide text-zinc-500">
                    {m.perfil === "ADMINISTRADOR_GERAL" ? "Adm Geral" : m.perfil === "ADMINISTRADOR" ? "Adm" : "Usuário"}
                  </td>
                  {podeGerir && (
                    <td className="celula text-right">
                      <div className="flex justify-end gap-1">
                        {podeOrdenar && (
                          <>
                            <button
                              onClick={() => mover(i, -1)}
                              disabled={salvandoOrdem || i === 0}
                              className="rounded p-1.5 text-zinc-500 hover:text-gold disabled:opacity-30 disabled:hover:text-zinc-500"
                              aria-label="Subir na antiguidade"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              onClick={() => mover(i, 1)}
                              disabled={salvandoOrdem || i === visiveis.length - 1}
                              className="rounded p-1.5 text-zinc-500 hover:text-gold disabled:opacity-30 disabled:hover:text-zinc-500"
                              aria-label="Descer na antiguidade"
                            >
                              <ArrowDown size={15} />
                            </button>
                          </>
                        )}
                        <button onClick={() => abrirEdicao(m)} className="rounded p-1.5 text-zinc-500 hover:text-gold" aria-label="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => excluir(m)} className="rounded p-1.5 text-zinc-500 hover:text-red-400" aria-label="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        aberto={modalEdicao}
        titulo={editandoId ? "Editar militar" : "Incluir militar"}
        descricao="Somente nome completo e nome de guerra são obrigatórios."
        aoFechar={() => setModalEdicao(false)}
        largura="max-w-3xl"
      >
        <form onSubmit={salvarMilitar} className="space-y-5">
          <Aviso tipo="erro" mensagem={erro} />
          <CamposIdentificacao dados={dados} aoAlterar={setDados} />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setModalEdicao(false)} className="botao-secundario">Cancelar</button>
            <button type="submit" disabled={salvando} className="botao-primario">
              {salvando ? "Salvando…" : "Salvar militar"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={modalPrevia}
        titulo="Conferir importação"
        descricao={`${previa.length} registro(s) reconhecido(s). Desmarque o que não deve entrar e corrija o que estiver pendente.`}
        aoFechar={() => setModalPrevia(false)}
        largura="max-w-6xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>Selecionados: <span className="font-mono text-gold">{selecionadas.size}</span></span>
            <span>Com pendência: <span className="font-mono text-gold">{previa.filter((l) => l.observacoes.length).length}</span></span>
            <span>Já cadastrados: <span className="font-mono text-gold">{previa.filter((l) => l.jaCadastrado).length}</span></span>
            <button
              onClick={() =>
                setSelecionadas(
                  selecionadas.size === previa.length ? new Set() : new Set(previa.map((l) => l.indice))
                )
              }
              className="ml-auto text-gold underline-offset-4 hover:underline"
            >
              {selecionadas.size === previa.length ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>

          <div className="rolagem-fina max-h-[52vh] overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-graphite-700">
                <tr>
                  <th className="cabecalho-tabela w-10"></th>
                  <th className="cabecalho-tabela">Nome completo</th>
                  <th className="cabecalho-tabela">Nome de guerra</th>
                  <th className="cabecalho-tabela">Posto/Grad</th>
                  <th className="cabecalho-tabela">Identidade</th>
                  <th className="cabecalho-tabela">Origem</th>
                  <th className="cabecalho-tabela">Pendências</th>
                </tr>
              </thead>
              <tbody>
                {previa.map((l) => (
                  <tr key={l.indice} className={selecionadas.has(l.indice) ? "" : "opacity-40"}>
                    <td className="celula">
                      <input
                        type="checkbox"
                        className="accent-gold"
                        checked={selecionadas.has(l.indice)}
                        onChange={() => alternarLinha(l.indice)}
                        aria-label={`Importar ${l.nomeCompleto}`}
                      />
                    </td>
                    <td className="celula max-w-[260px] truncate" title={l.nomeCompleto}>{l.nomeCompleto}</td>
                    <td className="celula font-semibold text-zinc-100">{l.nomeGuerra}</td>
                    <td className="celula">
                      <select
                        className="campo py-1 text-[13px]"
                        value={l.posto}
                        onChange={(e) => editarPostoPrevia(l.indice, e.target.value)}
                      >
                        {POSTOS.map((p) => (
                          <option key={p.valor} value={p.valor}>{p.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="celula">
                      <input
                        className="campo-mono w-[150px] py-1 text-[13px]"
                        value={l.identidade ?? ""}
                        onChange={(e) => editarIdentidadePrevia(l.indice, e.target.value)}
                        placeholder="111.222.333-4"
                        maxLength={14}
                      />
                    </td>
                    <td className="celula text-zinc-500">{l.origem}</td>
                    <td className="celula">
                      {l.jaCadastrado && <span className="mr-2 text-emerald-300">já cadastrado — será atualizado</span>}
                      {l.observacoes.length ? (
                        <span className="text-gold">{l.observacoes.join(" · ")}</span>
                      ) : (
                        !l.jaCadastrado && <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button onClick={() => setModalPrevia(false)} className="botao-secundario">Cancelar</button>
            <button onClick={confirmarImportacao} disabled={importando || !selecionadas.size} className="botao-primario">
              {importando ? "Importando…" : `Importar ${selecionadas.size} registro(s)`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
