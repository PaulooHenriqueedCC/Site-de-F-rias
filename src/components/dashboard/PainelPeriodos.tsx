"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, MessageSquare, Pencil, Plus, Search, Trash2, type LucideIcon } from "lucide-react";
import { useUsuario } from "@/components/dashboard/ContextoUsuario";
import { type MilitarResumo } from "@/components/dashboard/SeletorMilitar";
import SeletorMilitarFiltrado from "@/components/dashboard/SeletorMilitarFiltrado";
import Modal from "@/components/ui/Modal";
import Aviso from "@/components/ui/Aviso";
import EstadoVazio from "@/components/ui/EstadoVazio";
import { podeEditar, type ChavePermissao } from "@/lib/permissoes";
import { rotuloPosto } from "@/lib/postos";
import { contarDias, formatarBR, paraInput } from "@/lib/datas";
import { rotuloParcela, categoriaPlano } from "@/lib/plano-modelo";

interface Registro {
  id: string;
  inicio: string;
  termino: string;
  dias: number;
  motivo: string | null;
  comentario: string | null;
  militar: MilitarResumo;
}

interface Agrupado {
  militar: MilitarResumo;
  total: number;
  periodos: Registro[];
}

/** Linha do plano de ferias afetada pelos descontos lancados. */
interface LinhaPlano {
  id: string;
  categoria: string;
  secao: string;
  ano: number;
  militarId: string | null;
  nomeCompleto: string;
  parcela: number;
  dias: number;
  mesAno: string;
  descontoAplicado: number;
  diasEfetivos: number;
}

const formularioVazio = {
  id: "",
  militarId: "",
  inicio: "",
  termino: "",
  dias: 1,
  motivo: "",
  comentario: "",
};

/**
 * Painel usado tanto por "Dispensa como recompensa" quanto por "Desconto em férias":
 * agrupa os periodos por militar e soma os dias gozados.
 */
export default function PainelPeriodos({
  rota,
  permissao,
  eyebrow,
  titulo,
  descricao,
  rotuloDias,
  rotuloMotivo,
  placeholderMotivo,
  Icone,
  ligacaoPlano = false,
}: {
  rota: "dispensas" | "descontos";
  permissao: ChavePermissao;
  eyebrow: string;
  titulo: string;
  descricao: string;
  rotuloDias: string;
  rotuloMotivo: string;
  placeholderMotivo: string;
  Icone: LucideIcon;
  /** Quando ligado, mostra o reflexo automatico dos dias no plano de ferias. */
  ligacaoPlano?: boolean;
}) {
  const usuario = useUsuario();
  const podeLancar = podeEditar(usuario, permissao);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [militares, setMilitares] = useState<MilitarResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [formulario, setFormulario] = useState(formularioVazio);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [planos, setPlanos] = useState<LinhaPlano[]>([]);

  async function carregar() {
    setCarregando(true);
    const [r, m] = await Promise.all([fetch(`/api/${rota}`), fetch("/api/militares")]);
    setRegistros((await r.json()).registros ?? []);
    setMilitares((await m.json()).militares ?? []);

    // Reflexo dos dias lancados sobre as linhas do plano de ferias.
    if (ligacaoPlano) {
      const p = await fetch("/api/plano-ferias");
      setPlanos(p.ok ? ((await p.json()).linhas ?? []) : []);
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota]);

  const agrupados: Agrupado[] = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const mapa = new Map<string, Agrupado>();

    for (const r of registros) {
      if (
        termo &&
        !r.militar.nomeCompleto.toLowerCase().includes(termo) &&
        !r.militar.nomeGuerra.toLowerCase().includes(termo)
      ) {
        continue;
      }
      const atual = mapa.get(r.militar.id) ?? { militar: r.militar, total: 0, periodos: [] };
      atual.total += r.dias;
      atual.periodos.push(r);
      mapa.set(r.militar.id, atual);
    }

    return Array.from(mapa.values());
  }, [registros, busca]);

  const totalGeral = agrupados.reduce((soma, g) => soma + g.total, 0);

  function abrirNovo(militarId = "") {
    setFormulario({ ...formularioVazio, militarId });
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(r: Registro) {
    setFormulario({
      id: r.id,
      militarId: r.militar.id,
      inicio: paraInput(r.inicio),
      termino: paraInput(r.termino),
      dias: r.dias,
      motivo: r.motivo ?? "",
      comentario: r.comentario ?? "",
    });
    setErro(null);
    setModalAberto(true);
  }

  const definir = (campo: keyof typeof formulario, valor: unknown) =>
    setFormulario((f) => {
      const proximo = { ...f, [campo]: valor };
      if ((campo === "inicio" || campo === "termino") && proximo.inicio && proximo.termino) {
        proximo.dias = contarDias(proximo.inicio, proximo.termino);
      }
      return proximo;
    });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const url = formulario.id ? `/api/${rota}/${formulario.id}` : `/api/${rota}`;
      const resposta = await fetch(url, {
        method: formulario.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formulario),
      });
      const retorno = await resposta.json();
      if (!resposta.ok) {
        setErro(retorno.erro ?? "Não foi possível salvar o período.");
        return;
      }
      setModalAberto(false);
      // Inclusoes feitas por Administrador aguardam o aval do Administrador Geral.
      setAviso(retorno.pendente ? retorno.aviso : null);
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este período?")) return;
    await fetch(`/api/${rota}/${id}`, { method: "DELETE" });
    await carregar();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="titulo-secao">{titulo}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {descricao} · {totalGeral} {totalGeral === 1 ? "dia" : "dias"} no total
          </p>
        </div>

        {podeLancar && (
          <button onClick={() => abrirNovo()} className="botao-primario">
            <Plus size={15} /> Lançar período
          </button>
        )}
      </div>

      <Aviso tipo="info" mensagem={aviso} />

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input
          className="campo pl-9"
          placeholder="Buscar militar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {carregando ? (
        <p className="py-16 text-center text-sm text-zinc-500">Carregando períodos…</p>
      ) : !agrupados.length ? (
        <EstadoVazio
          Icone={Icone}
          titulo="Nenhum período lançado"
          descricao="Cada lançamento entra na contagem do militar e aparece no resumo da unidade."
          acao={podeLancar && <button onClick={() => abrirNovo()} className="botao-primario"><Plus size={15} /> Lançar período</button>}
        />
      ) : (
        <div className="space-y-3">
          {agrupados.map((g) => (
            <article key={g.militar.id} className="cartao">
              <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                <div>
                  <p className="text-[15px]">
                    <span className="text-zinc-500">{rotuloPosto(g.militar.posto)} </span>
                    <span className="font-semibold text-zinc-100">{g.militar.nomeGuerra}</span>
                  </p>
                  <p className="text-sm text-zinc-500">{g.militar.nomeCompleto} · {g.militar.secao}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono text-2xl leading-none text-gold">{g.total}</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{rotuloDias}</p>
                  </div>
                  {podeLancar && (
                    <button onClick={() => abrirNovo(g.militar.id)} className="botao-secundario px-3" title="Adicionar período">
                      <Plus size={15} />
                    </button>
                  )}
                </div>
              </header>

              <ul className="space-y-2">
                {g.periodos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-graphite-700/40 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-zinc-300">
                        {formatarBR(p.inicio)} → {formatarBR(p.termino)}
                        <span className="ml-2 text-gold">{p.dias}d</span>
                      </p>
                      {p.motivo && <p className="mt-0.5 text-sm text-zinc-400">{p.motivo}</p>}
                      {p.comentario && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-zinc-500">
                          <MessageSquare size={13} className="mt-0.5 shrink-0" />
                          {p.comentario}
                        </p>
                      )}
                    </div>

                    {podeLancar && (
                      <div className="flex gap-1">
                        <button onClick={() => abrirEdicao(p)} className="rounded p-1.5 text-zinc-500 hover:text-gold" aria-label="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => excluir(p.id)} className="rounded p-1.5 text-zinc-500 hover:text-red-400" aria-label="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {ligacaoPlano && <ReflexoNoPlano linhas={planos.filter((l) => l.militarId === g.militar.id)} />}
            </article>
          ))}
        </div>
      )}

      <Modal
        aberto={modalAberto}
        titulo={formulario.id ? "Editar período" : "Lançar período"}
        descricao="A quantidade de dias é calculada pelas datas e pode ser ajustada."
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="inicio">Início</label>
              <input id="inicio" type="date" className="campo" value={formulario.inicio} onChange={(e) => definir("inicio", e.target.value)} required />
            </div>
            <div>
              <label className="rotulo" htmlFor="termino">Término</label>
              <input id="termino" type="date" className="campo" value={formulario.termino} onChange={(e) => definir("termino", e.target.value)} required />
            </div>
            <div>
              <label className="rotulo" htmlFor="dias">Dias</label>
              <input id="dias" type="number" min={1} max={90} className="campo font-mono" value={formulario.dias} onChange={(e) => definir("dias", Number(e.target.value))} required />
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="motivo">{rotuloMotivo}</label>
            <input id="motivo" className="campo" value={formulario.motivo} onChange={(e) => definir("motivo", e.target.value)} placeholder={placeholderMotivo} />
          </div>

          <div>
            <label className="rotulo" htmlFor="comentario">Comentário</label>
            <textarea id="comentario" className="campo min-h-[90px]" value={formulario.comentario} onChange={(e) => definir("comentario", e.target.value)} placeholder="Anotação livre sobre este período" />
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setModalAberto(false)} className="botao-secundario">Cancelar</button>
            <button type="submit" disabled={salvando} className="botao-primario">
              {salvando ? "Salvando…" : "Salvar período"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/**
 * Mostra, dentro do cartao do militar, como os dias lancados em "Desconto em
 * ferias" ja foram abatidos das linhas do plano de ferias. O abatimento e
 * automatico: os dias sao consumidos pelas parcelas do mesmo ano, na ordem
 * cronologica, e o resultado aparece na coluna "Dias" do plano.
 */
function ReflexoNoPlano({ linhas }: { linhas: LinhaPlano[] }) {
  const afetadas = linhas.filter((l) => l.descontoAplicado > 0);

  return (
    <div className="mt-4 rounded-md border border-dashed border-line bg-graphite-900/40 px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 font-display text-[11px] uppercase tracking-[0.14em] text-gold">
        <Link2 size={13} /> Reflexo no plano de férias
      </p>

      {!linhas.length ? (
        <p className="text-[13px] text-zinc-500">
          Este militar ainda não tem linha no plano de férias. Assim que ela for criada, os dias
          lançados aqui serão abatidos automaticamente.
        </p>
      ) : !afetadas.length ? (
        <p className="text-[13px] text-zinc-500">
          Nenhum abatimento aplicado — os descontos precisam ser do mesmo ano das linhas do plano.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {afetadas.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="text-zinc-400">
                {l.ano} · {l.secao} · {rotuloParcela(l.parcela, categoriaPlano(l.categoria).ordinal)}
                {l.mesAno && <span className="ml-2 font-mono text-zinc-500">{l.mesAno}</span>}
              </span>
              <span className="font-mono text-zinc-500">
                <span className="line-through">{l.dias}d</span>
                <span className="mx-1.5 text-red-300">−{l.descontoAplicado}</span>
                <span className="text-gold">= {l.diasEfetivos}d</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
