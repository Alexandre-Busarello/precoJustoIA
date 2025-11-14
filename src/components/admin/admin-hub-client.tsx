/**
 * Componente cliente para o Hub Administrativo
 * Página inicial com acesso a todas as ferramentas admin
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  BarChart3,
  MessageSquare,
  Database,
  Users,
  Activity,
  TrendingUp,
  MousePointer2,
  Route,
  TrendingDown,
  Settings,
  ArrowRight,
} from 'lucide-react';

interface AdminHubClientProps {
  userEmail: string;
  userName: string;
}

interface QuickStats {
  totalTickets?: number;
  openTickets?: number;
  totalEvents?: number;
  uniqueUsers?: number;
}

export function AdminHubClient({ userEmail, userName }: AdminHubClientProps) {
  const [stats, setStats] = useState<QuickStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuickStats = async () => {
      try {
        // Buscar estatísticas rápidas de tickets
        const ticketsResponse = await fetch('/api/admin/tickets?limit=1');
        if (ticketsResponse.ok) {
          const ticketsData = await ticketsResponse.json();
          setStats(prev => ({
            ...prev,
            totalTickets: ticketsData.total || 0,
            openTickets: ticketsData.tickets?.filter((t: any) => 
              ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_ADMIN'].includes(t.status)
            ).length || 0,
          }));
        }

        // Buscar estatísticas rápidas de analytics
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7); // Últimos 7 dias

        const analyticsResponse = await fetch(
          `/api/admin/analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );
        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          setStats(prev => ({
            ...prev,
            totalEvents: analyticsData.metrics?.totalEvents || 0,
            uniqueUsers: analyticsData.metrics?.uniqueUsers || 0,
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuickStats();
  }, []);

  const adminModules = [
    {
      id: 'tickets',
      title: 'Central de Tickets',
      description: 'Gerencie todos os tickets de suporte da plataforma',
      icon: MessageSquare,
      href: '/admin/tickets',
      color: 'bg-blue-500',
      badge: stats.openTickets ? `${stats.openTickets} abertos` : undefined,
      badgeVariant: 'default' as const,
    },
    {
      id: 'analytics',
      title: 'Analytics & Métricas',
      description: 'Dashboard completo de uso, funis, jornada e mapas de calor',
      icon: BarChart3,
      href: '/admin/analytics',
      color: 'bg-purple-500',
      badge: stats.totalEvents ? `${(stats.totalEvents / 1000).toFixed(1)}k eventos` : undefined,
      badgeVariant: 'secondary' as const,
    },
    {
      id: 'cache-monitor',
      title: 'Monitor de Cache',
      description: 'Visualize e gerencie o sistema de cache inteligente',
      icon: Database,
      href: '/admin/cache-monitor',
      color: 'bg-green-500',
    },
  ];

  const analyticsFeatures = [
    {
      title: 'Visão Geral',
      description: 'Métricas gerais e estatísticas de uso',
      href: '/admin/analytics',
      icon: Activity,
    },
    {
      title: 'Mapa de Calor',
      description: 'Visualize onde os usuários clicam',
      href: '/admin/analytics#heatmap',
      icon: MousePointer2,
    },
    {
      title: 'Análise de Jornada',
      description: 'Fluxos de navegação e caminhos comuns',
      href: '/admin/analytics#journey',
      icon: Route,
    },
    {
      title: 'Funis de Conversão',
      description: 'Taxas de conversão e gargalos',
      href: '/admin/analytics#funnels',
      icon: TrendingDown,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-red-600" />
          <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
        </div>
        <p className="text-lg text-gray-600">
          Bem-vindo, <span className="font-semibold">{userName}</span> ({userEmail})
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Abertos</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.openTickets?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTickets ? `de ${stats.totalTickets} total` : 'Carregando...'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos (7 dias)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.totalEvents?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Eventos de tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.uniqueUsers?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos 7 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Ativo</div>
            <p className="text-xs text-muted-foreground">
              Sistema operacional
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Modules */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Módulos Principais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.id} href={module.href}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-lg ${module.color} text-white mb-2`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      {module.badge && (
                        <Badge variant={module.badgeVariant} className="ml-auto">
                          {module.badge}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="group-hover:text-primary transition-colors">
                      {module.title}
                    </CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-primary font-medium group-hover:gap-2 transition-all">
                      Acessar
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Analytics Quick Access */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Acesso Rápido - Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {analyticsFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.title} href={feature.href}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                        <Icon className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-base group-hover:text-primary transition-colors">
                        {feature.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Informações</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>O tracking de eventos está <strong>desabilitado</strong> para usuários admin</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Os dados de analytics incluem usuários <strong>Premium, Gratuitos e Anônimos</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Use o filtro por email para analisar usuários específicos</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

