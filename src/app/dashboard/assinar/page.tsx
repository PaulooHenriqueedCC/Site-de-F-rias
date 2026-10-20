"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, PenLine, ShieldCheck, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Aviso from "@/components/ui/Aviso";
import EstadoVazio from "@/components/ui/EstadoVazio";
import { gerarPdfPlano } from "@/lib/pdf-plano";
import { formatarBR } from "@/lib/datas";
import { rotuloPosto } from "@/lib/postos";
import type { CabecalhoModelo, LinhaModelo } from "@/lib/plano-modelo";

interface Documento {
  id: string;
  titulo: string;
  funcao: string;
  status: string;
  recorte: string | null;
  observacao: string | null;
  codigo: string;
  criadoEm: string;
  linhas?: LinhaModelo[];
  cabecalho?: CabecalhoModelo;
  signatario: { id: string; nomeCompleto: string; nomeGuerra: string; posto: string; secao: string };
  solicitante: { id: string; nomeGuerra: string; posto: string };
}

/**
 * Aba "Aprovar e assinar".
 *
 * So aparece no menu enquanto houver documento esperando a assinatura de quem
 * esta logado. Aqui o militar confere o que vai assinar — inclusive baixando
 * uma previa em PDF — e entao assina ou recusa.
 */
export default function PaginaAssinar() {
  const router = useRouter();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [confirmando, setConfirmando] = useState<Documento | null>(null);
  const [recusando, setRecusando] = useState<Documento | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const resposta = await fetch("/api/assinaturas?escopo=minhas&completo=1");
    const dados = await resposta.json();
    setDocumentos(dados.documentos ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  /** Prévia em PDF do que está sendo assinado, ainda sem o carimbo. */
  async function verPrevia(d: Documento) {
    if (!d.linhas?.length) return;
    setGerando(d.id);
    try {
      await gerarPdfPlano(d.linhas, d.cabecalho, {
        nomeArquivo: `previa-${d.codigo}.pdf`,
        assinatura: {
          nomeCompleto: d.signatario.nomeCompleto,
          nomeGuerra: d.signatario.nomeGuerra,
          posto: d.signatario.posto,
          funcao: d.funcao,
        },
      });
    } finally {
      setGerando(null);
    }
  }

  async function responder(d: Documento, acao: "assinar" | "recusar") {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/assinaturas/${d.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, motivoRecusa: motivo }),
      });
      const retorno = await resposta.json();

      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível concluir.");
        return;
      }

      setConfirmando(null);
      setRecusando(null);
      setMotivo("");
      setMensagem(retorno.aviso);
      await carregar();
      // O contador do menu precisa acompanhar.
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Assinatura digital</p>
        <h1 className="titulo-secao">Aprovar e assinar</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Documentos enviados para a sua assinatura. Confira antes de assinar — depois de assinado,
          o documento não muda mais.
        </p>
      </div>

      <Aviso tipo="sucesso" mensagem={mensagem} />
      <Aviso tipo="erro" mensagem={erro} />

      {carregando ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : !documentos.length ? (
        <EstadoVazio
          Icone={ShieldCheck}
          titulo="Nada aguardando sua assinatura"
          descricao="Quando um administrador enviar um documento para você assinar, ele aparece aqui."
        />
      ) : (
        <div className="space-y-3">
          {documentos.map((d) => (
            <div key={d.id} className="cartao">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg text-zinc-100">{d.titulo}</p>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    Você assinará como{" "}
                    <span className="font-semibold text-zinc-200">{d.funcao}</span>
                  </p>
                  <p className="mt-2 text-[13px] text-zinc-500">
                    Enviado por {rotuloPosto(d.solicitante.posto)} {d.solicitante.nomeGuerra} em{" "}
                    {formatarBR(d.criadoEm)}
                    {d.recorte ? ` · ${d.recorte}` : ""}
                    {d.linhas ? ` · ${d.linhas.length} linha(s)` : ""}
                  </p>
                  {d.observacao && (
                    <p className="mt-2 rounded border border-line bg-graphite-900/50 px-3 py-2 text-[13px] text-zinc-400">
                      {d.observacao}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-[11px] text-zinc-600">
                    Código {d.codigo}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={() => verPrevia(d)}
                    disabled={gerando === d.id}
                    className="botao-secundario"
                  >
                    <FileDown size={15} />
                    {gerando === d.id ? "Gerando…" : "Ver em PDF"}
                  </button>
                  <button
                    onClick={() => {
                      setRecusando(d);
                      setMotivo("");
                      setErro(null);
                    }}
                    className="botao-secundario"
                  >
                    <X size={15} /> Recusar
                  </button>
                  <button
                    onClick={() => {
                      setConfirmando(d);
                      setErro(null);
                    }}
                    className="botao-primario"
                  >
                    <PenLine size={15} /> Assinar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        aberto={Boolean(confirmando)}
        titulo="Assinar documento"
        descricao="A assinatura fica registrada com data, hora e código de conferência."
        aoFechar={() => setConfirmando(null)}
        largura="max-w-lg"
      >
        {confirmando && (
          <>
            <p className="text-sm text-zinc-300">
              Você assinará <span className="font-semibold text-zinc-100">{confirmando.titulo}</span>{" "}
              como <span className="font-semibold text-zinc-100">{confirmando.funcao}</span>.
            </p>
            <p className="mt-3 text-[13px] text-zinc-500">
              Confira o documento em PDF antes de confirmar. Depois de assinado, ele segue para o
              administrador exportar e não pode mais ser alterado.
            </p>

            <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
              <button onClick={() => setConfirmando(null)} className="botao-secundario">
                Cancelar
              </button>
              <button
                onClick={() => responder(confirmando, "assinar")}
                disabled={enviando}
                className="botao-primario"
              >
                <PenLine size={15} /> {enviando ? "Assinando…" : "Confirmar assinatura"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        aberto={Boolean(recusando)}
        titulo="Recusar documento"
        descricao="A recusa fica registrada no histórico, com o motivo."
        aoFechar={() => setRecusando(null)}
        largura="max-w-lg"
      >
        {recusando && (
          <>
            <label className="rotulo" htmlFor="motivo">Motivo</label>
            <textarea
              id="motivo"
              className="campo min-h-[90px]"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique o que precisa ser corrigido antes de assinar."
            />

            <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
              <button onClick={() => setRecusando(null)} className="botao-secundario">
                Cancelar
              </button>
              <button
                onClick={() => responder(recusando, "recusar")}
                disabled={enviando}
                className="botao-perigo"
              >
                {enviando ? "Enviando…" : "Recusar"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
