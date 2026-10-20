"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { MilitarResumo } from "@/components/dashboard/SeletorMilitar";
import { ordemPosto, rotuloPosto } from "@/lib/postos";

const normalizar = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Seletor de militar com filtros de pesquisa: nome (completo ou de guerra),
 * posto/graduacao e secao. Usado em "Lancar periodo" nas abas de dispensa
 * como recompensa e de desconto em ferias.
 */
export default function SeletorMilitarFiltrado({
  id,
  rotulo,
  valor,
  militares,
  aoAlterar,
  opcional = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  militares: MilitarResumo[];
  aoAlterar: (v: string) => void;
  opcional?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [filtroPosto, setFiltroPosto] = useState("TODOS");
  const [filtroSecao, setFiltroSecao] = useState("TODAS");

  // Postos e secoes que realmente existem na lista recebida.
  const postos = useMemo(
    () =>
      Array.from(new Set(militares.map((m) => m.posto))).sort(
        (a, b) => ordemPosto(a) - ordemPosto(b)
      ),
    [militares]
  );

  const secoes = useMemo(
    () => Array.from(new Set(militares.map((m) => m.secao))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [militares]
  );

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    return militares.filter((m) => {
      if (filtroPosto !== "TODOS" && m.posto !== filtroPosto) return false;
      if (filtroSecao !== "TODAS" && m.secao !== filtroSecao) return false;
      if (!termo) return true;
      return (
        normalizar(m.nomeCompleto).includes(termo) ||
        normalizar(m.nomeGuerra).includes(termo) ||
        normalizar(rotuloPosto(m.posto)).includes(termo) ||
        normalizar(m.secao).includes(termo)
      );
    });
  }, [militares, busca, filtroPosto, filtroSecao]);

  // Se o militar escolhido sair do filtro, a selecao e limpa para evitar engano.
  useEffect(() => {
    if (valor && !filtrados.some((m) => m.id === valor)) aoAlterar("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados]);

  const semResultado = !filtrados.length && militares.length > 0;

  return (
    <div className="space-y-3 rounded-md border border-line bg-graphite-800/40 p-3">
      <div>
        <label className="rotulo" htmlFor={id}>{rotulo}</label>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="relative sm:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              className="campo pl-9"
              placeholder="Pesquisar por nome, graduação, posto ou seção"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Pesquisar militar"
            />
          </div>

          <select
            className="campo"
            value={filtroPosto}
            onChange={(e) => setFiltroPosto(e.target.value)}
            aria-label="Filtrar por posto ou graduação"
          >
            <option value="TODOS">Posto/Graduação: todos</option>
            {postos.map((p) => (
              <option key={p} value={p}>{rotuloPosto(p)}</option>
            ))}
          </select>

          <select
            className="campo"
            value={filtroSecao}
            onChange={(e) => setFiltroSecao(e.target.value)}
            aria-label="Filtrar por seção"
          >
            <option value="TODAS">Seção: todas</option>
            {secoes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <select
        id={id}
        className="campo"
        value={valor}
        onChange={(e) => aoAlterar(e.target.value)}
        required={!opcional}
        size={filtrados.length > 6 ? 6 : undefined}
      >
        <option value="">{opcional ? "Sem militar" : "Selecione o militar…"}</option>
        {filtrados.map((m) => (
          <option key={m.id} value={m.id}>
            {rotuloPosto(m.posto)} {m.nomeGuerra} — {m.nomeCompleto} · {m.secao}
          </option>
        ))}
      </select>

      <p className="text-[12px] text-zinc-500">
        {semResultado ? (
          <span className="text-gold">Nenhum militar corresponde aos filtros.</span>
        ) : (
          <>
            {filtrados.length} de {militares.length} militares
          </>
        )}
      </p>
    </div>
  );
}
