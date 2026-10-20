import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao-servidor";
import { ProvedorUsuario } from "@/components/dashboard/ContextoUsuario";
import MenuLateral from "@/components/dashboard/MenuLateral";
import Relogio from "@/components/dashboard/Relogio";
import BotaoSair from "@/components/dashboard/BotaoSair";
import SentinelaInatividade from "@/components/dashboard/SentinelaInatividade";

export default async function LayoutDashboard({ children }: { children: React.ReactNode }) {
  const usuario = await sessaoAtual();
  if (!usuario) redirect("/login");

  return (
    <ProvedorUsuario usuario={usuario}>
      <SentinelaInatividade />
      <div className="flex min-h-screen flex-col lg:flex-row">
        <MenuLateral />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Identidade do usuário fica no menu lateral; aqui só data, hora e saída. */}
          <header className="flex items-center justify-end gap-4 border-b border-line bg-graphite-800/60 px-5 py-3.5">
            <Relogio />
            <BotaoSair />
          </header>

          <main className="flex-1 p-5 lg:p-7">{children}</main>
        </div>
      </div>
    </ProvedorUsuario>
  );
}
