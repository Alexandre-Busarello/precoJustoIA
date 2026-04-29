'use client'

import { useQuery } from '@tanstack/react-query'

interface ExploreDataResponse {
  data: any[]
  count: number
  cached?: boolean
  timestamp?: string
}

function getBrazilDateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
    millisecond: date.getMilliseconds(),
  }
}

function getBrazilDayKey(date = new Date()): string {
  const { year, month, day } = getBrazilDateTimeParts(date)

  return [
    year,
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

function getMillisecondsUntilNextBrazilDay(date = new Date()): number {
  const { hour, minute, second, millisecond } = getBrazilDateTimeParts(date)
  const elapsedToday =
    hour * 60 * 60 * 1000 +
    minute * 60 * 1000 +
    second * 1000 +
    millisecond

  return 24 * 60 * 60 * 1000 - elapsedToday
}

/**
 * Hook para buscar lista "Explorar" de oportunidades
 * Cache diário no frontend (backend garante mudança diária via chave de cache)
 */
export function useRadarExplore() {
  const todayKey = getBrazilDayKey()
  const staleTime = getMillisecondsUntilNextBrazilDay()

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<ExploreDataResponse>({
    queryKey: ['radar-explore', todayKey],
    queryFn: async () => {
      const response = await fetch('/api/radar/explore')
      if (!response.ok) {
        throw new Error('Erro ao buscar oportunidades')
      }
      return response.json()
    },
    staleTime, // Fica fresco até a próxima virada de dia em São Paulo
    gcTime: 24 * 60 * 60 * 1000, // Manter no cache por 24 horas
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  })

  return {
    data: data?.data || [],
    count: data?.count || 0,
    isLoading,
    error,
    refetch,
    cached: data?.cached || false,
    timestamp: data?.timestamp,
  }
}

