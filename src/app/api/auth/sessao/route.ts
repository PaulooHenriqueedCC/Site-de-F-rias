import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/sessao-servidor";

export async function GET() {
  return NextResponse.json({ usuario: await sessaoAtual() });
}
