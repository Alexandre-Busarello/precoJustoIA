/**
 * Hook para verificar se o usuário atual é admin
 * Usado para desabilitar tracking de admins
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function useAdminStatus() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (status === 'loading' || !session?.user?.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/admin/check');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin || false);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Erro ao verificar status de admin:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [session, status]);

  return { isAdmin, loading };
}

