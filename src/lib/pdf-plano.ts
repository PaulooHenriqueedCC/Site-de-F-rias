/**
 * Geracao do PDF do plano de ferias no layout do ANEXO A, pronto para imprimir.
 *
 * Mesma estrutura do CSV: cabecalho institucional, blocos por categoria e, dentro
 * de cada bloco, uma tabela por secao. Sai em A4 deitado, com o cabecalho da
 * tabela repetido a cada pagina e numeracao no rodape.
 *
 * O jsPDF so roda no navegador, por isso a importacao e dinamica.
 */

import {
  CABECALHO_PADRAO,
  agruparPorModelo,
  celulasDaLinha,
  tituloGrupo,
  type CabecalhoModelo,
  type LinhaModelo,
} from "@/lib/plano-modelo";
import { BRASAO_ALTURA, BRASAO_BASE64, BRASAO_LARGURA } from "@/lib/brasao";
import { partesDaAssinatura, type DadosAssinatura } from "@/lib/assinaturas";

/**
 * Larguras fixas das 11 colunas, somando os 277 mm uteis do A4 deitado.
 * Inicio e Termino precisam de 17 mm para o dd/mm/aaaa nao quebrar em duas linhas.
 */
const LARGURAS = [12, 20, 60, 45, 46, 20, 14, 13, 13, 17, 17];

const MARGEM = 10;

/** Altura do brasao no timbre; a largura sai da proporcao original da imagem. */
const BRASAO_ALTURA_MM = 17;
const BRASAO_LARGURA_MM = (BRASAO_LARGURA / BRASAO_ALTURA) * BRASAO_ALTURA_MM;
const OURO: [number, number, number] = [143, 115, 49];
const GRAFITE: [number, number, number] = [38, 38, 38];

function dataDeHoje(): string {
  return new Date().toLocaleDateString("pt-BR");
}

export interface OpcoesPdfPlano {
  nomeArquivo?: string;
  /** Quando presente, acrescenta o bloco de assinatura ao fim do documento. */
  assinatura?: DadosAssinatura | null;
}

export async function gerarPdfPlano(
  linhas: LinhaModelo[],
  cabecalho: CabecalhoModelo = CABECALHO_PADRAO,
  opcoes: OpcoesPdfPlano = {}
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const moduloAutoTable = await import("jspdf-autotable");
  // Conforme o empacotador, o modulo chega como funcao ou dentro de `default`.
  const autoTable =
    typeof moduloAutoTable.default === "function"
      ? moduloAutoTable.default
      : (moduloAutoTable as unknown as typeof moduloAutoTable.default);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const centro = larguraPagina / 2;

  /* ------------------------------------------------ Cabecalho institucional */

  let y = MARGEM + 4;

  // Timbre: o brasao fica a esquerda, com o texto institucional centralizado.
  try {
    doc.addImage(BRASAO_BASE64, "PNG", MARGEM, MARGEM, BRASAO_LARGURA_MM, BRASAO_ALTURA_MM);
  } catch {
    /* Se a imagem falhar, o documento sai apenas com o texto do cabeçalho. */
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GRAFITE);
  for (const linha of [cabecalho.linha1, cabecalho.linha2, cabecalho.linha3, cabecalho.linha4]) {
    if (!linha) continue;
    doc.text(linha.toUpperCase(), centro, y, { align: "center" });
    y += 4.6;
  }

  y += 2;
  doc.setFontSize(12);
  doc.setTextColor(...OURO);
  doc.text((cabecalho.anexo || "ANEXO A").toUpperCase(), centro, y, { align: "center" });
  y += 5;

  doc.setDrawColor(...OURO);
  doc.setLineWidth(0.4);
  doc.line(MARGEM, y, larguraPagina - MARGEM, y);
  y += 6;

  /* ------------------------------------------------------- Blocos e tabelas */

  const finalY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  /** Garante espaco para o titulo antes de escrever; senao abre nova pagina. */
  const quebrarSePreciso = (espaco: number) => {
    if (y + espaco > alturaPagina - MARGEM - 8) {
      doc.addPage();
      y = MARGEM + 4;
    }
  };

  for (const bloco of agruparPorModelo(linhas)) {
    quebrarSePreciso(14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GRAFITE);
    doc.text(`${bloco.categoria.letra}. ${bloco.categoria.titulo}`, MARGEM, y);
    y += 5;

    if (!bloco.grupos.length) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text("(sem lançamentos)", MARGEM + 4, y);
      y += 8;
      continue;
    }

    for (const grupo of bloco.grupos) {
      quebrarSePreciso(20);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...OURO);
      doc.text(tituloGrupo(grupo.secao), MARGEM + 2, y);
      y += 2.5;

      // Todas as colunas centralizadas, inclusive nome e substituto, para que a
      // planilha impressa fique alinhada de cima a baixo.
      const estilosColuna: Record<number, { cellWidth: number; halign: "center" }> = {};
      LARGURAS.forEach((largura, i) => {
        estilosColuna[i] = { cellWidth: largura, halign: "center" };
      });

      autoTable(doc, {
        startY: y,
        margin: { left: MARGEM, right: MARGEM, top: MARGEM, bottom: MARGEM + 6 },
        head: [bloco.categoria.colunas],
        body: grupo.linhas.map((l, i) => celulasDaLinha(l, i + 1)),
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 7.2,
          cellPadding: 1.4,
          lineColor: [170, 170, 170],
          lineWidth: 0.15,
          textColor: [30, 30, 30],
          overflow: "linebreak",
          valign: "middle",
          halign: "center",
        },
        headStyles: {
          fillColor: [232, 230, 224],
          textColor: [25, 25, 25],
          fontStyle: "bold",
          fontSize: 7,
          halign: "center",
          lineColor: [120, 120, 120],
          lineWidth: 0.2,
        },
        columnStyles: estilosColuna,
        // Repete o cabecalho da tabela quando o grupo atravessa a pagina.
        showHead: "everyPage",
      });

      y = finalY() + 6;
    }

    y += 2;
  }

  /* --------------------------------------------------------- Assinatura */

  if (opcoes.assinatura) {
    const { nomeCompleto, nomeGuerra, posto, funcao, assinadoEm, codigo } = opcoes.assinatura;

    // O bloco não pode ficar partido entre páginas nem colar no rodapé.
    const alturaBloco = assinadoEm ? 38 : 34;
    if (y + alturaBloco > alturaPagina - MARGEM - 8) {
      doc.addPage();
      y = MARGEM + 6;
    }

    // Espaço da assinatura de próprio punho, quando não é digital.
    y += assinadoEm ? 10 : 18;

    const partes = partesDaAssinatura(nomeCompleto, nomeGuerra, posto);

    doc.setFontSize(9.5);
    doc.setTextColor(...GRAFITE);

    // Mede o nome inteiro para centralizá-lo, já que cada pedaço tem uma fonte.
    const larguras = partes.map((parte) => {
      doc.setFont("helvetica", parte.negrito ? "bold" : "normal");
      return doc.getTextWidth(parte.texto);
    });
    const larguraNome = larguras.reduce((soma, l) => soma + l, 0);

    let x = centro - larguraNome / 2;
    partes.forEach((parte, i) => {
      doc.setFont("helvetica", parte.negrito ? "bold" : "normal");
      doc.text(parte.texto, x, y);
      x += larguras[i];
    });

    // Sublinhado do nome. Na assinatura digital ele fica embaixo, fechando o
    // nome; no PDF para assinar à mão ele vai por cima, servindo de linha para
    // a assinatura de próprio punho.
    doc.setDrawColor(...GRAFITE);
    doc.setLineWidth(0.25);
    const alturaTraco = assinadoEm ? y + 1.2 : y - 5;
    doc.line(centro - larguraNome / 2, alturaTraco, centro + larguraNome / 2, alturaTraco);

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(funcao, centro, y, { align: "center" });

    if (assinadoEm) {
      const quando = new Date(assinadoEm);
      const carimbo = `Assinado digitalmente no SICOF em ${quando.toLocaleDateString(
        "pt-BR"
      )} às ${quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

      y += 6;
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 110);
      doc.text(carimbo, centro, y, { align: "center" });

      if (codigo) {
        y += 3.8;
        doc.setFont("courier", "normal");
        doc.text(`Código de conferência ${codigo}`, centro, y, { align: "center" });
      }
    }
  }

  /* ------------------------------------------------------------- Rodape */

  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`SICOF · emitido em ${dataDeHoje()}`, MARGEM, alturaPagina - 5);
    doc.text(`Página ${p} de ${totalPaginas}`, larguraPagina - MARGEM, alturaPagina - 5, {
      align: "right",
    });
  }

  doc.save(opcoes.nomeArquivo ?? `plano-de-ferias-${new Date().getFullYear()}.pdf`);
}
