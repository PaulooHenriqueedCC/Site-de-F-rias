import bcrypt from "bcryptjs";

export async function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

/** Senha temporaria de 10 caracteres gerada pelo Administrador Geral. */
export function gerarSenhaTemporaria(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const simbolos = "@#$%&";
  const sortear = (s: string) => s[Math.floor(Math.random() * s.length)];
  const bruta = [
    ...Array.from({ length: 4 }, () => sortear(letras)),
    ...Array.from({ length: 4 }, () => sortear(numeros)),
    sortear(simbolos),
    sortear(letras).toLowerCase(),
  ];
  return bruta.sort(() => Math.random() - 0.5).join("");
}
