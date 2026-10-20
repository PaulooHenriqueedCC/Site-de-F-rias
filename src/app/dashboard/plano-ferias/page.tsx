"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarRange, Check, Download, FileDown, FileUp, PenLine, ListOrdered, Pencil, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { useUsuario } from "@/components/dashboard/ContextoUsuario";
import type { MilitarResumo } from "@/components/dashboard/SeletorMilitar";
import SeletorMilitarFiltrado from "@/components/dashboard/SeletorMilitarFiltrado";
import Modal from "@/components/ui/Modal";
import Aviso from "@/components/ui/Aviso";
import EstadoVazio from "@/components/ui/EstadoVazio";
import { podeEditar } from "@/lib/permissoes";
import { POSTOS, ordemPosto, rotuloPosto } from "@/lib/postos";
import { contarDias, formatarBR, paraInput } from "@/lib/datas";
import {
  CABECALHO_PADRAO,
  CATEGORIAS_PLANO,
  PARCELAS,
  TIPOS_REFERENCIA,
  agruparPorModelo,
  baixarCsv,
  categoriaPlano,
  celulasDaLinha,
  mesAnoDe,
  montarCsvModelo,
  montarPeriodoAquisitivo,
  postoDaLinha,
  rotuloParcela,
  tituloGrupo,
  type CabecalhoModelo,
  type CategoriaPlanoValor,
  type LinhaModelo,
  type TipoReferencia,
} from "@/lib/plano-modelo";
import { gerarPdfPlano } from "@/lib/pdf-plano";
import { partesDaAssinatura } from "@/lib/assinaturas";

interface LinhaPlano {
  id: string;
  categoria: CategoriaPlanoValor;
  secao: string;
  ano: number;
  ordem: number;
  militarId: string | null;
  nomeCompleto: string;
  postoTexto: string;
  substitutoId: string | null;
  substitutoTexto: string;
  periodoAquisitivo: string;
  tipoReferencia: TipoReferencia;
  mesAno: string;
  parcela: number;
  dias: number;
  descontoManual: number | null;
  descontoAplicado: number;
  diasEfetivos: number;
  inicio: string | null;
  termino: string | null;
  observacao: string | null;
  /** Vem do GET quando a linha esta vinculada a alguem do efetivo. */
  militar?: { id: string; posto: string; secao: string } | null;
}

interface LinhaPrevia {
  indice: number;
  categoria: CategoriaPlanoValor;
  secao: string;
  ano: number;
  postoTexto: string;
  nomeCompleto: string;
  substitutoTexto: string;
  periodoAquisitivo: string;
  tipoReferencia: TipoReferencia;
  mesAno: string;
  parcela: number;
  dias: number;
  inicio: string | null;
  termino: string | null;
  origem: string;
  observacoes: string[];
}

const formularioVazio = {
  id: "",
  categoria: "ATIVA" as CategoriaPlanoValor,
  secao: "",
  ano: new Date().getFullYear(),
  ordem: 0,
  militarId: "",
  nomeCompleto: "",
  postoTexto: "",
  substitutoId: "",
  substitutoTexto: "",
  periodoAquisitivo: "",
  tipoReferencia: "PERIODO" as TipoReferencia,
  // auxiliares do modo "Período aquisitivo" — não são gravados
  refInicio: "",
  refTermino: "",
  refNumero: 1,
  refAno: String(new Date().getFullYear()),
  mesAno: "",
  parcela: 0,
  dias: 30,
  descontoManual: "" as number | "",
  inicio: "",
  termino: "",
  observacao: "",
};

export default function PaginaPlanoFerias() {
  const usuario = useUsuario();
  const podeGerir = podeEditar(usuario, "planoFerias");

  const [linhas, setLinhas] = useState<LinhaPlano[]>([]);
  const [militares, setMilitares] = useState<MilitarResumo[]>([]);
  const [cabecalho, setCabecalho] = useState<CabecalhoModelo>(CABECALHO_PADRAO);
  /** Nr Ord calculado pela antiguidade; falso = ordem manual das setas. */
  const [porAntiguidade, setPorAntiguidade] = useState(true);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroAno, setFiltroAno] = useState("TODOS");
  const [filtroSecao, setFiltroSecao] = useState("TODAS");
  const [filtroPosto, setFiltroPosto] = useState("TODOS");
  const [reordenando, setReordenando] = useState(false);
  /** Nr Ord digitado na planilha, por linha, ainda não aplicado. */
  const [numeracao, setNumeracao] = useState<Record<string, string>>({});

  const [modalLinha, setModalLinha] = useState(false);
  const [formulario, setFormulario] = useState(formularioVazio);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [modalPrevia, setModalPrevia] = useState(false);
  const [previa, setPrevia] = useState<LinhaPrevia[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [importando, setImportando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Exportacao com assinatura: em papel ou enviada para assinatura digital.
  const [modalAssinatura, setModalAssinatura] = useState(false);
  const [assinaturaForm, setAssinaturaForm] = useState({
    signatarioId: "",
    funcao: "",
    observacao: "",
  });
  const [erroAssinatura, setErroAssinatura] = useState<string | null>(null);
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(false);
  const [modalCabecalho, setModalCabecalho] = useState(false);
  const [rascunhoCabecalho, setRascunhoCabecalho] = useState<CabecalhoModelo>(CABECALHO_PADRAO);

  async function carregar() {
    setCarregando(true);
    const [p, m] = await Promise.all([fetch("/api/plano-ferias"), fetch("/api/militares")]);
    const dadosP = await p.json();
    setLinhas(dadosP.linhas ?? []);
    if (dadosP.cabecalho) {
      setCabecalho(dadosP.cabecalho);
      setPorAntiguidade(dadosP.cabecalho.ordemPorAntiguidade !== false);
    }
    setMilitares((await m.json()).militares ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const anos = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.ano))).sort((a, b) => b - a),
    [linhas]
  );
  const secoes = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.secao))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [linhas]
  );

  // Postos presentes no plano, em ordem hierárquica, para alimentar o filtro.
  const postos = useMemo(
    () =>
      Array.from(new Set(linhas.map((l) => postoDaLinha(l))))
        .sort((a, b) => ordemPosto(a) - ordemPosto(b)),
    [linhas]
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtroAno !== "TODOS" && String(l.ano) !== filtroAno) return false;
      if (filtroSecao !== "TODAS" && l.secao !== filtroSecao) return false;
      if (filtroPosto !== "TODOS" && postoDaLinha(l) !== filtroPosto) return false;
      if (!termo) return true;
      return (
        l.nomeCompleto.toLowerCase().includes(termo) ||
        l.postoTexto.toLowerCase().includes(termo) ||
        l.secao.toLowerCase().includes(termo) ||
        l.substitutoTexto.toLowerCase().includes(termo)
      );
    });
  }, [linhas, busca, filtroAno, filtroSecao, filtroPosto]);

  /** Converte as linhas do banco para o formato do documento. */
  const paraModelo = (lista: LinhaPlano[]): LinhaModelo[] =>
    lista.map((l) => ({
      categoria: l.categoria,
      secao: l.secao,
      postoTexto: l.postoTexto,
      nomeCompleto: l.nomeCompleto,
      substitutoTexto: l.substitutoTexto,
      periodoAquisitivo: l.periodoAquisitivo,
      mesAno: l.mesAno || mesAnoDe(l.inicio),
      parcela: l.parcela,
      dias: l.diasEfetivos,
      desconto: l.descontoAplicado,
      inicio: formatarBR(l.inicio),
      termino: formatarBR(l.termino),
    }));

  // Os grupos preservam a ordem de `visiveis`, o que permite recuperar a linha
  // original pela posição dentro do grupo na hora de editar ou excluir.
  const blocos = useMemo(
    () => agruparPorModelo(paraModelo(visiveis)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visiveis]
  );

  /** Recupera a linha original a partir da posicao dentro do grupo. */
  function originalDe(categoria: CategoriaPlanoValor, secao: string, posicao: number): LinhaPlano | undefined {
    return visiveis.filter((l) => l.categoria === categoria && (l.secao || "NAO INFORMADA") === secao)[posicao];
  }

  function abrirNova() {
    // Sem o campo de ordem no formulário, a linha nova entra no fim da lista;
    // depois é só digitar o Nr Ord desejado na planilha ou usar as setas.
    const ultima = linhas.reduce((maior, l) => Math.max(maior, l.ordem), 0);

    setFormulario({
      ...formularioVazio,
      ano: Number(filtroAno) || new Date().getFullYear(),
      ordem: ultima + 1,
    });
    setErro(null);
    setModalLinha(true);
  }

  function abrirEdicao(l: LinhaPlano) {
    setFormulario({
      id: l.id,
      categoria: l.categoria,
      secao: l.secao,
      ano: l.ano,
      ordem: l.ordem,
      militarId: l.militarId ?? "",
      nomeCompleto: l.nomeCompleto,
      postoTexto: l.postoTexto,
      substitutoId: l.substitutoId ?? "",
      substitutoTexto: l.substitutoTexto,
      periodoAquisitivo: l.periodoAquisitivo,
      tipoReferencia: l.tipoReferencia ?? "PERIODO",
      refInicio: "",
      refTermino: "",
      refNumero: 1,
      refAno: /^\d{4}$/.test(l.periodoAquisitivo) ? l.periodoAquisitivo : String(l.ano),
      mesAno: l.mesAno,
      parcela: l.parcela,
      dias: l.dias,
      descontoManual: l.descontoManual ?? "",
      inicio: paraInput(l.inicio),
      termino: paraInput(l.termino),
      observacao: l.observacao ?? "",
    });
    setErro(null);
    setModalLinha(true);
  }

  const definir = (campo: keyof typeof formulario, valor: unknown) =>
    setFormulario((f) => ({ ...f, [campo]: valor }));

  /**
   * Mexeu no modo, nas datas ou no ano: remonta o texto da coluna de referência.
   * O campo final continua editável, então uma reescrita manual não se perde
   * enquanto o administrador não voltar a mexer nestes campos.
   */
  const definirReferencia = (campo: keyof typeof formulario, valor: unknown) =>
    setFormulario((f) => {
      const p = { ...f, [campo]: valor };
      p.periodoAquisitivo =
        p.tipoReferencia === "ANO"
          ? p.refAno
          : montarPeriodoAquisitivo(p.refInicio, p.refTermino, p.refNumero);
      return p;
    });

  /** Ao escolher um militar, os campos livres recebem os dados dele mas seguem editáveis. */
  function escolherMilitar(id: string) {
    const m = militares.find((x) => x.id === id);
    setFormulario((f) => ({
      ...f,
      militarId: id,
      nomeCompleto: m ? m.nomeCompleto : f.nomeCompleto,
      postoTexto: m ? rotuloPosto(m.posto) : f.postoTexto,
      secao: m && !f.secao ? m.secao : f.secao,
    }));
  }

  function escolherSubstituto(id: string) {
    const m = militares.find((x) => x.id === id);
    setFormulario((f) => ({
      ...f,
      substitutoId: id,
      substitutoTexto: m ? `${rotuloPosto(m.posto)} ${m.nomeGuerra}` : f.substitutoTexto,
    }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const corpo = {
        ...formulario,
        // O servidor recalcula a partir das datas; o valor abaixo só é usado
        // quando a linha não tem início e término (caso de importações antigas).
        dias: diasCalculados ?? formulario.dias,
        mesAno: formulario.mesAno || mesAnoDe(formulario.inicio),
        militarId: formulario.militarId || null,
        substitutoId: formulario.substitutoId || null,
      };
      const url = formulario.id ? `/api/plano-ferias/${formulario.id}` : "/api/plano-ferias";
      const resposta = await fetch(url, {
        method: formulario.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível salvar a linha do plano.");
        return;
      }
      setModalLinha(false);
      setAviso(retorno.pendente ? retorno.aviso : null);
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(l: LinhaPlano) {
    if (!confirm(`Excluir a linha de ${l.nomeCompleto} do plano de férias?`)) return;
    await fetch(`/api/plano-ferias/${l.id}`, { method: "DELETE" });
    await carregar();
  }

  async function salvarCabecalho(e: React.FormEvent) {
    e.preventDefault();
    const resposta = await fetch("/api/plano-ferias", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rascunhoCabecalho),
    });
    if (resposta.ok) {
      setCabecalho(rascunhoCabecalho);
      setModalCabecalho(false);
    }
  }

  async function enviarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setAviso(null);
    setImportando(true);
    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const resposta = await fetch("/api/plano-ferias/importar", { method: "POST", body: corpo });
      const retorno = await resposta.json();

      if (!resposta.ok) {
        setAviso(retorno.erro ?? "Não foi possível ler a planilha.");
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

  function editarPrevia(indice: number, campo: keyof LinhaPrevia, valor: unknown) {
    setPrevia((atual) => atual.map((l) => (l.indice === indice ? { ...l, [campo]: valor } : l)));
  }

  async function confirmarImportacao() {
    setImportando(true);
    try {
      const linhas = previa.filter((l) => selecionadas.has(l.indice));
      const resposta = await fetch("/api/plano-ferias/importar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linhas }),
      });
      const retorno = await resposta.json();

      if (!resposta.ok) {
        setAviso(retorno.erro ?? "Não foi possível concluir a importação.");
        return;
      }

      setModalPrevia(false);
      setAviso(
        retorno.pendente
          ? retorno.aviso
          : `Importação concluída: ${retorno.criados} linha(s) incluída(s)` +
            (retorno.falhas?.length ? `, ${retorno.falhas.length} com falha.` : ".")
      );
      await carregar();
    } finally {
      setImportando(false);
    }
  }

  /** Alterna entre a numeração por antiguidade e a ordem manual. */
  async function alternarOrdenacao(novo: boolean) {
    setPorAntiguidade(novo);
    setNumeracao({});
    await fetch("/api/plano-ferias", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordemPorAntiguidade: novo }),
    });
    await carregar();
  }

  /**
   * Move uma linha da posição `origem` para a posição `destino` dentro do
   * próprio grupo e renumera o grupo inteiro, para que a ordem fique sem
   * buracos nem empates. Usada pelas setas ↑ ↓ de cada linha.
   */
  async function reordenar(
    categoria: CategoriaPlanoValor,
    secao: string,
    origem: number,
    destino: number
  ) {
    const doGrupo = visiveis.filter(
      (l) => l.categoria === categoria && (l.secao || "NAO INFORMADA") === secao
    );
    if (origem === destino) return;
    if (destino < 0 || destino >= doGrupo.length) return;

    const reordenado = [...doGrupo];
    const [movida] = reordenado.splice(origem, 1);
    reordenado.splice(destino, 0, movida);

    setNumeracao({});
    setReordenando(true);
    try {
      await fetch("/api/plano-ferias/ordenar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordens: reordenado.map((l, i) => ({ id: l.id, ordem: i + 1 })),
        }),
      });
      await carregar();
    } finally {
      setReordenando(false);
    }
  }

  /** Uma casa para cima ou para baixo, pelas setas da linha. */
  const mover = (categoria: CategoriaPlanoValor, secao: string, posicao: number, passo: -1 | 1) =>
    reordenar(categoria, secao, posicao, posicao + passo);

  /**
   * Aplica os Nr Ord digitados na planilha.
   *
   * Dentro de cada seção, cada linha recebe uma chave de ordenação: as que
   * ficaram como estavam usam a posição atual; as que foram digitadas usam o
   * número escolhido, deslocado meio ponto na direção do movimento. É esse
   * meio ponto que faz "quero ser o 3º" colocar a linha *no* 3º lugar,
   * empurrando quem estava lá para cima ou para baixo, conforme o caso.
   */
  async function aplicarNumeracao() {
    const ordens: { id: string; ordem: number }[] = [];

    for (const bloco of blocos) {
      for (const grupo of bloco.grupos) {
        const doGrupo = visiveis.filter(
          (l) => l.categoria === bloco.categoria.valor && (l.secao || "NAO INFORMADA") === grupo.secao
        );

        const comChave = doGrupo.map((linha, i) => {
          const atual = i + 1;
          const digitado = Number(numeracao[linha.id]);
          const desejado = Number.isFinite(digitado) && digitado > 0 ? digitado : atual;

          const chave =
            desejado === atual ? atual : desejado > atual ? desejado + 0.5 : desejado - 0.5;

          return { linha, atual, chave };
        });

        comChave.sort((a, b) => a.chave - b.chave || a.atual - b.atual);
        comChave.forEach((c, i) => ordens.push({ id: c.linha.id, ordem: i + 1 }));
      }
    }

    if (!ordens.length) return;

    setReordenando(true);
    try {
      await fetch("/api/plano-ferias/ordenar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordens }),
      });
      setNumeracao({});
      await carregar();
    } finally {
      setReordenando(false);
    }
  }

  function exportar() {
    const nome = `plano-de-ferias-${filtroAno === "TODOS" ? "completo" : filtroAno}.csv`;
    baixarCsv(montarCsvModelo(paraModelo(visiveis), cabecalho), nome);
  }

  /** Descreve os filtros ativos, para registrar o recorte assinado. */
  function recorteAtual() {
    const ano = filtroAno === "TODOS" ? "todos os anos" : `ano ${filtroAno}`;
    const secao = filtroSecao === "TODAS" ? "todas as seções" : filtroSecao;
    const pg = filtroPosto === "TODOS" ? "todos os postos/graduações" : rotuloPosto(filtroPosto);
    return `${ano} · ${secao} · ${pg}`;
  }

  /** Exporta agora, com espaço em branco para a assinatura de próprio punho. */
  async function exportarComAssinatura() {
    const militar = militares.find((m) => m.id === assinaturaForm.signatarioId);
    if (!militar) {
      setErroAssinatura("Selecione quem vai assinar.");
      return;
    }
    if (!assinaturaForm.funcao.trim()) {
      setErroAssinatura("Informe o que o militar é (a função sai abaixo do nome).");
      return;
    }

    setEnviandoAssinatura(true);
    try {
      await gerarPdfPlano(paraModelo(visiveis), cabecalho, {
        nomeArquivo: `plano-de-ferias-assinatura-${filtroAno === "TODOS" ? "completo" : filtroAno}.pdf`,
        assinatura: {
          nomeCompleto: militar.nomeCompleto,
          nomeGuerra: militar.nomeGuerra,
          posto: militar.posto,
          funcao: assinaturaForm.funcao.trim(),
        },
      });
      setModalAssinatura(false);
    } finally {
      setEnviandoAssinatura(false);
    }
  }

  /** Envia para o militar assinar digitalmente, congelando o conteúdo atual. */
  async function enviarParaAssinatura() {
    setErroAssinatura(null);
    setEnviandoAssinatura(true);
    try {
      const resposta = await fetch("/api/assinaturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatarioId: assinaturaForm.signatarioId,
          funcao: assinaturaForm.funcao,
          titulo: `${cabecalho.anexo} — plano de férias`,
          linhas: paraModelo(visiveis),
          cabecalho,
          recorte: recorteAtual(),
          observacao: assinaturaForm.observacao,
        }),
      });
      const retorno = await resposta.json();

      if (!resposta.ok) {
        setErroAssinatura(retorno.erro ?? "Não foi possível enviar.");
        return;
      }

      setModalAssinatura(false);
      setAssinaturaForm({ signatarioId: "", funcao: "", observacao: "" });
      setMensagem(retorno.aviso);
    } finally {
      setEnviandoAssinatura(false);
    }
  }

  /** Planilha do plano em PDF (A4 deitado), pronta para imprimir. */
  async function exportarPdf() {
    setGerandoPdf(true);
    try {
      await gerarPdfPlano(paraModelo(visiveis), cabecalho, {
        nomeArquivo: `plano-de-ferias-${filtroAno === "TODOS" ? "completo" : filtroAno}.pdf`,
      });
    } finally {
      setGerandoPdf(false);
    }
  }

  const categoriaAtual = categoriaPlano(formulario.categoria);

  /** Quantas linhas tiveram o Nr Ord digitado e ainda não aplicado. */
  const numeroDeEdicoes = useMemo(() => {
    let total = 0;
    for (const bloco of blocos) {
      for (const grupo of bloco.grupos) {
        const doGrupo = visiveis.filter(
          (l) => l.categoria === bloco.categoria.valor && (l.secao || "NAO INFORMADA") === grupo.secao
        );
        doGrupo.forEach((l, i) => {
          const digitado = numeracao[l.id];
          if (digitado !== undefined && Number(digitado) !== i + 1) total++;
        });
      }
    }
    return total;
  }, [blocos, visiveis, numeracao]);

  /**
   * Dias de férias da linha em edição: contados de início a término, incluindo
   * as duas pontas. Fica nulo enquanto faltar uma das datas.
   */
  const diasCalculados =
    formulario.inicio && formulario.termino
      ? Math.max(0, contarDias(formulario.inicio, formulario.termino))
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Plano de férias</p>
          <h1 className="titulo-secao">{cabecalho.anexo}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {visiveis.length} de {linhas.length} linhas · modelo oficial do plano de férias
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={exportar} className="botao-secundario" disabled={!visiveis.length}>
            <Download size={15} /> Exportar CSV
          </button>
          <button
            onClick={exportarPdf}
            className="botao-secundario"
            disabled={!visiveis.length || gerandoPdf}
          >
            <FileDown size={15} /> {gerandoPdf ? "Gerando PDF…" : "Exportar PDF"}
          </button>
          {podeGerir && (
            <button
              onClick={() => {
                setAssinaturaForm({ signatarioId: "", funcao: "", observacao: "" });
                setErroAssinatura(null);
                setModalAssinatura(true);
              }}
              className="botao-secundario"
              disabled={!visiveis.length}
            >
              <PenLine size={15} /> PDF com assinatura
            </button>
          )}
          {podeGerir && (
            <>
              <button
                onClick={() => inputArquivo.current?.click()}
                className="botao-secundario"
                disabled={importando}
              >
                <FileUp size={15} /> {importando ? "Lendo planilha…" : "Importar planilha"}
              </button>
              <input
                ref={inputArquivo}
                type="file"
                accept=".xlsx,.xlsm,.xls,.csv,.ods"
                onChange={enviarArquivo}
                className="hidden"
              />
              <button
                onClick={() => {
                  setRascunhoCabecalho(cabecalho);
                  setModalCabecalho(true);
                }}
                className="botao-secundario"
              >
                <Settings2 size={15} /> Cabeçalho
              </button>
              <button onClick={abrirNova} className="botao-primario">
                <Plus size={15} /> Incluir linha
              </button>
            </>
          )}
        </div>
      </div>

      <Aviso tipo="sucesso" mensagem={mensagem} />
      <Aviso tipo="info" mensagem={aviso} />

      {/* Cabecalho institucional do documento */}
      <div className="rounded-lg border border-line bg-graphite-800/50 px-5 py-4 text-center">
        <p className="font-display text-[13px] uppercase tracking-[0.18em] text-zinc-200">{cabecalho.linha1}</p>
        <p className="font-display text-[13px] uppercase tracking-[0.18em] text-zinc-200">{cabecalho.linha2}</p>
        <p className="font-display text-[13px] uppercase tracking-[0.18em] text-zinc-200">{cabecalho.linha3}</p>
        <p className="font-display text-[13px] uppercase tracking-[0.18em] text-zinc-200">{cabecalho.linha4}</p>
        <p className="mt-2 font-display text-[13px] uppercase tracking-[0.24em] text-gold">{cabecalho.anexo}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            className="campo pl-9"
            placeholder="Buscar por nome, posto/graduação, substituto ou seção"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select className="campo max-w-[180px]" value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}>
          <option value="TODOS">Todos os anos</option>
          {anos.map((a) => (
            <option key={a} value={String(a)}>{a}</option>
          ))}
        </select>
        <select className="campo max-w-[240px]" value={filtroSecao} onChange={(e) => setFiltroSecao(e.target.value)}>
          <option value="TODAS">Todas as seções</option>
          {secoes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
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
      </div>

      {/* Como o Nr Ord da planilha é calculado */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-graphite-800/50 px-4 py-3">
        <span className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.12em] text-gold">
          <ListOrdered size={15} /> Nr Ord
        </span>

        <div className="flex gap-1 rounded-lg border border-line bg-graphite-900/50 p-1">
          {[
            { valor: true, rotulo: "Por antiguidade" },
            { valor: false, rotulo: "Manual" },
          ].map((opcao) => (
            <button
              key={String(opcao.valor)}
              onClick={() => podeGerir && alternarOrdenacao(opcao.valor)}
              disabled={!podeGerir}
              className={`rounded-md px-3.5 py-1.5 text-sm transition-colors ${
                porAntiguidade === opcao.valor
                  ? "bg-gold font-medium text-graphite-900"
                  : "text-zinc-400 hover:text-zinc-100 disabled:hover:text-zinc-400"
              }`}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>

        <p className="text-[13px] text-zinc-500">
          {porAntiguidade
            ? "A planilha se renumera sozinha, do posto mais antigo para o mais moderno dentro de cada seção."
            : "Digite o Nr Ord na planilha e clique em Atualizar numeração, ou use as setas ↑ ↓ no fim de cada linha."}
        </p>

        {!porAntiguidade && podeGerir && numeroDeEdicoes > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setNumeracao({})}
              disabled={reordenando}
              className="botao-secundario"
            >
              Descartar
            </button>
            <button onClick={aplicarNumeracao} disabled={reordenando} className="botao-primario">
              <Check size={15} />
              {reordenando
                ? "Atualizando…"
                : `Atualizar numeração (${numeroDeEdicoes})`}
            </button>
          </div>
        )}
      </div>

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando plano de férias…</p>
      ) : !visiveis.length ? (
        <EstadoVazio
          Icone={CalendarRange}
          titulo="Plano de férias vazio"
          descricao="Monte o ANEXO A incluindo as linhas de militares da ativa e de PTTC."
          acao={
            podeGerir && (
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={() => inputArquivo.current?.click()} className="botao-secundario">
                  <FileUp size={15} /> Importar planilha
                </button>
                <button onClick={abrirNova} className="botao-primario">
                  <Plus size={15} /> Incluir linha
                </button>
              </div>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {blocos.map((bloco) =>
            !bloco.grupos.length ? null : (
              <section key={bloco.categoria.valor} className="space-y-4">
                <h2 className="font-display text-[15px] font-semibold text-zinc-100">
                  {bloco.categoria.letra}. {bloco.categoria.titulo}
                </h2>

                {bloco.grupos.map((grupo) => (
                  <div key={grupo.secao} className="rolagem-fina overflow-x-auto rounded-lg border border-line bg-graphite-800/50">
                    <p className="border-b border-line bg-graphite-700 px-3 py-2.5 text-center font-display text-[12px] uppercase tracking-[0.12em] text-zinc-200">
                      {tituloGrupo(grupo.secao)}
                    </p>

                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-graphite-700/60">
                        <tr>
                          {bloco.categoria.colunas.map((c) => (
                            <th key={c} className="cabecalho-tabela text-center">{c}</th>
                          ))}
                          {podeGerir && <th className="cabecalho-tabela text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.linhas.map((linha, i) => {
                          const original = originalDe(bloco.categoria.valor, grupo.secao, i);
                          // No modo manual o Nr Ord vira campo editável.
                          const numeravel = podeGerir && !porAntiguidade;

                          return (
                            <tr
                              key={original?.id ?? i}
                              className="transition-colors hover:bg-graphite-700/50"
                            >
                              {celulasDaLinha(linha, i + 1).map((celula, j) => (
                                <td
                                  key={j}
                                  className={`celula text-center ${j === 0 ? "font-mono text-zinc-500" : ""}`}
                                >
                                  {j === 0 && numeravel && original ? (
                                    <input
                                      className={`w-14 rounded border bg-graphite-900/70 px-1.5 py-1 text-center font-mono text-sm text-zinc-100 focus:border-gold focus:outline-none ${
                                        numeracao[original.id] !== undefined
                                          ? "border-gold/70"
                                          : "border-line"
                                      }`}
                                      value={numeracao[original.id] ?? String(i + 1).padStart(2, "0")}
                                      inputMode="numeric"
                                      aria-label={`Nr Ord de ${linha.nomeCompleto}`}
                                      onChange={(e) => {
                                        const valor = e.target.value.replace(/\D/g, "").slice(0, 3);
                                        setNumeracao((atual) => ({ ...atual, [original.id]: valor }));
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          aplicarNumeracao();
                                        }
                                      }}
                                    />
                                  ) : (
                                    celula || "—"
                                  )}
                                </td>
                              ))}
                              {podeGerir && (
                                <td className="celula text-right">
                                  <div className="flex justify-end gap-1">
                                    {!porAntiguidade && (
                                      <>
                                        <button
                                          onClick={() => mover(bloco.categoria.valor, grupo.secao, i, -1)}
                                          disabled={reordenando || i === 0}
                                          className="rounded p-1.5 text-zinc-500 hover:text-gold disabled:opacity-30 disabled:hover:text-zinc-500"
                                          aria-label="Subir uma posição"
                                        >
                                          <ArrowUp size={15} />
                                        </button>
                                        <button
                                          onClick={() => mover(bloco.categoria.valor, grupo.secao, i, 1)}
                                          disabled={reordenando || i === grupo.linhas.length - 1}
                                          className="rounded p-1.5 text-zinc-500 hover:text-gold disabled:opacity-30 disabled:hover:text-zinc-500"
                                          aria-label="Descer uma posição"
                                        >
                                          <ArrowDown size={15} />
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => original && abrirEdicao(original)}
                                      className="rounded p-1.5 text-zinc-500 hover:text-gold"
                                      aria-label="Editar linha"
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    <button
                                      onClick={() => original && excluir(original)}
                                      className="rounded p-1.5 text-zinc-500 hover:text-red-400"
                                      aria-label="Excluir linha"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </section>
            )
          )}

          <p className="text-[13px] text-zinc-500">
            A coluna <span className="text-zinc-300">Desc</span> e os dias exibidos já consideram os
            lançamentos da aba <span className="text-gold">Desconto em férias</span>: os dias são
            abatidos automaticamente das parcelas do mesmo ano, na ordem cronológica.
          </p>
        </div>
      )}

      {/* ------------------------------------------------ Inclusao / edicao */}
      <Modal
        aberto={modalLinha}
        titulo={formulario.id ? "Editar linha do plano" : "Incluir linha no plano"}
        descricao="Todos os campos são livres, para reproduzir o documento oficial exatamente como ele é publicado."
        aoFechar={() => setModalLinha(false)}
        largura="max-w-4xl"
      >
        <form onSubmit={salvar} className="space-y-4">
          <Aviso tipo="erro" mensagem={erro} />

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="categoria">Bloco do ANEXO</label>
              <select
                id="categoria"
                className="campo"
                value={formulario.categoria}
                onChange={(e) => definir("categoria", e.target.value)}
              >
                {CATEGORIAS_PLANO.map((c) => (
                  <option key={c.valor} value={c.valor}>{c.letra}. {c.titulo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="secao">Seção</label>
              <input
                id="secao"
                className="campo"
                value={formulario.secao}
                onChange={(e) => definir("secao", e.target.value)}
                placeholder="Ex.: Chefia de Material (C Mat)"
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="ano">Ano do plano</label>
              <input
                id="ano"
                type="number"
                className="campo font-mono"
                value={formulario.ano}
                onChange={(e) => definir("ano", Number(e.target.value))}
                required
              />
            </div>
          </div>

          <SeletorMilitarFiltrado
            id="militarId"
            rotulo="Militar do efetivo (opcional — preenche nome e P/G)"
            valor={formulario.militarId}
            militares={militares}
            aoAlterar={escolherMilitar}
            opcional
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor="nomeCompleto">Nome completo</label>
              <input
                id="nomeCompleto"
                className="campo"
                value={formulario.nomeCompleto}
                onChange={(e) => definir("nomeCompleto", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="postoTexto">P/G</label>
              <input
                id="postoTexto"
                className="campo"
                value={formulario.postoTexto}
                onChange={(e) => definir("postoTexto", e.target.value)}
                placeholder="Ex.: Cel, Gen Bda, Cel R/1"
              />
            </div>
          </div>

          {/* Substituto: agora disponível também para PTTC. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <SeletorMilitarFiltrado
              id="substitutoId"
              rotulo="Substituto do efetivo (opcional)"
              valor={formulario.substitutoId}
              militares={militares.filter((m) => m.id !== formulario.militarId)}
              aoAlterar={escolherSubstituto}
              opcional
            />
            <div>
              <label className="rotulo" htmlFor="substitutoTexto">Substituto (texto do documento)</label>
              <input
                id="substitutoTexto"
                className="campo"
                value={formulario.substitutoTexto}
                onChange={(e) => definir("substitutoTexto", e.target.value)}
                placeholder="Ex.: Maj FULANO DE TAL"
              />
            </div>
          </div>

          {/* Coluna de referência: período aquisitivo completo ou apenas o ano. */}
          <div className="space-y-3 rounded-md border border-line bg-graphite-800/40 p-3">
            <div>
              <label className="rotulo" htmlFor="tipoReferencia">Preencher a coluna com</label>
              <select
                id="tipoReferencia"
                className="campo max-w-[260px]"
                value={formulario.tipoReferencia}
                onChange={(e) => definirReferencia("tipoReferencia", e.target.value as TipoReferencia)}
              >
                {TIPOS_REFERENCIA.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                ))}
              </select>
            </div>

            {formulario.tipoReferencia === "ANO" ? (
              <div className="max-w-[200px]">
                <label className="rotulo" htmlFor="refAno">Ano</label>
                <input
                  id="refAno"
                  className="campo font-mono"
                  value={formulario.refAno}
                  onChange={(e) => definirReferencia("refAno", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="2027"
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="rotulo" htmlFor="refInicio">Início do período aquisitivo</label>
                  <input
                    id="refInicio"
                    type="date"
                    className="campo"
                    value={formulario.refInicio}
                    onChange={(e) => definirReferencia("refInicio", e.target.value)}
                  />
                </div>
                <div>
                  <label className="rotulo" htmlFor="refTermino">Término do período aquisitivo</label>
                  <input
                    id="refTermino"
                    type="date"
                    className="campo"
                    value={formulario.refTermino}
                    onChange={(e) => definirReferencia("refTermino", e.target.value)}
                  />
                </div>
                <div>
                  <label className="rotulo" htmlFor="refNumero">Nº do período</label>
                  <select
                    id="refNumero"
                    className="campo"
                    value={formulario.refNumero}
                    onChange={(e) => definirReferencia("refNumero", Number(e.target.value))}
                  >
                    <option value={0}>Sem numeração</option>
                    <option value={1}>1º período</option>
                    <option value={2}>2º período</option>
                    <option value={3}>3º período</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="rotulo" htmlFor="periodoAquisitivo">Como sairá no documento</label>
              <input
                id="periodoAquisitivo"
                className="campo"
                value={formulario.periodoAquisitivo}
                onChange={(e) => definir("periodoAquisitivo", e.target.value)}
                placeholder="Ex.: 01/05/2026 a 30/04/2027 (1º período)"
              />
              <p className="mt-1.5 text-[12px] text-zinc-500">
                O texto é montado a partir dos campos acima, mas você pode reescrevê-lo à vontade.
              </p>
            </div>
          </div>


          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="inicio">Início</label>
              <input
                id="inicio"
                type="date"
                className="campo"
                value={formulario.inicio}
                onChange={(e) => definir("inicio", e.target.value)}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="termino">Término</label>
              <input
                id="termino"
                type="date"
                className="campo"
                value={formulario.termino}
                onChange={(e) => definir("termino", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="rotulo" htmlFor="mesAno">Mês_Ano</label>
              <input
                id="mesAno"
                className="campo font-mono"
                value={formulario.mesAno}
                onChange={(e) => definir("mesAno", e.target.value)}
                placeholder={mesAnoDe(formulario.inicio) || "DEZ_26"}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="parcela">Per</label>
              <select
                id="parcela"
                className="campo"
                value={formulario.parcela}
                onChange={(e) => definir("parcela", Number(e.target.value))}
              >
                {PARCELAS.map((p) => (
                  <option key={p} value={p}>{rotuloParcela(p, categoriaAtual.ordinal)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="dias">Dias</label>
              <input
                id="dias"
                className="campo cursor-not-allowed bg-graphite-900/60 font-mono text-zinc-300"
                value={diasCalculados !== null ? diasCalculados : formulario.dias}
                readOnly
                aria-readonly
              />
              <p className="mt-1 text-[12px] text-zinc-500">
                {diasCalculados !== null ? "Calculado pelas datas" : "Informe início e término"}
              </p>
            </div>
            <div>
              <label className="rotulo" htmlFor="descontoManual">Desc (manual)</label>
              <input
                id="descontoManual"
                type="number"
                min={0}
                max={90}
                className="campo font-mono"
                value={formulario.descontoManual}
                onChange={(e) =>
                  definir("descontoManual", e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="auto"
              />
            </div>
          </div>

          <p className="-mt-2 text-[12px] text-zinc-500">
            Os <span className="font-mono text-zinc-400">Dias</span> saem do intervalo entre início e
            término, contando as duas pontas. Deixe <span className="font-mono text-zinc-400">Desc</span>{" "}
            em branco para que os dias lançados em “Desconto em férias” sejam abatidos automaticamente.
          </p>

          <div>
            <label className="rotulo" htmlFor="observacao">Observações</label>
            <input
              id="observacao"
              className="campo"
              value={formulario.observacao}
              onChange={(e) => definir("observacao", e.target.value)}
              placeholder="Anotação interna, não sai no documento"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setModalLinha(false)} className="botao-secundario">Cancelar</button>
            <button type="submit" disabled={salvando} className="botao-primario">
              {salvando ? "Salvando…" : "Salvar linha"}
            </button>
          </div>
        </form>
      </Modal>

      {/* --------------------------------------- Conferência da importação */}
      <Modal
        aberto={modalPrevia}
        titulo="Conferir importação do plano"
        descricao={`${previa.length} linha(s) reconhecida(s). Desmarque o que não deve entrar e ajuste o que estiver pendente.`}
        aoFechar={() => setModalPrevia(false)}
        largura="max-w-6xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>Selecionadas: <span className="font-mono text-gold">{selecionadas.size}</span></span>
            <span>Com pendência: <span className="font-mono text-gold">{previa.filter((l) => l.observacoes.length).length}</span></span>
            <button
              onClick={() =>
                setSelecionadas(
                  selecionadas.size === previa.length ? new Set() : new Set(previa.map((l) => l.indice))
                )
              }
              className="ml-auto text-gold underline-offset-4 hover:underline"
            >
              {selecionadas.size === previa.length ? "Desmarcar todas" : "Marcar todas"}
            </button>
          </div>

          <div className="rolagem-fina max-h-[52vh] overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-graphite-700">
                <tr>
                  <th className="cabecalho-tabela w-10"></th>
                  <th className="cabecalho-tabela">Bloco</th>
                  <th className="cabecalho-tabela">Seção</th>
                  <th className="cabecalho-tabela">P/G</th>
                  <th className="cabecalho-tabela">Nome completo</th>
                  <th className="cabecalho-tabela">Substituto</th>
                  <th className="cabecalho-tabela">Per. aquisitivo / Ano</th>
                  <th className="cabecalho-tabela text-center">Per</th>
                  <th className="cabecalho-tabela text-center">Dias</th>
                  <th className="cabecalho-tabela">Início</th>
                  <th className="cabecalho-tabela">Término</th>
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
                    <td className="celula">
                      <select
                        className="campo py-1 text-[13px]"
                        value={l.categoria}
                        onChange={(e) => editarPrevia(l.indice, "categoria", e.target.value)}
                      >
                        {CATEGORIAS_PLANO.map((c) => (
                          <option key={c.valor} value={c.valor}>{c.letra}. {c.titulo}</option>
                        ))}
                      </select>
                    </td>
                    <td className="celula">
                      <input
                        className="campo w-[170px] py-1 text-[13px]"
                        value={l.secao}
                        onChange={(e) => editarPrevia(l.indice, "secao", e.target.value)}
                      />
                    </td>
                    <td className="celula">
                      <input
                        className="campo w-[90px] py-1 text-[13px]"
                        value={l.postoTexto}
                        onChange={(e) => editarPrevia(l.indice, "postoTexto", e.target.value)}
                      />
                    </td>
                    <td className="celula max-w-[240px] truncate" title={l.nomeCompleto}>{l.nomeCompleto}</td>
                    <td className="celula">
                      <input
                        className="campo w-[160px] py-1 text-[13px]"
                        value={l.substitutoTexto}
                        onChange={(e) => editarPrevia(l.indice, "substitutoTexto", e.target.value)}
                      />
                    </td>
                    <td className="celula">
                      <input
                        className="campo w-[220px] py-1 text-[13px]"
                        value={l.periodoAquisitivo}
                        onChange={(e) => editarPrevia(l.indice, "periodoAquisitivo", e.target.value)}
                      />
                    </td>
                    <td className="celula text-center">
                      {rotuloParcela(l.parcela, categoriaPlano(l.categoria).ordinal)}
                    </td>
                    <td className="celula text-center font-mono">{l.dias}</td>
                    <td className="celula font-mono">{formatarBR(l.inicio)}</td>
                    <td className="celula font-mono">{formatarBR(l.termino)}</td>
                    <td className="celula">
                      {l.observacoes.length ? (
                        <span className="text-gold">{l.observacoes.join(" · ")}</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
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
              {importando ? "Importando…" : `Importar ${selecionadas.size} linha(s)`}
            </button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------ PDF com assinatura */}
      <Modal
        aberto={modalAssinatura}
        titulo="PDF com assinatura"
        descricao="O nome completo sai sublinhado, com o nome de guerra em negrito, e a função logo abaixo."
        aoFechar={() => setModalAssinatura(false)}
        largura="max-w-3xl"
      >
        <div className="space-y-5">
          <Aviso tipo="erro" mensagem={erroAssinatura} />

          <SeletorMilitarFiltrado
            id="signatario"
            rotulo="Quem assina"
            valor={assinaturaForm.signatarioId}
            militares={militares}
            aoAlterar={(v) => setAssinaturaForm((f) => ({ ...f, signatarioId: v }))}
          />

          <div>
            <label className="rotulo" htmlFor="funcaoAssinatura">O que o militar é</label>
            <input
              id="funcaoAssinatura"
              className="campo"
              value={assinaturaForm.funcao}
              onChange={(e) => setAssinaturaForm((f) => ({ ...f, funcao: e.target.value }))}
              placeholder="Ex.: Chefe da turma de apoio"
              maxLength={160}
            />
            <p className="mt-1 text-[12px] text-zinc-500">Sai centralizado, logo abaixo do nome.</p>
          </div>

          {/* Prévia de como o bloco sairá no documento */}
          {assinaturaForm.signatarioId && (
            <div className="rounded-lg border border-line bg-graphite-900/50 px-4 py-6 text-center">
              <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                Como sairá no PDF
              </p>
              {(() => {
                const m = militares.find((x) => x.id === assinaturaForm.signatarioId);
                if (!m) return null;
                return (
                  <>
                    <p className="inline-block border-b border-zinc-400 pb-0.5 text-sm text-zinc-100">
                      {partesDaAssinatura(m.nomeCompleto, m.nomeGuerra, m.posto).map((parte, i) => (
                        <span key={i} className={parte.negrito ? "font-bold" : ""}>
                          {parte.texto}
                        </span>
                      ))}
                    </p>
                    <p className="mt-1.5 text-[13px] text-zinc-400">
                      {assinaturaForm.funcao || "—"}
                    </p>
                    <p className="mt-3 text-[11px] text-zinc-600">
                      No PDF para assinar em papel, o traço fica acima do nome, servindo de linha
                      para a assinatura.
                    </p>
                  </>
                );
              })()}
            </div>
          )}

          <div>
            <label className="rotulo" htmlFor="obsAssinatura">Recado para quem vai assinar</label>
            <input
              id="obsAssinatura"
              className="campo"
              value={assinaturaForm.observacao}
              onChange={(e) => setAssinaturaForm((f) => ({ ...f, observacao: e.target.value }))}
              placeholder="Opcional. Só aparece na tela do militar, não sai no documento."
              maxLength={400}
            />
          </div>

          <div className="rounded-md border border-line bg-graphite-700/40 px-4 py-3 text-[13px] text-zinc-400">
            Serão enviadas as <span className="text-zinc-200">{visiveis.length} linha(s)</span> que
            estão na tela ({recorteAtual()}). O conteúdo é congelado no envio: mexer no plano depois
            não altera o que foi assinado.
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button onClick={() => setModalAssinatura(false)} className="botao-secundario">
              Cancelar
            </button>
            <button
              onClick={exportarComAssinatura}
              disabled={enviandoAssinatura}
              className="botao-secundario"
            >
              <FileDown size={15} /> Exportar para assinar em papel
            </button>
            <button
              onClick={enviarParaAssinatura}
              disabled={enviandoAssinatura || !assinaturaForm.signatarioId || !assinaturaForm.funcao.trim()}
              className="botao-primario"
            >
              <PenLine size={15} />
              {enviandoAssinatura ? "Enviando…" : "Enviar para assinatura digital"}
            </button>
          </div>
        </div>
      </Modal>

      {/* --------------------------------------------- Cabecalho do documento */}
      <Modal
        aberto={modalCabecalho}
        titulo="Cabeçalho do documento"
        descricao="Estas linhas aparecem no topo do plano e na exportação."
        aoFechar={() => setModalCabecalho(false)}
      >
        <form onSubmit={salvarCabecalho} className="space-y-4">
          {(["linha1", "linha2", "linha3", "linha4", "anexo"] as const).map((campo, i) => (
            <div key={campo}>
              <label className="rotulo" htmlFor={campo}>
                {campo === "anexo" ? "Identificação do anexo" : `Linha ${i + 1}`}
              </label>
              <input
                id={campo}
                className="campo"
                value={rascunhoCabecalho[campo]}
                onChange={(e) => setRascunhoCabecalho((c) => ({ ...c, [campo]: e.target.value }))}
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setModalCabecalho(false)} className="botao-secundario">Cancelar</button>
            <button type="submit" className="botao-primario">Salvar cabeçalho</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
