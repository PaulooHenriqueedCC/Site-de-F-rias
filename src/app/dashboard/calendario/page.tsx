"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { corDoMilitar } from "@/lib/cores";
import { rotuloPosto } from "@/lib/postos";
import { chaveDia, DIAS_SEMANA, formatarBR, MESES, paraData } from "@/lib/datas";

interface RegistroFerias {
  id: string;
  inicio: string;
  termino: string;
  qtdDias: number;
  militar: { id: string; nomeCompleto: string; nomeGuerra: string; posto: string; secao: string };
  substituto: { id: string; nomeGuerra: string; posto: string } | null;
}

interface Marcacao {
  ferias: RegistroFerias;
  cor: string;
  primeiroDia: boolean;
  ultimoDia: boolean;
}

export default function PaginaCalendario() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [registros, setRegistros] = useState<RegistroFerias[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ferias")
      .then((r) => r.json())
      .then((d) => setRegistros(d.ferias ?? []))
      .finally(() => setCarregando(false));
  }, []);

  /** Mapa dia -> marcacoes, montado uma vez por ano exibido. */
  const mapa = useMemo(() => {
    const resultado = new Map<string, Marcacao[]>();

    for (const f of registros) {
      const inicio = paraData(f.inicio);
      const termino = paraData(f.termino);
      if (!inicio || !termino) continue;

      const cor = corDoMilitar(f.militar.id);
      const cursor = new Date(inicio);
      while (cursor <= termino) {
        if (cursor.getFullYear() === ano) {
          const chave = chaveDia(cursor);
          const lista = resultado.get(chave) ?? [];
          lista.push({
            ferias: f,
            cor,
            primeiroDia: chave === chaveDia(inicio),
            ultimoDia: chave === chaveDia(termino),
          });
          resultado.set(chave, lista);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return resultado;
  }, [registros, ano]);

  const hoje = chaveDia(new Date());
  const marcacoesDoDia = diaSelecionado ? mapa.get(diaSelecionado) ?? [] : [];

  const noAno = registros.filter((f) => {
    const i = paraData(f.inicio);
    const t = paraData(f.termino);
    return i && t && (i.getFullYear() === ano || t.getFullYear() === ano);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Calendário</p>
          <h1 className="titulo-secao">Férias em {ano}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {noAno.length} {noAno.length === 1 ? "período no ano" : "períodos no ano"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setAno((a) => a - 1)} className="botao-secundario px-3" aria-label="Ano anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[84px] text-center font-mono text-xl text-gold">{ano}</span>
          <button onClick={() => setAno((a) => a + 1)} className="botao-secundario px-3" aria-label="Próximo ano">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setAno(new Date().getFullYear())} className="botao-secundario ml-1">
            Ano atual
          </button>
        </div>
      </div>

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando calendário…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {MESES.map((nomeMes, indiceMes) => (
              <MesDoAno
                key={nomeMes}
                ano={ano}
                indiceMes={indiceMes}
                nomeMes={nomeMes}
                mapa={mapa}
                hoje={hoje}
                aoClicarDia={setDiaSelecionado}
              />
            ))}
          </div>

          {noAno.length > 0 && (
            <div className="cartao">
              <p className="eyebrow mb-3">Legenda</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {Array.from(new Map(noAno.map((f) => [f.militar.id, f])).values()).map((f) => (
                  <span key={f.militar.id} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-sm" style={{ background: corDoMilitar(f.militar.id) }} />
                    <span className="text-zinc-500">{rotuloPosto(f.militar.posto)}</span>
                    <span className="font-semibold text-zinc-100">{f.militar.nomeGuerra}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        aberto={Boolean(diaSelecionado)}
        titulo={diaSelecionado ? formatarBR(diaSelecionado) : ""}
        descricao={
          marcacoesDoDia.length
            ? `${marcacoesDoDia.length} militar(es) de férias nesta data`
            : "Nenhum militar de férias nesta data"
        }
        aoFechar={() => setDiaSelecionado(null)}
      >
        {marcacoesDoDia.length ? (
          <ul className="space-y-3">
            {marcacoesDoDia.map(({ ferias, cor, primeiroDia, ultimoDia }) => (
              <li key={ferias.id} className="flex gap-3 rounded-md border border-line bg-graphite-700/50 p-4">
                <span className="mt-1 h-full w-1 shrink-0 rounded-full" style={{ background: cor, minHeight: 44 }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="text-zinc-500">{rotuloPosto(ferias.militar.posto)} </span>
                    <span className="font-semibold text-zinc-100">{ferias.militar.nomeGuerra}</span>
                    <span className="ml-2 text-zinc-500">{ferias.militar.nomeCompleto}</span>
                  </p>
                  <p className="mt-1 font-mono text-[13px] text-zinc-400">
                    {formatarBR(ferias.inicio)} → {formatarBR(ferias.termino)} · {ferias.qtdDias} dias
                  </p>
                  <p className="mt-1 text-[13px] text-zinc-500">
                    Seção {ferias.militar.secao}
                    {ferias.substituto && (
                      <>
                        {" · substituto "}
                        <span className="text-zinc-400">{rotuloPosto(ferias.substituto.posto)} </span>
                        <span className="font-semibold text-zinc-300">{ferias.substituto.nomeGuerra}</span>
                      </>
                    )}
                  </p>
                  {(primeiroDia || ultimoDia) && (
                    <p className="mt-2 inline-block rounded bg-gold/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">
                      {primeiroDia ? "Início das férias" : "Último dia"}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <CalendarDays size={16} /> Dia livre no quadro da unidade.
          </p>
        )}
      </Modal>
    </div>
  );
}

function MesDoAno({
  ano,
  indiceMes,
  nomeMes,
  mapa,
  hoje,
  aoClicarDia,
}: {
  ano: number;
  indiceMes: number;
  nomeMes: string;
  mapa: Map<string, Marcacao[]>;
  hoje: string;
  aoClicarDia: (dia: string) => void;
}) {
  const primeiro = new Date(ano, indiceMes, 1);
  const totalDias = new Date(ano, indiceMes + 1, 0).getDate();
  const vazios = primeiro.getDay();

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: indiceMes * 0.025 }}
      className="cartao p-4"
    >
      <h2 className="mb-3 font-display text-sm uppercase tracking-[0.16em] text-gold">{nomeMes}</h2>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="pb-1 text-[10px] font-medium uppercase text-zinc-600">{d}</span>
        ))}

        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}

        {Array.from({ length: totalDias }, (_, i) => {
          const dia = i + 1;
          const chave = `${ano}-${String(indiceMes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          const marcacoes = mapa.get(chave) ?? [];
          const ocupado = marcacoes.length > 0;
          const ehHoje = chave === hoje;

          return (
            <button
              key={dia}
              onClick={() => aoClicarDia(chave)}
              title={
                ocupado
                  ? marcacoes.map((m) => m.ferias.militar.nomeGuerra).join(", ")
                  : "Sem férias registradas"
              }
              className={`relative aspect-square rounded text-[11px] transition-colors ${
                ehHoje ? "ring-1 ring-gold" : ""
              } ${ocupado ? "font-semibold text-white" : "text-zinc-500 hover:bg-graphite-700"}`}
              style={
                ocupado
                  ? {
                      background:
                        marcacoes.length === 1
                          ? marcacoes[0].cor
                          : `linear-gradient(135deg, ${marcacoes[0].cor} 50%, ${marcacoes[1].cor} 50%)`,
                    }
                  : undefined
              }
            >
              {dia}
              {marcacoes.length > 2 && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-graphite-900 px-1 text-[8px] text-gold">
                  +{marcacoes.length - 2}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}
