"use client";

import { ClipboardList } from "lucide-react";
import PainelPeriodos from "@/components/dashboard/PainelPeriodos";

export default function PaginaDispensa() {
  return (
    <PainelPeriodos
      rota="dispensas"
      permissao="dispensa"
      eyebrow="Dispensa como recompensa"
      titulo="Dias de dispensa gozados"
      descricao="Contagem por militar"
      rotuloDias="dias gozados"
      rotuloMotivo="Motivo da recompensa"
      placeholderMotivo="Ex.: Boletim Interno nº 120 — destaque em instrução"
      Icone={ClipboardList}
    />
  );
}
