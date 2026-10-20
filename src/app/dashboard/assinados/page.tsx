"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, FileSignature, Search } from "lucide-react";
import Aviso from "@/components/ui/Aviso";
import EstadoVazio from "@/components/ui/EstadoVazio";
import { gerarPdfPlano } from "@/lib/pdf-plano";
import { formatarBR } from "@/lib/datas";
import { rotuloPosto } from "@/lib/postos";
import { ROTULOS_STATUS_ASSINATURA } from "@/lib/assinaturas";
import type { CabecalhoModelo, LinhaModelo } from "@/lib/plano-modelo";

interface Documento {
  id: string;
  titulo: string;
  funcao: string;
  status: string;
  recorte: string | null;
  observacao: string | null;
  motivoRecusa: string | null;
  codigo: string;
  criadoEm: string;
  assinadoEm: string | null;
  linhas?: LinhaModelo[];
  cabecalho?: CabecalhoModelo;
  signatario: { id: string; nomeCompleto: string; nomeGuerra: string; posto: string; secao: string };
  solicitante: { id: string; nomeGuerra: string; posto: string };
}

const CORES: Record<string, string> = {
  PENDENTE: "border-gold/60 bg-gold/10 text-gold",
  ASSINADO: "border-oliva/70 bg-oliva/15 text-emerald-200",
  RECUSADO: "border-rubro/60 bg-rubro/10 text-red-200",
};

const normalizar = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Aba "Assinados".
 *
 * Sempre visivel ao administrador e permanente: guarda todo documento enviado
 * para assinatura, assinado ou recusado, com quem pediu, quem assinou e quando.
 * O PDF e montado a partir do conteudo congelado no envio, entao exportar hoje
 * ou daqui a um ano devolve exatamente o mesmo documento.
 */
export default function PaginaAssinados() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const resposta = await fetch("/api/assinaturas?escopo=historico&completo=1");
      if (!resposta.ok) {
        setErro("Não foi possível carregar o histórico.");
        setCarregando(false);
        return;
      }
      setDocumentos((await resposta.json()).documentos ?? []);
      setCarregando(false);
    })();
  }, []);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return documentos.filter((d) => {
      if (filtroStatus !== "TODOS" && d.status !== filtroStatus) return false;
      if (!termo) return true;
      return (
        normalizar(d.titulo).includes(termo) ||
        normalizar(d.funcao).includes(termo) ||
        normalizar(d.signatario.nomeCompleto).includes(termo) ||
        normalizar(d.signatario.nomeGuerra).includes(termo) ||
        normalizar(d.codigo).includes(termo)
      );
    });
  }, [documentos, busca, filtroStatus]);

  /** Exporta o documento tal como foi assinado. */
  async function exportar(d: Documento) {
    if (!d.linhas?.length) return;
    setGerando(d.id);
    try {
      await gerarPdfPlano(d.linhas, d.cabecalho, {
        nomeArquivo: `plano-assinado-${d.codigo}.pdf`,
        assinatura: {
          nomeCompleto: d.signatario.nomeCompleto,
          nomeGuerra: d.signatario.nomeGuerra,
          posto: d.signatario.posto,
          funcao: d.funcao,
          // Só carimba o que foi de fato assinado.
          assinadoEm: d.status === "ASSINADO" ? d.assinadoEm : null,
          codigo: d.status === "ASSINADO" ? d.codigo : null,
        },
      });
    } finally {
      setGerando(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Assinatura digital</p>
        <h1 className="titulo-secao">Assinados</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Histórico de todos os documentos enviados para assinatura. O PDF sai igual ao que foi
          assinado, mesmo que o plano tenha mudado depois.
        </p>
      </div>

      <Aviso tipo="erro" mensagem={erro} />

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            className="campo pl-9"
            placeholder="Buscar por documento, militar, função ou código"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select
          className="campo max-w-[220px]"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          aria-label="Filtrar por situação"
        >
          <option value="TODOS">Todas as situações</option>
          <option value="ASSINADO">Assinados</option>
          <option value="PENDENTE">Aguardando assinatura</option>
          <option value="RECUSADO">Recusados</option>
        </select>
      </div>

      {carregando ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : !visiveis.length ? (
        <EstadoVazio
          Icone={FileSignature}
          titulo="Nenhum documento"
          descricao="Envie o plano de férias para a assinatura de um militar pela aba Plano de férias."
        />
      ) : (
        <div className="space-y-3">
          {visiveis.map((d) => (
            <div key={d.id} className="cartao">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="font-display text-lg text-zinc-100">{d.titulo}</p>
                    <span
                      className={`rounded border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                        CORES[d.status] ?? "border-line text-zinc-400"
                      }`}
                    >
                      {ROTULOS_STATUS_ASSINATURA[d.status] ?? d.status}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm text-zinc-300">
                    <span className="text-zinc-500">{rotuloPosto(d.signatario.posto)} </span>
                    <span className="font-semibold text-zinc-100">{d.signatario.nomeGuerra}</span>
                    <span className="text-zinc-500"> · {d.funcao}</span>
                  </p>

                  <p className="mt-2 text-[13px] text-zinc-500">
                    Enviado por {rotuloPosto(d.solicitante.posto)} {d.solicitante.nomeGuerra} em{" "}
                    {formatarBR(d.criadoEm)}
                    {d.status === "ASSINADO" && d.assinadoEm
                      ? ` · assinado em ${formatarBR(d.assinadoEm)}`
                      : ""}
                    {d.recorte ? ` · ${d.recorte}` : ""}
                    {d.linhas ? ` · ${d.linhas.length} linha(s)` : ""}
                  </p>

                  {d.motivoRecusa && (
                    <p className="mt-2 rounded border border-rubro/50 bg-rubro/10 px-3 py-2 text-[13px] text-red-200">
                      Motivo da recusa: {d.motivoRecusa}
                    </p>
                  )}

                  <p className="mt-2 font-mono text-[11px] text-zinc-600">Código {d.codigo}</p>
                </div>

                <button
                  onClick={() => exportar(d)}
                  disabled={gerando === d.id}
                  className={d.status === "ASSINADO" ? "botao-primario" : "botao-secundario"}
                >
                  <FileDown size={15} />
                  {gerando === d.id
                    ? "Gerando…"
                    : d.status === "ASSINADO"
                      ? "Exportar PDF"
                      : "Ver em PDF"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
