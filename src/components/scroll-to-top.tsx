"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Componente que força scroll para o topo da página em toda navegação
 * Monitora mudanças no pathname e executa scrollToTop automaticamente
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // Scroll para o topo de forma suave
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant", // "instant" é mais rápido, use "smooth" para suavizar
    });
  }, [pathname]); // Executa sempre que o pathname mudar

  return null; // Componente não renderiza nada visualmente
}
