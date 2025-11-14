/**
 * Utilitários para sistema de tracking de eventos
 * Funções auxiliares para geração de IDs, sanitização de dados, etc.
 */

/**
 * Gera um ID único de sessão
 * Armazena no sessionStorage para persistir durante a sessão do navegador
 */
export function generateSessionId(): string {
  if (typeof window === 'undefined') {
    // Server-side: retorna ID temporário
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Verifica se já existe sessão no sessionStorage
  let sessionId = sessionStorage.getItem('tracking_session_id');
  
  if (!sessionId) {
    // Gera novo ID de sessão
    const randomPart = Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);
    sessionId = `sess-${Date.now()}-${randomPart}`;
    sessionStorage.setItem('tracking_session_id', sessionId);
  }
  
  return sessionId;
}

/**
 * Extrai metadados da página atual
 */
export function getPageMetadata(): {
  path: string;
  referrer: string | null;
  userAgent: string | null;
  viewport: { width: number; height: number } | null;
} {
  if (typeof window === 'undefined') {
    return {
      path: '/',
      referrer: null,
      userAgent: null,
      viewport: null,
    };
  }

  return {
    path: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    userAgent: navigator.userAgent || null,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
}

/**
 * Sanitiza dados do evento removendo informações sensíveis
 */
export function sanitizeEventData(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data };
  
  // Remove campos sensíveis
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard', 'cvv'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      delete sanitized[field];
    }
  }
  
  // Remove dados de formulários que possam conter informações sensíveis
  if (sanitized.formData) {
    const formData = sanitized.formData as Record<string, any>;
    for (const key in formData) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        delete formData[key];
      }
    }
  }
  
  return sanitized;
}

/**
 * Hash do IP para privacidade (LGPD compliance)
 * Não armazena IP completo, apenas hash
 */
export function hashIP(ip: string | null | undefined): string | null {
  if (!ip) return null;
  
  // Remove IPv6 prefix se presente
  const cleanIP = ip.replace(/^::ffff:/, '');
  
  // Gera hash simples (server-side usa crypto, client-side usa string hash)
  if (typeof window === 'undefined') {
    // Server-side: usa crypto do Node.js
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(cleanIP).digest('hex').substring(0, 16);
  } else {
    // Client-side: hash simples (não crítico, apenas para agrupamento)
    let hash = 0;
    for (let i = 0; i < cleanIP.length; i++) {
      const char = cleanIP.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 16);
  }
}

/**
 * Obtém hash do IP do request (server-side apenas)
 */
export function getIPHashFromRequest(request: Request): string | null {
  // Tenta obter IP de headers comuns
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  const ip = forwarded?.split(',')[0] || realIP || cfConnectingIP || null;
  
  return hashIP(ip);
}

/**
 * Calcula profundidade de scroll em porcentagem
 */
export function getScrollDepth(): number {
  if (typeof window === 'undefined') return 0;
  
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  const scrollableHeight = documentHeight - windowHeight;
  if (scrollableHeight <= 0) return 0;
  
  return Math.round((scrollTop / scrollableHeight) * 100);
}

/**
 * Obtém o texto visível de um elemento (label que aparece na tela)
 * Tenta várias estratégias para encontrar o texto mais relevante
 */
function getVisibleLabel(element: HTMLElement): string | null {
  // 1. Tenta aria-label (mais confiável para acessibilidade)
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return ariaLabel.trim().substring(0, 100);
  }

  // 2. Tenta title attribute
  const title = element.getAttribute('title');
  if (title && title.trim()) {
    return title.trim().substring(0, 100);
  }

  // 3. Para inputs, tenta placeholder ou value
  if (element instanceof HTMLInputElement) {
    if (element.placeholder && element.placeholder.trim()) {
      return element.placeholder.trim().substring(0, 100);
    }
    if (element.value && element.value.trim()) {
      return element.value.trim().substring(0, 100);
    }
  }

  // 4. Para elementos com texto direto, pega o texto
  const directText = element.textContent?.trim();
  if (directText && directText.length > 0 && directText.length < 200) {
    return directText.substring(0, 100);
  }

  // 5. Tenta encontrar label associado (para inputs)
  if (element instanceof HTMLInputElement && element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label && label.textContent) {
      return label.textContent.trim().substring(0, 100);
    }
  }

  // 6. Tenta encontrar texto em elementos filhos próximos (para botões com ícones)
  const children = Array.from(element.children);
  for (const child of children) {
    if (child instanceof HTMLElement) {
      const childText = child.textContent?.trim();
      if (childText && childText.length > 0 && childText.length < 100) {
        return childText.substring(0, 100);
      }
    }
  }

  // 7. Tenta encontrar texto em elementos irmãos (para casos como: <span>Label</span><button>)
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const elementIndex = siblings.indexOf(element);
    
    // Verifica irmão anterior
    if (elementIndex > 0) {
      const prevSibling = siblings[elementIndex - 1];
      if (prevSibling instanceof HTMLElement) {
        const siblingText = prevSibling.textContent?.trim();
        if (siblingText && siblingText.length > 0 && siblingText.length < 100) {
          return siblingText.substring(0, 100);
        }
      }
    }
  }

  // 8. Para links, tenta pegar o texto do link
  if (element instanceof HTMLAnchorElement) {
    const linkText = element.textContent?.trim();
    if (linkText && linkText.length > 0 && linkText.length < 200) {
      return linkText.substring(0, 100);
    }
  }

  return null;
}

/**
 * Obtém informações do elemento clicado
 */
export function getElementInfo(element: HTMLElement | EventTarget | null): {
  tag: string;
  id: string | null;
  classes: string[];
  text: string | null;
  visibleLabel: string | null;
  selector: string | null;
  href?: string | null;
  type?: string | null;
  ariaLabel?: string | null;
  title?: string | null;
} {
  if (!element || !(element instanceof HTMLElement)) {
    return {
      tag: 'unknown',
      id: null,
      classes: [],
      text: null,
      visibleLabel: null,
      selector: null,
    };
  }

  const tag = element.tagName.toLowerCase();
  const id = element.id || null;
  const classes = Array.from(element.classList);
  const text = element.textContent?.trim().substring(0, 100) || null;
  
  // Obtém o label visível (texto que aparece na tela)
  const visibleLabel = getVisibleLabel(element);
  
  // Gera seletor mais específico para melhor identificação
  let selector = tag;
  if (id) {
    selector = `${tag}#${id}`;
  } else if (classes.length > 0) {
    // Usa até 2 classes para melhor identificação
    const classSelector = classes.slice(0, 2).join('.');
    selector = `${tag}.${classSelector}`;
  }
  
  // Adiciona informações específicas para links e botões
  const href = (element as HTMLAnchorElement).href || null;
  const type = (element as HTMLButtonElement | HTMLInputElement).type || null;
  const ariaLabel = element.getAttribute('aria-label') || null;
  const title = element.getAttribute('title') || null;
  
  return {
    tag,
    id,
    classes,
    text,
    visibleLabel, // Label visível na tela (mais útil para mapa de calor)
    selector,
    href,
    type,
    ariaLabel,
    title,
  };
}

/**
 * Verifica se o usuário optou por não ser rastreado
 */
export function isTrackingOptedOut(): boolean {
  if (typeof window === 'undefined') return false;
  
  return localStorage.getItem('tracking_opt_out') === 'true';
}

/**
 * Define opt-out de tracking
 */
export function setTrackingOptOut(optOut: boolean): void {
  if (typeof window === 'undefined') return;
  
  if (optOut) {
    localStorage.setItem('tracking_opt_out', 'true');
  } else {
    localStorage.removeItem('tracking_opt_out');
  }
}

