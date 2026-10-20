/** Identidade militar no formato 111.222.333-4 */
export const REGEX_IDENTIDADE = /^\d{3}\.\d{3}\.\d{3}-\d$/;

export function identidadeValida(valor: string): boolean {
  return REGEX_IDENTIDADE.test(valor.trim());
}

/** Aplica a mascara 000.000.000-0 conforme o usuario digita. */
export function mascararIdentidade(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 10);
  let saida = d.slice(0, 3);
  if (d.length > 3) saida += "." + d.slice(3, 6);
  if (d.length > 6) saida += "." + d.slice(6, 9);
  if (d.length > 9) saida += "-" + d.slice(9, 10);
  return saida;
}

export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      [a && `(${a}`, a.length === 2 ? ") " : "", b, c && `-${c}`].join("")
    ).trim();
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export const SENHA_MAX = 16;

export function senhaValida(senha: string): { ok: boolean; erro?: string } {
  if (!senha) return { ok: false, erro: "Informe a senha." };
  if (senha.length < 6) return { ok: false, erro: "A senha precisa de pelo menos 6 caracteres." };
  if (senha.length > SENHA_MAX) return { ok: false, erro: `A senha aceita no máximo ${SENHA_MAX} caracteres.` };
  return { ok: true };
}
