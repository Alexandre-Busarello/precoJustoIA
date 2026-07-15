'use client';

import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface BacktestLoadingOverlayProps {
  title: string;
  description?: string;
}

/**
 * Overlay fullscreen de loading, compartilhado entre as telas de backtest
 * (config form, page client, histórico) para evitar duplicação visual.
 */
export function BacktestLoadingOverlay({ title, description }: BacktestLoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm sm:max-w-md shadow-2xl mb-0">
        <CardContent className="p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
            <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <BarChart3 className="absolute inset-0 m-auto w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              {title}
            </h3>
            {description && (
              <p className="text-xs sm:text-sm text-muted-foreground px-2">
                {description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
