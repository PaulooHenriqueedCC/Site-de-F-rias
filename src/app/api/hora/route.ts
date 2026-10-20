import { NextResponse } from "next/server";

/** Nunca cacheia: a resposta é justamente o instante da chamada. */
export const dynamic = "force-dynamic";

/**
 * Hora de referencia para o relogio do painel.
 *
 * O servidor e a fonte unica, de modo que todas as maquinas da unidade mostrem
 * a mesma hora mesmo que o relogio de alguma delas esteja desacertado. O valor
 * vai como epoca UTC; quem converte para o fuso do lugar e o navegador.
 */
export async function GET() {
  const agora = new Date();

  return NextResponse.json(
    {
      epocaMs: agora.getTime(),
      iso: agora.toISOString(),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
