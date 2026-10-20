"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileDown, LayoutGrid, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useUsuario } from "@/components/dashboard/ContextoUsuario";
import { type MilitarResumo } from "@/components/dashboard/SeletorMilitar";
import SeletorMilitarFiltrado from "@/components/dashboard/SeletorMilitarFiltrado";
import Modal from "@/components/ui/Modal";
import Aviso from "@/components/ui/Aviso";
import EstadoVazio from "@/components/ui/EstadoVazio";
import { podeEditar } from "@/lib/permissoes";
import { rotuloPosto } from "@/lib/postos";
import { PARCELAS_FERIAS, numeroParcela, rotuloParcelaFerias } from "@/lib/parcelas";
import { gerarPdfPlano } from "@/lib/pdf-plano";
import { contarDias, formatarBR, paraInput } from "@/lib/datas";
import {
  CABECALHO_PADRAO,
  baixarCsv,
  mesAnoDe,
  montarCsvModelo,
  type CabecalhoModelo,
  type LinhaModelo,
} from "@/lib/plano-modelo";

interface RegistroFerias {
  id: string;
  inicio: string;
  termino: string;
  prontoParaServico: string | null;
  anoAquisitivo: string;
  periodoAquisitivo: string;
  qtdDias: number;
  diasDesconto: number;
  diasDispensa: number;
  pagamento: boolean;
  observacao: string | null;
  militar: MilitarResumo & { quadro?: string };
  substituto: { id: string; nomeGuerra: string; posto: string } | null;
}

const formularioVazio = {
  id: "",
  militarId: "",
  substitutoId: "",
  inicio: "",
  termino: "",
  prontoParaServico: "",
  anoAquisitivo: String(new Date().getFullYear()),
  periodoAquisitivo: "1",
  qtdDias: 30,
  diasDesconto: 0,
  diasDispensa: 0,
  pagamento: false,
  observacao: "",
};

export default function PaginaInicial() {
  const usuario = useUsuario();
  const podeLancar = podeEditar(usuario, "paginaInicial");

  const [registros, setRegistros] = useState<RegistroFerias[]>([]);
  const [militares, setMilitares] = useState<MilitarResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroPagamento, setFiltroPagamento] = useState<"TODOS" | "SIM" | "NAO">("TODOS");
  const [filtroSecao, setFiltroSecao] = useState("TODAS");
  const [modalAberto, setModalAberto] = useState(false);
  const [formulario, setFormulario] = useState(formularioVazio);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cabecalho, setCabecalho] = useState<CabecalhoModelo>(CABECALHO_PADRAO);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  async function carregar() {
    setCarregando(true);
    const [f, m, p] = await Promise.all([
      fetch("/api/ferias"),
      fetch("/api/militares"),
      fetch("/api/plano-ferias"),
    ]);
    const dadosF = await f.json();
    const dadosM = await m.json();
    setRegistros(dadosF.ferias ?? []);
    setMilitares(dadosM.militares ?? []);
    // O cabecalho do ANEXO A e compartilhado com a aba "Plano de ferias".
    if (p.ok) {
      const dadosP = await p.json();
      if (dadosP.cabecalho) setCabecalho(dadosP.cabecalho);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const secoes = useMemo(
    () => Array.from(new Set(registros.map((r) => r.militar.secao))).sort(),
    [registros]
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return registros.filter((r) => {
      if (filtroPagamento === "SIM" && !r.pagamento) return false;
      if (filtroPagamento === "NAO" && r.pagamento) return false;
      if (filtroSecao !== "TODAS" && r.militar.secao !== filtroSecao) return false;
      if (!termo) return true;
      return (
        r.militar.nomeCompleto.toLowerCase().includes(termo) ||
        r.militar.nomeGuerra.toLowerCase().includes(termo) ||
        r.militar.secao.toLowerCase().includes(termo)
      );
    });
  }, [registros, busca, filtroPagamento, filtroSecao]);

  function abrirNovo() {
    setFormulario(formularioVazio);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(r: RegistroFerias) {
    setFormulario({
      id: r.id,
      militarId: r.militar.id,
      substitutoId: r.substituto?.id ?? "",
      inicio: paraInput(r.inicio),
      termino: paraInput(r.termino),
      prontoParaServico: paraInput(r.prontoParaServico),
      anoAquisitivo: r.anoAquisitivo,
      periodoAquisitivo: r.periodoAquisitivo,
      qtdDias: r.qtdDias,
      diasDesconto: r.diasDesconto,
      diasDispensa: r.diasDispensa,
      pagamento: r.pagamento,
      observacao: r.observacao ?? "",
    });
    setErro(null);
    setModalAberto(true);
  }

  const definir = (campo: keyof typeof formulario, valor: unknown) =>
    setFormulario((f) => {
      const proximo = { ...f, [campo]: valor };
      if ((campo === "inicio" || campo === "termino") && proximo.inicio && proximo.termino) {
        proximo.qtdDias = contarDias(proximo.inicio, proximo.termino);
      }
      return proximo;
    });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const rota = formulario.id ? `/api/ferias/${formulario.id}` : "/api/ferias";
      const resposta = await fetch(rota, {
        method: formulario.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formulario),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível salvar o lançamento.");
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
    if (!confirm("Excluir este lançamento de férias?")) return;
    await fetch(`/api/ferias/${id}`, { method: "DELETE" });
    await carregar();
  }

  /**
   * Exportacao no modelo do plano de ferias (ANEXO A): blocos por categoria,
   * uma tabela por seção e as mesmas colunas do documento oficial.
   */
  function linhasDoModelo(): LinhaModelo[] {
    return visiveis.map((r) => ({
      categoria: r.militar.quadro === "PTTC" ? "PTTC" : "ATIVA",
      secao: r.militar.secao,
      postoTexto: rotuloPosto(r.militar.posto),
      nomeCompleto: r.militar.nomeCompleto,
      substitutoTexto: r.substituto
        ? `${rotuloPosto(r.substituto.posto)} ${r.substituto.nomeGuerra}`
        : "",
      periodoAquisitivo: `${r.anoAquisitivo} (${rotuloParcelaFerias(r.periodoAquisitivo)})`,
      mesAno: mesAnoDe(r.inicio),
      // A parcela vem do campo "Períodos"; o período único entra como ÚNICO.
      parcela: numeroParcela(r.periodoAquisitivo),
      dias: r.qtdDias,
      desconto: r.diasDesconto,
      inicio: formatarBR(r.inicio),
      termino: formatarBR(r.termino),
    }));
  }

  function exportarCsv() {
    baixarCsv(
      montarCsvModelo(linhasDoModelo(), cabecalho),
      `plano-de-ferias-${new Date().getFullYear()}.csv`
    );
  }

  /** Mesmo conteudo do CSV, porem paginado e pronto para imprimir. */
  async function exportarPdf() {
    setGerandoPdf(true);
    try {
      await gerarPdfPlano(linhasDoModelo(), cabecalho, {
        nomeArquivo: `quadro-de-ferias-${new Date().getFullYear()}.pdf`,
      });
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Página inicial</p>
          <h1 className="titulo-secao">Quadro de férias</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {visiveis.length} de {registros.length} lançamentos
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={exportarCsv} className="botao-secundario" disabled={!visiveis.length}>
            <Download size={15} /> Exportar CSV
          </button>
          <button
            onClick={exportarPdf}
            className="botao-secundario"
            disabled={!visiveis.length || gerandoPdf}
          >
            <FileDown size={15} /> {gerandoPdf ? "Gerando PDF…" : "Exportar PDF"}
          </button>
          {podeLancar && (
            <button onClick={abrirNovo} className="botao-primario">
              <Plus size={15} /> Lançar férias
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            className="campo pl-9"
            placeholder="Buscar por nome, nome de guerra ou seção"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div>
          <select className="campo" value={filtroPagamento} onChange={(e) => setFiltroPagamento(e.target.value as never)}>
            <option value="TODOS">Pagamento: todos</option>
            <option value="SIM">Pagamento: SIM</option>
            <option value="NAO">Pagamento: NÃO</option>
          </select>
        </div>

        <div>
          <select className="campo" value={filtroSecao} onChange={(e) => setFiltroSecao(e.target.value)}>
            <option value="TODAS">Todas as seções</option>
            {secoes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <Aviso tipo="info" mensagem={aviso} />

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando quadro…</p>
      ) : !visiveis.length ? (
        <EstadoVazio
          Icone={LayoutGrid}
          titulo="Nenhum lançamento no quadro"
          descricao="Registre o primeiro período de férias para montar o quadro da unidade."
          acao={podeLancar && <button onClick={abrirNovo} className="botao-primario"><Plus size={15} /> Lançar férias</button>}
        />
      ) : (
        <div className="rolagem-fina overflow-x-auto rounded-lg border border-line bg-graphite-800/50">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-graphite-700">
              <tr>
                <th className="cabecalho-tabela">Nr</th>
                <th className="cabecalho-tabela">Posto/Grad</th>
                <th className="cabecalho-tabela">Nome</th>
                <th className="cabecalho-tabela">Militar substituto</th>
                <th className="cabecalho-tabela text-center">Dias desconto</th>
                <th className="cabecalho-tabela text-center">Dias dispensa</th>
                <th className="cabecalho-tabela">Início férias</th>
                <th className="cabecalho-tabela">Término férias</th>
                <th className="cabecalho-tabela">Pronto para Sv</th>
                <th className="cabecalho-tabela">Ano/Período aquisitivo</th>
                <th className="cabecalho-tabela text-center">Dias de férias</th>
                <th className="cabecalho-tabela text-center">Pagamento</th>
                <th className="cabecalho-tabela">Seção</th>
                {podeLancar && <th className="cabecalho-tabela text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((r, i) => (
                <tr key={r.id} className="transition-colors hover:bg-graphite-700/50">
                  <td className="celula font-mono text-zinc-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="celula">{rotuloPosto(r.militar.posto)}</td>
                  <td className="celula max-w-[280px] truncate" title={r.militar.nomeCompleto}>
                    <span className="font-semibold text-zinc-100">{r.militar.nomeGuerra}</span>
                    <span className="ml-2 text-zinc-500">{r.militar.nomeCompleto}</span>
                  </td>
                  <td className="celula">
                    {r.substituto ? (
                      <>
                        <span className="text-zinc-500">{rotuloPosto(r.substituto.posto)} </span>
                        <span className="font-semibold text-zinc-100">{r.substituto.nomeGuerra}</span>
                      </>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="celula text-center font-mono">{r.diasDesconto}</td>
                  <td className="celula text-center font-mono">{r.diasDispensa}</td>
                  <td className="celula font-mono">{formatarBR(r.inicio)}</td>
                  <td className="celula font-mono">{formatarBR(r.termino)}</td>
                  <td className="celula font-mono">{formatarBR(r.prontoParaServico)}</td>
                  <td className="celula">
                    <span className="font-mono">{r.anoAquisitivo}</span>
                    <span className="ml-1.5 text-[12px] text-zinc-500">{rotuloParcelaFerias(r.periodoAquisitivo)}</span>
                  </td>
                  <td className="celula text-center font-mono text-gold">{r.qtdDias}</td>
                  <td className="celula text-center">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium tracking-wide ${
                        r.pagamento ? "bg-oliva/25 text-emerald-300" : "bg-rubro/20 text-red-300"
                      }`}
                    >
                      {r.pagamento ? "SIM" : "NÃO"}
                    </span>
                  </td>
                  <td className="celula">{r.militar.secao}</td>
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
        titulo={formulario.id ? "Editar lançamento" : "Lançar férias"}
        descricao="Os dias de férias são calculados pelas datas, mas podem ser ajustados."
        aoFechar={() => setModalAberto(false)}
        largura="max-w-3xl"
      >
        <form onSubmit={salvar} className="space-y-4">
          <Aviso tipo="erro" mensagem={erro} />

          <div className="grid gap-4 lg:grid-cols-2">
            <SeletorMilitarFiltrado
              id="militarId"
              rotulo="Militar"
              valor={formulario.militarId}
              militares={militares}
              aoAlterar={(v) => definir("militarId", v)}
            />
            <SeletorMilitarFiltrado
              id="substitutoId"
              rotulo="Militar substituto"
              valor={formulario.substitutoId}
              militares={militares.filter((m) => m.id !== formulario.militarId)}
              aoAlterar={(v) => definir("substitutoId", v)}
              opcional
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="inicio">Início das férias</label>
              <input id="inicio" type="date" className="campo" value={formulario.inicio} onChange={(e) => definir("inicio", e.target.value)} required />
            </div>
            <div>
              <label className="rotulo" htmlFor="termino">Término das férias</label>
              <input id="termino" type="date" className="campo" value={formulario.termino} onChange={(e) => definir("termino", e.target.value)} required />
            </div>
            <div>
              <label className="rotulo" htmlFor="pronto">Pronto para o serviço</label>
              <input id="pronto" type="date" className="campo" value={formulario.prontoParaServico} onChange={(e) => definir("prontoParaServico", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="ano">Ano/Período aquisitivo</label>
              <input
                id="ano"
                className="campo"
                value={formulario.anoAquisitivo}
                onChange={(e) => definir("anoAquisitivo", e.target.value.slice(0, 60))}
                placeholder="2026 ou 01/01/2025 a 31/12/2025"
                maxLength={60}
                required
              />
              <p className="mt-1 text-[12px] text-zinc-500">Preenchimento livre.</p>
            </div>
            <div>
              <label className="rotulo" htmlFor="periodo">Períodos</label>
              <select id="periodo" className="campo" value={formulario.periodoAquisitivo} onChange={(e) => definir("periodoAquisitivo", e.target.value)}>
                {PARCELAS_FERIAS.map((p) => (
                  <option key={p.valor} value={p.valor}>{p.rotulo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="qtdDias">Dias de férias</label>
              <input id="qtdDias" type="number" min={1} max={60} className="campo font-mono" value={formulario.qtdDias} onChange={(e) => definir("qtdDias", Number(e.target.value))} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="diasDesconto">Dias de desconto em férias</label>
              <input id="diasDesconto" type="number" min={0} max={60} className="campo font-mono" value={formulario.diasDesconto} onChange={(e) => definir("diasDesconto", Number(e.target.value))} />
            </div>
            <div>
              <label className="rotulo" htmlFor="diasDispensa">Dias de dispensa como recompensa</label>
              <input id="diasDispensa" type="number" min={0} max={60} className="campo font-mono" value={formulario.diasDispensa} onChange={(e) => definir("diasDispensa", Number(e.target.value))} />
            </div>
            <div>
              <label className="rotulo">Pagamento</label>
              <div className="flex h-[42px] items-center gap-5 rounded-md border border-line bg-graphite-800/80 px-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" className="accent-gold" checked={formulario.pagamento} onChange={() => definir("pagamento", true)} /> SIM
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" className="accent-gold" checked={!formulario.pagamento} onChange={() => definir("pagamento", false)} /> NÃO
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="observacao">Observações</label>
            <textarea id="observacao" className="campo min-h-[80px]" value={formulario.observacao} onChange={(e) => definir("observacao", e.target.value)} placeholder="Ex.: fracionamento autorizado pelo Cmt" />
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setModalAberto(false)} className="botao-secundario">Cancelar</button>
            <button type="submit" disabled={salvando} className="botao-primario">
              {salvando ? "Salvando…" : "Salvar lançamento"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
