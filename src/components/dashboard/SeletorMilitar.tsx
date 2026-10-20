"use client";

import { rotuloPosto } from "@/lib/postos";

export interface MilitarResumo {
  id: string;
  nomeCompleto: string;
  nomeGuerra: string;
  posto: string;
  secao: string;
}

export default function SeletorMilitar({
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
  return (
    <div>
      <label className="rotulo" htmlFor={id}>{rotulo}</label>
      <select id={id} className="campo" value={valor} onChange={(e) => aoAlterar(e.target.value)} required={!opcional}>
        <option value="">{opcional ? "Sem substituto" : "Selecione o militar…"}</option>
        {militares.map((m) => (
          <option key={m.id} value={m.id}>
            {rotuloPosto(m.posto)} {m.nomeGuerra} — {m.nomeCompleto}
          </option>
        ))}
      </select>
    </div>
  );
}
