/**
 * Navegação do site — fonte única para header desktop, menu mobile, bottom nav e rodapé.
 *
 * - `marketing`: visitante anônimo (máx. 5 itens de topo).
 * - `app`: usuário logado (máx. 5 itens de topo).
 * - `getAccountLinks()`: menu do avatar / seção "Conta" do menu mobile.
 * - `FOOTER_SECTIONS`: colunas do rodapé, sem links duplicados.
 */

export interface NavLink {
  label: string
  href: string
  /** Uma linha curta exibida no dropdown desktop. */
  description?: string
  /** Só marca ativo na rota exata (ex.: /dashboard não fica ativo em /dashboard/subscriptions). */
  exact?: boolean
}

/** Item de topo: link direto (`href`) ou grupo com `items`. */
export interface NavSection {
  label: string
  href?: string
  exact?: boolean
  items?: NavLink[]
}

export interface AccountLink {
  label: string
  href?: string
  /** Ação especial em vez de navegação. */
  action?: 'signout'
}

const DISCOVER: NavSection = {
  label: 'Descobrir',
  items: [
    { label: 'Screening de ações', href: '/screening-acoes', description: 'Filtre empresas por indicadores' },
    { label: 'Screening de FIIs', href: '/screening-fiis', description: 'Filtre fundos por DY, P/VP e liquidez' },
    { label: 'Rankings', href: '/ranking', description: 'Empresas ordenadas por modelo de valuation' },
    { label: 'Radar de dividendos', href: '/radar-dividendos', description: 'Calendário de proventos por empresa' },
    { label: 'Índices', href: '/indices', description: 'Carteiras teóricas com histórico' },
  ],
}

/** Premissa central do produto: item de topo nos dois menus. */
const ONDE_APORTAR: NavSection = { label: 'Onde aportar', href: '/onde-aportar' }

const CALCULATORS: NavLink[] = [
  { label: 'Calculadora de dividend yield', href: '/calculadoras/dividend-yield', description: 'Preço-teto e rendimento' },
  { label: 'Calculadora de recuperação', href: '/calculadoras/recuperacao', description: 'Aporte para recuperar uma perda' },
  { label: 'Arbitragem de dívida', href: '/arbitragem-divida', description: 'Amortizar dívida ou investir' },
]

const MARKETING_TOOLS: NavSection = {
  label: 'Ferramentas',
  items: [
    { label: 'Comparador', href: '/comparador', description: 'Indicadores de ações lado a lado' },
    { label: 'Backtest', href: '/backtest', description: 'Simule carteiras no passado' },
    { label: 'Análise setorial', href: '/analise-setorial', description: 'Múltiplos por setor' },
    { label: 'P/L da bolsa', href: '/pl-bolsa', description: 'Histórico do P/L do Ibovespa' },
    ...CALCULATORS,
  ],
}

const LEARN: NavSection = {
  label: 'Aprender',
  items: [
    { label: 'Blog', href: '/blog', description: 'Artigos sobre análise fundamentalista' },
    { label: 'Metodologia', href: '/metodologia', description: 'Como cada modelo é calculado' },
    { label: 'Como funciona', href: '/como-funciona', description: 'O produto em 3 passos' },
  ],
}

const APP_TOOLS: NavSection = {
  label: 'Ferramentas',
  items: [
    { label: 'Comparador', href: '/comparador', description: 'Indicadores de ações lado a lado' },
    { label: 'Análise setorial', href: '/analise-setorial', description: 'Múltiplos por setor' },
    { label: 'P/L da bolsa', href: '/pl-bolsa', description: 'Histórico do P/L do Ibovespa' },
    { label: 'Projeções do Ibovespa', href: '/projecoes-ibov', description: 'Faixas estimadas para o índice' },
    ...CALCULATORS,
  ],
}

/** No app, as ferramentas entram em "Descobrir" para o menu ficar em 5 itens de topo com "Onde aportar". */
const APP_DISCOVER: NavSection = {
  label: 'Descobrir',
  items: [...(DISCOVER.items ?? []), ...(APP_TOOLS.items ?? [])],
}

export const navigation: { marketing: NavSection[]; app: NavSection[] } = {
  marketing: [ONDE_APORTAR, DISCOVER, MARKETING_TOOLS, LEARN, { label: 'Planos', href: '/planos' }],
  app: [
    { label: 'Início', href: '/dashboard', exact: true },
    ONDE_APORTAR,
    APP_DISCOVER,
    {
      label: 'Carteiras',
      items: [
        { label: 'Minhas carteiras', href: '/carteira', description: 'Posições, aportes e rentabilidade' },
        { label: 'Agenda de proventos', href: '/agenda-proventos', description: 'Datas ex, pagamentos e renda mensal' },
        { label: 'Backtest', href: '/backtest', description: 'Simule carteiras no passado' },
        { label: 'Índices teóricos', href: '/indices', description: 'Carteiras teóricas com histórico' },
      ],
    },
    {
      label: 'Alertas',
      items: [
        { label: 'Meu radar', href: '/radar', description: 'Ativos que você acompanha' },
        { label: 'Agenda de proventos', href: '/agenda-proventos', description: 'Proventos do radar e da carteira' },
        { label: 'Alertas de preço', href: '/dashboard/subscriptions', description: 'Aviso por e-mail por ticker' },
        { label: 'Monitoramentos', href: '/dashboard/monitoramentos-customizados', description: 'Alertas por indicador' },
        { label: 'Notificações', href: '/notificacoes', description: 'Avisos da plataforma' },
      ],
    },
  ],
}

/** Links da conta (avatar e menu mobile). Suporte premium vai para /suporte; os demais para /contato. */
export function getAccountLinks(isPremium: boolean): AccountLink[] {
  return [
    { label: 'Perfil', href: '/perfil' },
    { label: 'Assinatura', href: '/perfil#assinatura' },
    { label: 'Conversas com o Ben', href: '/conversas-ben' },
    { label: 'Suporte', href: isPremium ? '/suporte' : '/contato' },
    { label: 'Sair', action: 'signout' },
  ]
}

export interface FooterSection {
  label: string
  links: NavLink[]
}

export const FOOTER_SECTIONS: FooterSection[] = [
  {
    label: 'Descobrir',
    links: [
      { label: 'Onde aportar', href: '/onde-aportar' },
      ...(DISCOVER.items ?? []),
      { label: 'Planos', href: '/planos' },
    ],
  },
  { label: 'Ferramentas', links: MARKETING_TOOLS.items ?? [] },
  {
    label: 'Empresa',
    links: [...(LEARN.items ?? []), { label: 'Sobre', href: '/sobre' }, { label: 'Contato', href: '/contato' }],
  },
  {
    label: 'Legal',
    links: [
      { label: 'Termos de uso', href: '/termos-de-uso' },
      { label: 'Privacidade e LGPD', href: '/lgpd' },
    ],
  },
]

/** true se `href` corresponde à rota atual (prefixo por segmento, ou exato com `exact`). */
export function isActiveHref(pathname: string | null | undefined, href: string, exact = false): boolean {
  if (!pathname) return false
  const path = href.split('#')[0]
  if (pathname === path) return true
  return !exact && path !== '/' && pathname.startsWith(`${path}/`)
}

/** true se algum link do item de topo corresponde à rota atual. */
export function isSectionActive(pathname: string | null | undefined, section: NavSection): boolean {
  if (section.href) return isActiveHref(pathname, section.href, section.exact)
  return (section.items ?? []).some((item) => isActiveHref(pathname, item.href, item.exact))
}

/** Comprimento do link mais específico da seção que corresponde à rota (-1 se nenhum). */
function sectionMatchLength(pathname: string | null | undefined, section: NavSection): number {
  const links = section.href ? [{ href: section.href, exact: section.exact }] : (section.items ?? [])
  return links.reduce(
    (best, link) => (isActiveHref(pathname, link.href, link.exact) ? Math.max(best, link.href.split('#')[0].length) : best),
    -1
  )
}

/**
 * Item de topo ativo: o de link mais específico; em empate (mesmo link em dois grupos, ex. /indices), o primeiro.
 * Garante um único item de topo destacado no header.
 */
export function getActiveSection(pathname: string | null | undefined, sections: NavSection[]): NavSection | undefined {
  let active: NavSection | undefined
  let bestLength = -1
  for (const section of sections) {
    const length = sectionMatchLength(pathname, section)
    if (length > bestLength) {
      active = section
      bestLength = length
    }
  }
  return active
}

const AUTH_ROUTES = ['/login', '/register', '/esqueci-senha', '/redefinir-senha', '/verificar-email']

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Login, cadastro e recuperação de senha. */
export function isAuthRoute(pathname: string | null | undefined): boolean {
  return !!pathname && AUTH_ROUTES.some((route) => matchesPrefix(pathname, route))
}

/** Checkout e subpáginas (/checkout/success etc.). */
export function isCheckoutRoute(pathname: string | null | undefined): boolean {
  return !!pathname && pathname.startsWith('/checkout')
}

/** Rotas onde o header mostra só o logo (sem navegação, busca nem ações). */
export function isMinimalChromeRoute(pathname: string | null | undefined): boolean {
  return isAuthRoute(pathname) || isCheckoutRoute(pathname)
}

/** Rotas com layout próprio, sem header global (landing de oferta e de parceiros). */
export function isStandaloneRoute(pathname: string | null | undefined): boolean {
  return !!pathname && (matchesPrefix(pathname, '/oferta') || pathname.startsWith('/parceiros/'))
}

/** Rotas sem o rodapé global. */
export function isFooterHidden(pathname: string | null | undefined): boolean {
  return isMinimalChromeRoute(pathname) || isStandaloneRoute(pathname) || (!!pathname && matchesPrefix(pathname, '/admin'))
}

/** Rotas sem bottom nav e sem FAB do Ben. */
export function isAppChromeHidden(pathname: string | null | undefined): boolean {
  return isFooterHidden(pathname)
}
