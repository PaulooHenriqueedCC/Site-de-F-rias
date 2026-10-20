"use client";

import { Scissors } from "lucide-react";
import PainelPeriodos from "@/components/dashboard/PainelPeriodos";

export default function PaginaDesconto() {
  return (
    <PainelPeriodos
      rota="descontos"
      permissao="desconto"
      eyebrow="Desconto em férias"
      titulo="Dias de desconto gozados"
      descricao="Contagem por militar · abatida automaticamente no plano de férias"
      rotuloDias="dias descontados"
      rotuloMotivo="Motivo do desconto"
      placeholderMotivo="Ex.: antecipação de dias no 1º período"
      Icone={Scissors}
      ligacaoPlano
    />
  );
}
