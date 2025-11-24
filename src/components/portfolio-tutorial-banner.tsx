'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, PlayCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const BANNER_DISMISSED_KEY = 'portfolio-tutorial-banner-dismissed';

export function PortfolioTutorialBanner() {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    setIsDismissed(dismissed === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setIsDismissed(true);
  };

  const handleLearnMore = () => {
    router.push('/carteira/tutorial');
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-4">
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Aprenda a trazer seus dados históricos da B3 em 5 minutos
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                Importe suas transações de forma rápida e fácil usando nossa ferramenta inteligente
              </p>
              <Button
                onClick={handleLearnMore}
                size="sm"
                variant="default"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Ver Tutorial
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="flex-shrink-0 h-8 w-8 p-0 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

