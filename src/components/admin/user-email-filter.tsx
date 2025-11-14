/**
 * Componente para filtrar analytics por email de usuário
 */

'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Search, User } from 'lucide-react';

interface UserEmailFilterProps {
  onUserChange: (userId: string | null) => void;
  className?: string;
}

export function UserEmailFilter({ onUserChange, className }: UserEmailFilterProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!email.trim()) {
      // Limpar filtro
      setCurrentUserEmail(null);
      onUserChange(null);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/analytics/user-by-email?email=${encodeURIComponent(email.trim())}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Usuário não encontrado');
        }
        throw new Error('Erro ao buscar usuário');
      }

      const data = await response.json();
      
      if (data.userId) {
        setCurrentUserEmail(data.email);
        onUserChange(data.userId);
      } else {
        throw new Error('Usuário não encontrado');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setCurrentUserEmail(null);
      onUserChange(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setEmail('');
    setCurrentUserEmail(null);
    setError(null);
    onUserChange(null);
  };

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="email"
            placeholder="Filtrar por email do usuário..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-10"
            disabled={loading}
          />
          {email && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button 
          onClick={handleSearch} 
          size="sm"
          disabled={loading}
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {currentUserEmail && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <User className="w-3 h-3" />
            Filtrando por: {currentUserEmail}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 px-2"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

