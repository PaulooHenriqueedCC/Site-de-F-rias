"use client";

import { POSTOS, QUADROS, quadrosDisponiveis } from "@/lib/postos";
import { mascararIdentidade, mascararTelefone } from "@/lib/validacao";

export interface DadosIdentificacao {
  nomeCompleto: string;
  identidade: string;
  nomeGuerra: string;
  ramal: string;
  secao: string;
  telefone: string;
  posto: string;
  quadro: string;
}

export const identificacaoVazia: DadosIdentificacao = {
  nomeCompleto: "",
  identidade: "",
  nomeGuerra: "",
  ramal: "",
  secao: "",
  telefone: "",
  posto: "",
  quadro: "NENHUM",
};

/**
 * Bloco reutilizado no cadastro de usuario, de administrador e no perfil.
 * O filtro de quadro se ajusta sozinho ao posto escolhido.
 */
export default function CamposIdentificacao({
  dados,
  aoAlterar,
  travarIdentidade = false,
}: {
  dados: DadosIdentificacao;
  aoAlterar: (dados: DadosIdentificacao) => void;
  travarIdentidade?: boolean;
}) {
  const definir = (campo: keyof DadosIdentificacao, valor: string) => {
    const proximo = { ...dados, [campo]: valor };
    if (campo === "posto" && !quadrosDisponiveis(valor).includes(proximo.quadro as never)) {
      proximo.quadro = "NENHUM";
    }
    aoAlterar(proximo);
  };

  const quadros = quadrosDisponiveis(dados.posto);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="nomeCompleto">Nome completo</label>
        <input
          id="nomeCompleto"
          className="campo"
          value={dados.nomeCompleto}
          onChange={(e) => definir("nomeCompleto", e.target.value.toUpperCase())}
          placeholder="JOÃO DA SILVA SANTOS"
          required
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="identidade">Identidade militar</label>
        <input
          id="identidade"
          className="campo-mono"
          value={dados.identidade}
          onChange={(e) => definir("identidade", mascararIdentidade(e.target.value))}
          placeholder="111.222.333-4"
          inputMode="numeric"
          maxLength={14}
          disabled={travarIdentidade}
          required
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="nomeGuerra">Nome de guerra</label>
        <input
          id="nomeGuerra"
          className="campo font-semibold"
          value={dados.nomeGuerra}
          onChange={(e) => definir("nomeGuerra", e.target.value.toUpperCase())}
          placeholder="SILVA"
          required
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="posto">Posto ou graduação</label>
        <select id="posto" className="campo" value={dados.posto} onChange={(e) => definir("posto", e.target.value)} required>
          <option value="">Selecione…</option>
          {POSTOS.filter((p) => p.valor !== "NAO_INFORMADO").map((p) => (
            <option key={p.valor} value={p.valor}>{p.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="rotulo">Quadro</label>
        <div className="flex h-[42px] items-center gap-4 rounded-md border border-line bg-graphite-800/80 px-3">
          {QUADROS.map(({ valor, label }) => {
            const habilitado = quadros.includes(valor);
            return (
              <label
                key={valor}
                className={`flex items-center gap-1.5 text-sm ${habilitado ? "text-zinc-200" : "cursor-not-allowed text-zinc-600"}`}
                title={habilitado ? undefined : "Não se aplica a este posto"}
              >
                <input
                  type="radio"
                  name="quadro"
                  className="accent-gold"
                  checked={dados.quadro === valor}
                  disabled={!habilitado}
                  onChange={() => definir("quadro", valor)}
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="secao">Seção</label>
        <input
          id="secao"
          className="campo"
          value={dados.secao}
          onChange={(e) => definir("secao", e.target.value.toUpperCase())}
          placeholder="1ª SEÇÃO"
          required
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="ramal">Ramal</label>
        <input
          id="ramal"
          className="campo-mono"
          value={dados.ramal}
          onChange={(e) => definir("ramal", e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="4021"
          inputMode="numeric"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="telefone">Telefone</label>
        <input
          id="telefone"
          className="campo-mono"
          value={dados.telefone}
          onChange={(e) => definir("telefone", mascararTelefone(e.target.value))}
          placeholder="(61) 99999-9999"
          inputMode="tel"
        />
      </div>
    </div>
  );
}
