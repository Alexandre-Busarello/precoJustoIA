'use client';

import { ReactNode } from 'react';
import { Crown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface BlurCardProps {
  children: ReactNode;
  title?: string;
  isLoggedIn?: boolean;
  className?: string;
}

export function BlurCard({ children, title, isLoggedIn, className = '' }: BlurCardProps) {
  const { data: session } = useSession();
  const userIsLoggedIn = isLoggedIn ?? !!session;

  return (
    <div className={`relative ${className}`}>
      {/* Conteúdo com blur */}
      <div className="filter blur-sm pointer-events-none select-none">
        {children}
      </div>

      {/* Overlay para Premium/Login */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[2px] rounded-lg border border-dashed border-orange-300 dark:border-orange-700">
        <Crown className="w-6 h-6 text-orange-600 dark:text-orange-400 mb-2" />
        {title && (
          <p className="text-xs font-medium text-muted-foreground mb-1 text-center px-2">
            {title}
          </p>
        )}
        <p className="text-xs text-muted-foreground mb-2 text-center px-2">
          {userIsLoggedIn ? 'Upgrade para ver dados completos' : 'Faça login para ver dados completos'}
        </p>
        <Button asChild size="sm" variant="outline" className="text-xs">
          <Link href={userIsLoggedIn ? '/checkout' : '/register'}>
            {userIsLoggedIn ? 'Upgrade Premium' : 'Cadastre-se Grátis'}
          </Link>
        </Button>
      </div>
    </div>
  );
}

interface BlurValueProps {
  value: string | number;
  label: string;
  className?: string;
}

export function BlurValue({ value, label, className = '' }: BlurValueProps) {
  return (
    <div className={`text-center ${className}`}>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <div className="relative">
        <p className="text-2xl font-bold text-blue-600 blur-sm select-none">
          {typeof value === 'number' ? value.toFixed(2) : value}
        </p>
        <div className="absolute inset-0 flex items-center justify-center">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

