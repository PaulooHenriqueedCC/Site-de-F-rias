declare module "pdf-parse" {
  interface ResultadoPdf {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }
  function pdfParse(dados: Buffer | Uint8Array, opcoes?: Record<string, unknown>): Promise<ResultadoPdf>;
  export default pdfParse;
}
