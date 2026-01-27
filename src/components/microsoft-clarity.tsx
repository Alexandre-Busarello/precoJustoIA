'use client';

import Script from 'next/script';

/**
 * Componente para integração do Microsoft Clarity
 * Ferramenta gratuita de análise de comportamento do usuário que oferece:
 * - Mapas de calor (heatmaps) de cliques, movimento do mouse e rolagem
 * - Gravações de sessão do usuário
 * - Insights de frustração e comportamento
 * 
 * O script é carregado apenas se NEXT_PUBLIC_CLARITY_PROJECT_ID estiver configurado.
 * Usa estratégia "afterInteractive" para não bloquear a renderização inicial.
 * 
 * Para obter o Project ID:
 * 1. Acesse https://clarity.microsoft.com
 * 2. Faça login com conta Microsoft (gratuito)
 * 3. Crie um novo projeto
 * 4. Copie o Project ID fornecido
 * 5. Configure NEXT_PUBLIC_CLARITY_PROJECT_ID nas variáveis de ambiente
 */
export function MicrosoftClarity() {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

  // Não renderizar se o ID não estiver configurado
  if (!clarityId) {
    return null;
  }

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${clarityId}");`}
    </Script>
  );
}

