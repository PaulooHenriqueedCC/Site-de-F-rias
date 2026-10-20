"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useUsuario } from "@/components/dashboard/ContextoUsuario";
import { type MilitarResumo } from "@/components/dashboard/SeletorMilitar";
import SeletorMilitarFiltrado from "@/components/dashboard/SeletorMilitarFiltrado";
import Modal from "@/components/ui/Modal";
import Aviso from "@/components/ui/Aviso";
import EstadoVazio from "@/components/ui/EstadoVazio";
import { podeEditar } from "@/lib/permissoes";
import { ordemPosto, rotuloPosto } from "@/lib/postos";
import { formatarBR, paraInput } from "@/lib/datas";

interface Pagamento {
  id: string;
  diex: string | null;
  dataDiex: string | null;
  pago: boolean;
  observacao: string | null;
  militar: MilitarResumo;
}

const formularioVazio = {
  id: "",
  militarId: "",
  diex: "",
  dataDiex: "",
  pago: false,
  observacao: "",
};

const normalizar = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function PaginaPagamento() {
  const usuario = useUsuario();
  const podeLancar = podeEditar(usuario, "pagamento");

  const [registros, setRegistros] = useState<Pagamento[]>([]);
  const [militares, setMilitares] = useState<MilitarResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroPosto, setFiltroPosto] = useState("TODOS");
  const [filtroSecao, setFiltroSecao] = useState("TODAS");
  const [modalAberto, setModalAberto] = useState(false);
  const [formulario, setFormulario] = useState(formularioVazio);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const [p, m] = await Promise.all([fetch("/api/pagamentos"), fetch("/api/militares")]);
    setRegistros((await p.json()).registros ?? []);
    setMilitares((await m.json()).militares ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  // Postos e secoes presentes nos lancamentos, para alimentar os seletores.
  const postos = useMemo(
    () =>
      Array.from(new Set(registros.map((r) => r.militar.posto))).sort(
        (a, b) => ordemPosto(a) - ordemPosto(b)
      ),
    [registros]
  );

  const secoes = useMemo(
    () =>
      Array.from(new Set(registros.map((r) => r.militar.secao)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [registros]
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);

    return registros.filter((r) => {
      if (filtroPosto !== "TODOS" && r.militar.posto !== filtroPosto) return false;
      if (filtroSecao !== "TODAS" && r.militar.secao !== filtroSecao) return false;
      if (!termo) return true;

      return (
        normalizar(r.militar.nomeCompleto).includes(termo) ||
        normalizar(r.militar.nomeGuerra).includes(termo) ||
        normalizar(rotuloPosto(r.militar.posto)).includes(termo) ||
        normalizar(r.militar.secao ?? "").includes(termo) ||
        normalizar(r.diex ?? "").includes(termo)
      );
    });
  }, [registros, busca, filtroPosto, filtroSecao]);

  const pagos = registros.filter((r) => r.pago).length;

  function abrirNovo() {
    setFormulario(formularioVazio);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(r: Pagamento) {
    setFormulario({
      id: r.id,
      militarId: r.militar.id,
      diex: r.diex ?? "",
      dataDiex: paraInput(r.dataDiex),
      pago: r.pago,
      observacao: r.observacao ?? "",
    });
    setErro(null);
    setModalAberto(true);
  }

  const definir = (campo: keyof typeof formulario, valor: unknown) =>
    setFormulario((f) => ({ ...f, [campo]: valor }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const url = formulario.id ? `/api/pagamentos/${formulario.id}` : "/api/pagamentos";
      const resposta = await fetch(url, {
        method: formulario.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formulario),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível salvar o pagamento.");
        return;
      }
      setModalAberto(false);
      setAviso(retorno.pendente ? retorno.aviso : null);
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este registro de pagamento?")) return;
    await fetch(`/api/pagamentos/${id}`, { method: "DELETE" });
    await carregar();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Pagamento de férias</p>
          <h1 className="titulo-secao">DIEx de pagamento</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {pagos} de {registros.length} com pagamento confirmado
            {visiveis.length !== registros.length && ` · ${visiveis.length} em exibição`}
          </p>
        </div>

        {podeLancar && (
          <button onClick={abrirNovo} className="botao-primario">
            <Plus size={15} /> Informar DIEx
          </button>
        )}
      </div>

      {!podeLancar && (
        <Aviso tipo="info" mensagem="O DIEx de pagamento é informado pelo Administrador Geral. Aqui você acompanha a situação." />
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            className="campo pl-9"
            placeholder="Buscar por nome do militar, posto/graduação, seção ou DIEx"
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

      <Aviso tipo="info" mensagem={aviso} />

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando pagamentos…</p>
      ) : !visiveis.length ? (
        <EstadoVazio
          Icone={Receipt}
          titulo="Nenhum DIEx informado"
          descricao="Registre o DIEx que autoriza o pagamento das férias de cada militar."
          acao={podeLancar && <button onClick={abrirNovo} className="botao-primario"><Plus size={15} /> Informar DIEx</button>}
        />
      ) : (
        <div className="rolagem-fina overflow-x-auto rounded-lg border border-line bg-graphite-800/50">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-graphite-700">
              <tr>
                <th className="cabecalho-tabela">Nr</th>
                <th className="cabecalho-tabela">Posto/Grad</th>
                <th className="cabecalho-tabela">Militar</th>
                <th className="cabecalho-tabela">Seção</th>
                <th className="cabecalho-tabela">DIEx de pagamento</th>
                <th className="cabecalho-tabela">Data do DIEx</th>
                <th className="cabecalho-tabela text-center">Situação</th>
                <th className="cabecalho-tabela">Observação</th>
                {podeLancar && <th className="cabecalho-tabela text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((r, i) => (
                <tr key={r.id} className="transition-colors hover:bg-graphite-700/50">
                  <td className="celula font-mono text-zinc-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="celula">{rotuloPosto(r.militar.posto)}</td>
                  <td className="celula">
                    <span className="font-semibold text-zinc-100">{r.militar.nomeGuerra}</span>
                    <span className="ml-2 text-zinc-500">{r.militar.nomeCompleto}</span>
                  </td>
                  <td className="celula">{r.militar.secao}</td>
                  <td className="celula font-mono text-gold">{r.diex || "—"}</td>
                  <td className="celula font-mono">{formatarBR(r.dataDiex)}</td>
                  <td className="celula text-center">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                        r.pago ? "bg-oliva/25 text-emerald-300" : "bg-rubro/20 text-red-300"
                      }`}
                    >
                      {r.pago ? "PAGO" : "PENDENTE"}
                    </span>
                  </td>
                  <td className="celula max-w-[260px] truncate text-zinc-500" title={r.observacao ?? ""}>
                    {r.observacao || "—"}
                  </td>
                  {podeLancar && (
                    <td className="celula text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => abrirEdicao(r)} className="rounded p-1.5 text-zinc-500 hover:text-gold" aria-label="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => excluir(r.id)} className="rounded p-1.5 text-zinc-500 hover:text-red-400" aria-label="Excluir">
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
        aberto={modalAberto}
        titulo={formulario.id ? "Editar pagamento" : "Informar DIEx de pagamento"}
        aoFechar={() => setModalAberto(false)}
      >
        <form onSubmit={salvar} className="space-y-4">
          <Aviso tipo="erro" mensagem={erro} />

          <SeletorMilitarFiltrado
            id="militarId"
            rotulo="Militar"
            valor={formulario.militarId}
            militares={militares}
            aoAlterar={(v) => definir("militarId", v)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="diex">Número do DIEx</label>
              <input
                id="diex"
                className="campo font-mono"
                value={formulario.diex}
                onChange={(e) => definir("diex", e.target.value.toUpperCase())}
                placeholder="DIEx nº 123-S1"
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="dataDiex">Data do DIEx</label>
              <input id="dataDiex" type="date" className="campo" value={formulario.dataDiex} onChange={(e) => definir("dataDiex", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="rotulo">Situação</label>
            <div className="flex h-[42px] items-center gap-5 rounded-md border border-line bg-graphite-800/80 px-3">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" className="accent-gold" checked={formulario.pago} onChange={() => definir("pago", true)} /> Pago
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" className="accent-gold" checked={!formulario.pago} onChange={() => definir("pago", false)} /> Pendente
              </label>
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="observacao">Observação</label>
            <textarea
              id="observacao"
              className="campo min-h-[90px]"
              value={formulario.observacao}
              onChange={(e) => definir("observacao", e.target.value)}
              placeholder="Ex.: pagamento na folha de março"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setModalAberto(false)} className="botao-secundario">Cancelar</button>
            <button type="submit" disabled={salvando} className="botao-primario">
              {salvando ? "Salvando…" : "Salvar pagamento"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
