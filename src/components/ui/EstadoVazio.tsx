import type { LucideIcon } from "lucide-react";

export default function EstadoVazio({
  Icone,
  titulo,
  descricao,
  acao,
}: {
  Icone: LucideIcon;
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-16 text-center">
      <Icone size={30} className="mb-4 text-zinc-600" />
      <p className="font-display text-lg uppercase tracking-[0.1em] text-zinc-300">{titulo}</p>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">{descricao}</p>
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  );
}
