import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao-servidor";

export default async function Raiz() {
  const usuario = await sessaoAtual();
  redirect(usuario ? "/dashboard" : "/login");
}
