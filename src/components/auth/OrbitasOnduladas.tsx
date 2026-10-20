"use client";

import { useEffect, useRef } from "react";

/**
 * Animacao da area de autenticacao: circulos concentricos desenhados como
 * linhas onduladas, com bolinhas percorrendo essas linhas.
 *
 * Cada anel tem uma onda propria (amplitude, numero de lobulos e velocidade),
 * de modo que a linha "respira" enquanto as bolinhas deslizam sobre ela.
 */

interface Anel {
  raio: number;
  /** Quantos lóbulos a onda faz ao redor do círculo. */
  lobulos: number;
  amplitude: number;
  /** Radianos por quadro; o sinal define o sentido do giro. */
  velocidade: number;
  /** Rotacao acumulada do anel inteiro. */
  giro: number;
  faseOnda: number;
  velocidadeOnda: number;
  cor: string;
  espessura: number;
  bolinhas: { angulo: number; velocidade: number; raio: number; cor: string }[];
}

const CORES = [
  "rgba(200,164,77,",   // dourado
  "rgba(235,235,230,",  // branco
  "rgba(90,150,110,",   // oliva
  "rgba(180,70,70,",    // rubro
];

export default function OrbitasOnduladas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let largura = 0;
    let altura = 0;
    let aneis: Anel[] = [];
    let animacao = 0;

    /** Monta os anéis proporcionais ao tamanho da tela. */
    const montar = () => {
      largura = window.innerWidth;
      altura = window.innerHeight;

      const base = Math.min(largura, altura);
      const quantidade = base < 600 ? 4 : 5;

      aneis = Array.from({ length: quantidade }, (_, i) => {
        const proporcao = 0.22 + i * 0.13;
        const sentido = i % 2 === 0 ? 1 : -1;
        const cor = CORES[i % CORES.length];
        const quantasBolinhas = 3 + ((i * 2) % 4);

        return {
          raio: base * proporcao,
          lobulos: 5 + i,
          amplitude: base * (0.012 + i * 0.004),
          velocidade: sentido * (0.0016 - i * 0.00018),
          giro: 0,
          faseOnda: (i * Math.PI) / 3,
          velocidadeOnda: sentido * (0.006 + i * 0.0012),
          cor,
          espessura: i === 0 ? 1.4 : 1,
          bolinhas: Array.from({ length: quantasBolinhas }, (_, b) => ({
            angulo: (b / quantasBolinhas) * Math.PI * 2 + i,
            // Bolinhas do mesmo anel andam em ritmos levemente diferentes.
            velocidade: sentido * (0.0034 + b * 0.0007 - i * 0.0002),
            raio: 2.4 + (b % 3) * 0.9,
            cor: CORES[(i + b) % CORES.length],
          })),
        };
      });
    };

    const redimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      montar();
    };

    /** Raio do anel em determinado ângulo, já com a ondulação aplicada. */
    const raioOndulado = (anel: Anel, angulo: number) =>
      anel.raio + Math.sin(angulo * anel.lobulos + anel.faseOnda) * anel.amplitude;

    const desenharAnel = (anel: Anel, cx: number, cy: number, giro: number) => {
      const passos = 180;

      ctx.beginPath();
      for (let i = 0; i <= passos; i++) {
        const a = (i / passos) * Math.PI * 2;
        const r = raioOndulado(anel, a);
        const x = cx + Math.cos(a + giro) * r;
        const y = cy + Math.sin(a + giro) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `${anel.cor}0.22)`;
      ctx.lineWidth = anel.espessura;
      ctx.stroke();
    };

    const desenharBolinhas = (anel: Anel, cx: number, cy: number, giro: number) => {
      for (const b of anel.bolinhas) {
        const r = raioOndulado(anel, b.angulo);
        const x = cx + Math.cos(b.angulo + giro) * r;
        const y = cy + Math.sin(b.angulo + giro) * r;

        // Rastro curto no sentido do movimento, para dar ideia de deslizamento.
        const passoRastro = b.velocidade > 0 ? -0.05 : 0.05;
        for (let t = 1; t <= 4; t++) {
          const at = b.angulo + passoRastro * t;
          const rt = raioOndulado(anel, at);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(at + giro) * rt, cy + Math.sin(at + giro) * rt, b.raio * (1 - t * 0.18), 0, Math.PI * 2);
          ctx.fillStyle = `${b.cor}${0.16 - t * 0.03})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, b.raio, 0, Math.PI * 2);
        ctx.fillStyle = `${b.cor}0.95)`;
        ctx.shadowBlur = 14;
        ctx.shadowColor = `${b.cor}0.7)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const quadro = () => {
      ctx.clearRect(0, 0, largura, altura);
      const cx = largura / 2;
      const cy = altura / 2;

      for (const anel of aneis) {
        // A onda avanca e o anel inteiro gira devagar.
        anel.faseOnda += anel.velocidadeOnda;
        anel.giro += anel.velocidade;

        desenharAnel(anel, cx, cy, anel.giro);

        // As bolinhas andam sobre a propria linha ondulada.
        for (const b of anel.bolinhas) b.angulo += b.velocidade;
        desenharBolinhas(anel, cx, cy, anel.giro);
      }

      animacao = requestAnimationFrame(quadro);
    };

    redimensionar();
    window.addEventListener("resize", redimensionar);

    if (reduzido) {
      // Sem movimento: desenha um quadro estático.
      const cx = largura / 2;
      const cy = altura / 2;
      for (const anel of aneis) {
        desenharAnel(anel, cx, cy, 0);
        desenharBolinhas(anel, cx, cy, 0);
      }
    } else {
      quadro();
    }

    return () => {
      cancelAnimationFrame(animacao);
      window.removeEventListener("resize", redimensionar);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
    />
  );
}
