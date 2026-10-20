/**
 * Controle de acesso do SICOF.
 *
 * Cada area do sistema tem dois niveis: **acessar** (ver a aba) e **editar**
 * (lancar, alterar e excluir). O Administrador Geral tem tudo; os demais
 * administradores recebem do Administrador Geral exatamente o que podem ver e
 * editar; o usuario comum ve apenas as abas livres, sempre sem editar.
 */

export type ChavePermissao =
  | "paginaInicial"
  | "planoFerias"
  | "dispensa"
  | "desconto"
  | "pagamento"
  | "efetivo"
  | "cadastrarUsuario";

export interface AreaPermissao {
  chave: ChavePermissao;
  rotulo: string;
  descricao: string;
  /** Abas que todo usuario enxerga; a permissao so decide se ele pode editar. */
  sempreVisivel: boolean;
  /** Nao e uma aba, e sim uma acao solta — tem apenas o nivel de edicao. */
  apenasAcao: boolean;
}

export const PERMISSOES: AreaPermissao[] = [
  { chave: "paginaInicial", rotulo: "Quadro de férias", descricao: "Lançar e editar períodos de férias", sempreVisivel: true, apenasAcao: false },
  { chave: "planoFerias", rotulo: "Plano de férias", descricao: "Montar e editar o ANEXO A do plano de férias", sempreVisivel: true, apenasAcao: false },
  { chave: "dispensa", rotulo: "Dispensa como recompensa", descricao: "Lançar dispensas e comentários", sempreVisivel: false, apenasAcao: false },
  { chave: "desconto", rotulo: "Desconto em férias", descricao: "Lançar descontos e comentários", sempreVisivel: false, apenasAcao: false },
  { chave: "pagamento", rotulo: "Pagamento de férias", descricao: "Informar DIEx e situação de pagamento", sempreVisivel: false, apenasAcao: false },
  { chave: "efetivo", rotulo: "Efetivo", descricao: "Importar, editar e excluir militares", sempreVisivel: false, apenasAcao: false },
  { chave: "cadastrarUsuario", rotulo: "Cadastro de usuários", descricao: "Criar contas de usuário comum", sempreVisivel: false, apenasAcao: true },
];

export function areaPermissao(chave: ChavePermissao): AreaPermissao | undefined {
  return PERMISSOES.find((p) => p.chave === chave);
}

export interface NivelPermissao {
  ver: boolean;
  editar: boolean;
}

/**
 * O valor pode ser um par { ver, editar } ou um booleano — este ultimo vindo
 * das contas gravadas antes desta versao, quando so existia "pode editar".
 */
export type ValorPermissao = boolean | NivelPermissao;
export type MapaPermissoes = Partial<Record<ChavePermissao, ValorPermissao>>;

export const NIVEL_NENHUM: NivelPermissao = { ver: false, editar: false };

/** Normaliza o valor gravado, aceitando o formato booleano antigo. */
export function normalizarNivel(valor: ValorPermissao | undefined | null): NivelPermissao {
  if (typeof valor === "boolean") return valor ? { ver: true, editar: true } : { ...NIVEL_NENHUM };
  if (!valor) return { ...NIVEL_NENHUM };
  return { ver: Boolean(valor.ver || valor.editar), editar: Boolean(valor.editar) };
}

export function nivelDe(mapa: MapaPermissoes | null | undefined, chave: ChavePermissao): NivelPermissao {
  return normalizarNivel(mapa?.[chave]);
}

export function permissoesPadraoAdmin(): MapaPermissoes {
  return {
    paginaInicial: { ver: true, editar: true },
    planoFerias: { ver: true, editar: true },
    dispensa: { ver: true, editar: true },
    desconto: { ver: true, editar: true },
    pagamento: { ver: false, editar: false },
    efetivo: { ver: true, editar: true },
    cadastrarUsuario: { ver: true, editar: true },
  };
}

export interface UsuarioSessao {
  id: string;
  identidade: string;
  nomeCompleto: string;
  nomeGuerra: string;
  posto: string;
  perfil: "USUARIO" | "ADMINISTRADOR" | "ADMINISTRADOR_GERAL";
  permissoes?: MapaPermissoes | null;
}

export function ehAdminGeral(u?: UsuarioSessao | null): boolean {
  return u?.perfil === "ADMINISTRADOR_GERAL";
}

/** Como o perfil aparece na tela. */
export function rotuloPerfil(perfil?: string | null): string {
  if (perfil === "ADMINISTRADOR_GERAL") return "Administrador Geral";
  if (perfil === "ADMINISTRADOR") return "Administrador";
  return "Usuário";
}

export function ehAdministrador(u?: UsuarioSessao | null): boolean {
  return u?.perfil === "ADMINISTRADOR" || u?.perfil === "ADMINISTRADOR_GERAL";
}

/** O Administrador Geral sempre pode editar. Usuario comum, nunca. */
export function podeEditar(u: UsuarioSessao | null | undefined, chave: ChavePermissao): boolean {
  if (!u) return false;
  if (u.perfil === "ADMINISTRADOR_GERAL") return true;
  if (u.perfil === "ADMINISTRADOR") return nivelDe(u.permissoes, chave).editar;
  return false;
}

/** Ver a area. Abas livres ficam visiveis para todos, inclusive usuario comum. */
export function podeVer(u: UsuarioSessao | null | undefined, chave: ChavePermissao): boolean {
  if (!u) return false;
  if (u.perfil === "ADMINISTRADOR_GERAL") return true;
  if (areaPermissao(chave)?.sempreVisivel) return true;
  if (u.perfil === "ADMINISTRADOR") return nivelDe(u.permissoes, chave).ver;
  return false;
}

/* ------------------------------------------------------------- Navegacao */

export type NivelAcesso = "TODOS" | "ADMIN" | "ADMIN_GERAL";

export interface ItemNavegacao {
  href: string;
  rotulo: string;
  /** Area de permissao ligada a aba; null quando a aba nao depende de permissao. */
  chave: ChavePermissao | null;
  acesso: NivelAcesso;
  /**
   * Aba que so aparece quando ha algo esperando o usuario — hoje apenas
   * "Aprovar e assinar". O menu a esconde quando o contador esta zerado; a
   * rota em si continua acessivel e mostra o estado vazio.
   */
  somenteQuandoPendente?: boolean;
}

/**
 * Abas do painel, na ordem do menu.
 *
 * "TODOS" sao as quatro abas livres que o usuario comum enxerga: pagina
 * inicial, calendario, plano de ferias e configuracoes.
 */
export const NAVEGACAO: ItemNavegacao[] = [
  { href: "/dashboard", rotulo: "Página inicial", chave: "paginaInicial", acesso: "TODOS" },
  { href: "/dashboard/calendario", rotulo: "Calendário", chave: null, acesso: "TODOS" },
  { href: "/dashboard/plano-ferias", rotulo: "Plano de férias", chave: "planoFerias", acesso: "TODOS" },
  { href: "/dashboard/dispensa", rotulo: "Dispensa como recompensa", chave: "dispensa", acesso: "ADMIN" },
  { href: "/dashboard/desconto", rotulo: "Desconto em férias", chave: "desconto", acesso: "ADMIN" },
  { href: "/dashboard/pagamento", rotulo: "Pagamento de férias", chave: "pagamento", acesso: "ADMIN" },
  { href: "/dashboard/efetivo", rotulo: "Efetivo", chave: "efetivo", acesso: "ADMIN" },
  { href: "/dashboard/assinar", rotulo: "Aprovar e assinar", chave: null, acesso: "TODOS", somenteQuandoPendente: true },
  { href: "/dashboard/assinados", rotulo: "Assinados", chave: null, acesso: "ADMIN" },
  { href: "/dashboard/configuracoes", rotulo: "Configurações", chave: null, acesso: "TODOS" },
  { href: "/dashboard/aprovacoes", rotulo: "Aprovações", chave: null, acesso: "ADMIN" },
  { href: "/dashboard/administradores", rotulo: "Administradores", chave: null, acesso: "ADMIN_GERAL" },
];

export function podeVerItem(u: UsuarioSessao | null | undefined, item: ItemNavegacao): boolean {
  if (!u) return false;
  if (u.perfil === "ADMINISTRADOR_GERAL") return true;

  if (item.acesso === "ADMIN_GERAL") return false;
  if (item.acesso === "TODOS") return true;

  // Abas administrativas: precisa ser administrador e ter o nivel de acesso.
  if (u.perfil !== "ADMINISTRADOR") return false;
  return item.chave ? nivelDe(u.permissoes, item.chave).ver : true;
}

export function itensVisiveis(u: UsuarioSessao | null | undefined): ItemNavegacao[] {
  return NAVEGACAO.filter((i) => podeVerItem(u, i));
}

/** Usado pelo middleware para barrar o acesso direto pela URL. */
export function podeAcessarRota(u: UsuarioSessao | null | undefined, caminho: string): boolean {
  const item = NAVEGACAO
    .filter((i) => (i.href === "/dashboard" ? caminho === i.href : caminho.startsWith(i.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  // Rota do painel que não está no menu: basta estar autenticado.
  if (!item) return Boolean(u);
  return podeVerItem(u, item);
}
