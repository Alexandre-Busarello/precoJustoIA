/**
 * Tarja de Índices do Mercado
 * Exibe índices internacionais e próprios com scroll horizontal contínuo
 */

'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface MarketIndex {
  name: string;
  ticker: string;
  value: number;
  change: number;
  changePercent: number;
  isCustom?: boolean; // Se é índice próprio do site
  color?: string; // Cor do índice próprio
  url?: string; // URL para linkar o índice
}

interface MarketTickerBarProps {
  position?: 'top' | 'bottom';
}

const CACHE_KEY = 'market-indices-cache-v2';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora em milissegundos (quando mercado aberto)
const CACHE_DURATION_CLOSED = 24 * 60 * 60 * 1000; // 24 horas quando mercado fechado e preço disponível
const BANNER_HIDDEN_KEY = 'market-ticker-banner-hidden-v2'; // Chave para localStorage

interface CachedData {
  indices: MarketIndex[];
  timestamp: number;
  marketClosed?: boolean;
  hasClosingPrice?: boolean;
  dataTimestamp?: string; // Timestamp ISO da API quando os dados foram gerados
}

/**
 * Verifica se duas datas são do mesmo dia útil (horário de Brasília)
 * Retorna true se forem do mesmo dia útil, false caso contrário
 */
function isSameTradingDay(date1: Date | string, date2: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = date2;
  
  const parts1 = formatter.formatToParts(d1);
  const parts2 = formatter.formatToParts(d2);
  
  const year1 = parts1.find(p => p.type === 'year')?.value;
  const month1 = parts1.find(p => p.type === 'month')?.value;
  const day1 = parts1.find(p => p.type === 'day')?.value;
  
  const year2 = parts2.find(p => p.type === 'year')?.value;
  const month2 = parts2.find(p => p.type === 'month')?.value;
  const day2 = parts2.find(p => p.type === 'day')?.value;
  
  return year1 === year2 && month1 === month2 && day1 === day2;
}

/**
 * Verifica se o mercado B3 está fechado (horário de Brasília)
 */
function isBrazilMarketClosed(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  
  const dayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
  };
  
  const dayOfWeek = dayMap[weekday] ?? 0;
  
  // Mercado B3: Segunda a Sexta, 10h às 18h (horário de Brasília)
  // Fechado: fim de semana OU antes das 10h OU após 18h
  return dayOfWeek < 1 || dayOfWeek > 5 || hour < 10 || hour >= 18;
}

export function MarketTickerBar({ position = 'top' }: MarketTickerBarProps) {
  const { data: session } = useSession();
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHidden, setIsHidden] = useState(false);

  // Verificar se o banner foi fechado pelo usuário e escutar mudanças
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkHidden = () => {
        if (session) {
          const hidden = localStorage.getItem(BANNER_HIDDEN_KEY) === 'true';
          setIsHidden(hidden);
        } else {
          // Se não tem sessão, sempre mostrar
          setIsHidden(false);
        }
      };
      
      // Verificar inicialmente
      checkHidden();
      
      // Escutar mudanças no localStorage (de outras abas)
      window.addEventListener('storage', checkHidden);
      
      // Escutar evento customizado (mesma aba)
      window.addEventListener('marketTickerVisibilityChange', checkHidden);
      
      return () => {
        window.removeEventListener('storage', checkHidden);
        window.removeEventListener('marketTickerVisibilityChange', checkHidden);
      };
    }
  }, [session]);

  // Função para fechar o banner
  const handleClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(BANNER_HIDDEN_KEY, 'true');
      setIsHidden(true);
      // Disparar evento customizado para notificar outros componentes
      window.dispatchEvent(new Event('marketTickerVisibilityChange'));
    }
  };

  useEffect(() => {
    async function fetchIndices() {
      try {
        const marketClosed = isBrazilMarketClosed();
        
        // Verificar cache no localStorage
        const cachedDataStr = typeof window !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
        
        if (cachedDataStr) {
          try {
            const cachedData: CachedData = JSON.parse(cachedDataStr);
            const now = Date.now();
            const nowDate = new Date();
            
            // CRÍTICO: Cache sem dataTimestamp não pode ser confiado
            // Se não tem dataTimestamp, não sabemos quando os dados foram gerados
            // Mesmo que o cache tenha sido salvo hoje, pode conter dados antigos
            if (!cachedData.dataTimestamp) {
              console.log('📊 [Frontend] Cache sem dataTimestamp - invalidando e buscando dados atualizados');
              if (typeof window !== 'undefined') {
                localStorage.removeItem(CACHE_KEY);
              }
              // Continuar para fazer fetch
            } else {
              // Cache com dataTimestamp - verificar se os dados são de um dia útil diferente
              const dataDate = new Date(cachedData.dataTimestamp);
              
              // Verificação de segurança: se cache tem mais de 24 horas, invalidar
              const cacheAge = now - cachedData.timestamp;
              const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 horas
              
              if (cacheAge > MAX_CACHE_AGE) {
                console.log('📊 [Frontend] Cache muito antigo (>24h) - invalidando e buscando dados atualizados');
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(CACHE_KEY);
                }
                // Continuar para fazer fetch
              } else if (!isSameTradingDay(dataDate, nowDate)) {
                console.log('📊 [Frontend] Cache de dia útil diferente - invalidando e buscando dados atualizados');
                // Remover cache inválido
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(CACHE_KEY);
                }
                // Continuar para fazer fetch
              } else if (marketClosed && cachedData.hasClosingPrice === false) {
                // Se mercado fechado e ainda não tem preço de fechamento, ignorar cache
                console.log('📊 [Frontend] Mercado fechado mas preço ainda não disponível - ignorando cache');
                // Continuar para fazer fetch
              } else {
                // Verificar se cache ainda é válido (duração)
                const cacheDuration = (marketClosed && cachedData.hasClosingPrice) 
                  ? CACHE_DURATION_CLOSED 
                  : CACHE_DURATION;
                
                if (now - cachedData.timestamp < cacheDuration) {
                  console.log('📊 [Frontend] Usando cache válido do localStorage');
                  setIndices(cachedData.indices);
                  setLoading(false);
                  return; // Usar dados em cache, não fazer fetch
                } else {
                  console.log('📊 [Frontend] Cache expirado por duração - buscando dados atualizados');
                }
              }
            }
          } catch (e) {
            // Se houver erro ao parsear cache, continuar para fazer fetch
            console.warn('Erro ao ler cache:', e);
            // Remover cache corrompido
            if (typeof window !== 'undefined') {
              localStorage.removeItem(CACHE_KEY);
            }
          }
        }

        // Fazer fetch - não usar cache do navegador quando mercado fechado até preço estar disponível
        const response = await fetch('/api/market-indices', {
          cache: 'no-store', // Ignorar cache do navegador quando mercado fechado
        });
        
        if (!response.ok) {
          throw new Error('Erro ao buscar índices');
        }
        
        const data = await response.json();
        const fetchedIndices = data.indices || [];
        const hasClosingPrice = data.hasClosingPrice !== false; // Default true se não especificado
        
        // Salvar no cache do localStorage
        if (typeof window !== 'undefined') {
          const cacheData: CachedData = {
            indices: fetchedIndices,
            timestamp: Date.now(),
            marketClosed,
            hasClosingPrice,
            dataTimestamp: data.timestamp || new Date().toISOString(), // Salvar timestamp da API
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
          console.log('📊 [Frontend] Cache salvo no localStorage com timestamp:', cacheData.dataTimestamp);
        }
        
        setIndices(fetchedIndices);
      } catch (error) {
        console.error('Erro ao buscar índices do mercado:', error);
        
        // Em caso de erro, tentar usar cache mesmo que expirado
        if (typeof window !== 'undefined') {
          const cachedDataStr = localStorage.getItem(CACHE_KEY);
          if (cachedDataStr) {
            try {
              const cachedData: CachedData = JSON.parse(cachedDataStr);
              setIndices(cachedData.indices);
            } catch {
              // Ignorar erro
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }

    fetchIndices();
  }, []);

  // Recarregar dados quando o banner for reativado (mudou de hidden para visible)
  useEffect(() => {
    if (session && !isHidden && indices.length === 0 && !loading) {
      // Se o banner foi reativado e não há dados, recarregar
      setLoading(true);
      // Trigger fetch novamente
      async function refetchIndices() {
        try {
          const marketClosed = isBrazilMarketClosed();
          const response = await fetch('/api/market-indices', {
            cache: marketClosed ? 'no-store' : 'force-cache',
          });
          if (response.ok) {
            const data = await response.json();
            const fetchedIndices = data.indices || [];
            const hasClosingPrice = data.hasClosingPrice !== false;
            
            setIndices(fetchedIndices);
            if (typeof window !== 'undefined') {
              const cacheData: CachedData = {
                indices: fetchedIndices,
                timestamp: Date.now(),
                marketClosed,
                hasClosingPrice,
                dataTimestamp: data.timestamp || new Date().toISOString(), // Salvar timestamp da API
              };
              localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            }
          }
        } catch (error) {
          console.error('Erro ao recarregar índices:', error);
        } finally {
          setLoading(false);
        }
      }
      refetchIndices();
    }
  }, [session, isHidden, indices.length, loading]);

  // Se o usuário está logado e fechou o banner, não renderizar
  if (session && isHidden) {
    return null;
  }

  // Sempre renderizar o espaço do banner (40px) para evitar reposicionamento
  // Mostrar skeleton enquanto carrega

  return (
    <>
      <style jsx global>{`
        @keyframes scroll-ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        @keyframes skeleton-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        .animate-skeleton-pulse {
          animation: skeleton-pulse 1.5s ease-in-out infinite;
        }
      `}</style>
      <div
        className={`sticky ${position === 'top' ? 'top-[81px]' : 'bottom-0'} left-0 right-0 z-40 bg-gray-900 text-white border-b border-gray-800 shadow-lg relative`}
        style={{ height: '40px' }}
      >
        {/* Botão de fechar - apenas para usuários logados */}
        {session && (
          <button
            onClick={handleClose}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-50 p-1.5 bg-gray-800/80 hover:bg-gray-700 rounded transition-colors backdrop-blur-sm"
            aria-label="Fechar banner de índices"
            title="Fechar banner"
          >
            <X className="w-4 h-4 text-gray-300 hover:text-white" />
          </button>
        )}
        {loading || indices.length === 0 ? (
          // Skeleton enquanto carrega
          <div className="relative h-full overflow-hidden">
            <div className="absolute inset-0 flex items-center">
              <div
                className="flex items-center gap-8 whitespace-nowrap"
                style={{
                  animation: 'scroll-ticker 60s linear infinite',
                }}
              >
                {[...Array(16)].map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-4">
                    <div className="h-4 w-20 bg-gray-700 rounded animate-skeleton-pulse"></div>
                    <div className="h-4 w-12 bg-gray-700 rounded animate-skeleton-pulse"></div>
                    <div className="h-4 w-16 bg-gray-700 rounded animate-skeleton-pulse"></div>
                    <div className="h-4 w-12 bg-gray-700 rounded animate-skeleton-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Conteúdo real quando carregado
          <div className="relative h-full overflow-hidden">
            {/* Animação de scroll contínuo */}
            <div className="absolute inset-0 flex items-center">
              <div
                className="flex items-center gap-8 whitespace-nowrap"
                style={{
                  animation: 'scroll-ticker 60s linear infinite',
                }}
              >
              {/* Duplicar índices para criar loop infinito */}
              {[...indices, ...indices].map((index, idx) => {
              const isPositive = index.change >= 0;
              const ChangeIcon = isPositive ? TrendingUp : TrendingDown;
              const changeColor = isPositive
                ? 'text-green-400'
                : 'text-red-400';

              const content = (
                <>
                  <span
                    className={`font-semibold ${
                      index.isCustom ? 'text-blue-400' : 'text-white'
                    }`}
                    style={index.color ? { color: index.color } : {}}
                  >
                    {index.name}
                  </span>
                  <span className="text-gray-300">{index.ticker}</span>
                  <span className="text-white font-medium">
                    {index.value.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <div className={`flex items-center gap-1 ${changeColor}`}>
                    <ChangeIcon className="h-3 w-3" />
                    <span className="text-sm font-semibold">
                      {isPositive ? '+' : ''}
                      {index.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </>
              );

              return (
                <div
                  key={`${index.ticker}-${idx}`}
                  className="flex items-center gap-2 px-4"
                >
                  {index.url ? (
                    index.isCustom ? (
                      // Link interno para índices próprios
                      <Link
                        href={index.url}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                      >
                        {content}
                      </Link>
                    ) : (
                      // Link externo para índices internacionais
                      <a
                        href={index.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                      >
                        {content}
                      </a>
                    )
                  ) : (
                    // Sem link
                    content
                  )}
                </div>
              );
              })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

