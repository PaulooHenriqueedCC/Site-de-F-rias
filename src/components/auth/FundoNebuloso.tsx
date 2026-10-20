"use client";

/**
 * Fundo da area de autenticacao: camadas de fumaca em movimento lento sobre um
 * grafite escuro, com vinheta para dar profundidade. As bolinhas em orbita
 * ficam por conta de OrbitasOnduladas, desenhado por cima deste fundo.
 */
export default function FundoNebuloso() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-graphite-900" />

      {/* Camadas de fumaca */}
      <div
        className="absolute -left-1/4 top-[-20%] h-[120vh] w-[120vw] animate-fumaca blur-3xl"
        style={{
          background:
            "radial-gradient(45% 40% at 30% 35%, rgba(90,110,95,0.55), transparent 70%), radial-gradient(35% 45% at 70% 60%, rgba(60,70,64,0.6), transparent 70%)",
        }}
      />
      <div
        className="absolute -right-1/4 bottom-[-25%] h-[110vh] w-[110vw] animate-fumaca blur-3xl"
        style={{
          animationDelay: "-7s",
          background:
            "radial-gradient(40% 40% at 60% 40%, rgba(120,120,110,0.35), transparent 70%), radial-gradient(45% 35% at 25% 70%, rgba(70,85,72,0.5), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 animate-fumaca blur-2xl"
        style={{
          animationDelay: "-13s",
          background: "radial-gradient(60% 50% at 50% 50%, rgba(140,140,130,0.18), transparent 75%)",
        }}
      />

      {/* Vinheta para dar profundidade */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(70% 60% at 50% 45%, transparent 30%, rgba(6,9,7,0.85) 100%)" }}
      />
    </div>
  );
}
