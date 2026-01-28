import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

export function SlimFooter() {
  return (
    <footer className="bg-gray-900 text-white py-8 sm:py-12">
      <div className="container mx-auto px-4">
        {/* Links Legais e Confiança - Centralizados */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Link 
            href="/termos-de-uso" 
            className="text-gray-300 hover:text-blue-400 transition-colors text-sm sm:text-base"
          >
            Termos de Uso
          </Link>
          <span className="hidden sm:inline text-gray-600">•</span>
          <Link 
            href="/lgpd" 
            className="text-gray-300 hover:text-blue-400 transition-colors text-sm sm:text-base"
          >
            Política de Privacidade (LGPD)
          </Link>
          <span className="hidden sm:inline text-gray-600">•</span>
          <a 
            href="https://wa.me/5521979155962" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-green-400 transition-colors text-sm sm:text-base flex items-center gap-1.5"
          >
            <MessageCircle className="w-4 h-4" />
            Contato / Suporte
          </a>
        </div>

        {/* Disclaimer Importante */}
        <div className="border-t border-gray-700 pt-6 mb-6">
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 sm:p-6 max-w-4xl mx-auto">
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed text-center">
              <strong className="text-yellow-400">⚠️ Aviso Importante:</strong> Esta plataforma é uma ferramenta de apoio à decisão de investimento. 
              Não oferecemos consultoria financeira ou recomendações de compra/venda. Todos os investimentos envolvem riscos e a rentabilidade passada não garante resultados futuros.
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 pt-6 text-center">
          <div className="text-gray-400 text-xs sm:text-sm mb-2">
            © 2025 Preço Justo AI. Todos os direitos reservados.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-gray-500">
            <span>Dados fornecidos pela BRAPI</span>
            <span className="hidden sm:inline">•</span>
            <span>Powered by Google Gemini AI</span>
            <span className="hidden sm:inline">•</span>
            <span>Feito com ❤️ no Brasil</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

