import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  CheckCircle, 
  Target 
} from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Logo e Descrição */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold">Preço Justo AI</h3>
            </div>
            <p className="text-gray-300 mb-6 max-w-md leading-relaxed">
              A plataforma mais completa de análise fundamentalista de ações da B3. 
              Encontre oportunidades de investimento com inteligência artificial e 
              modelos de valuation consagrados.
            </p>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-green-400 border-green-400">
                <CheckCircle className="w-3 h-3 mr-1" />
                +300 empresas
              </Badge>
              <Badge variant="outline" className="text-blue-400 border-blue-400">
                <Brain className="w-3 h-3 mr-1" />
                IA Integrada
              </Badge>
            </div>
          </div>

          {/* Produto */}
          <div>
            <h4 className="text-lg font-bold mb-4">Produto</h4>
            <ul className="space-y-3 text-gray-300">
              <li>
                <Link href="/ranking" className="hover:text-blue-400 transition-colors">
                  Rankings de Ações
                </Link>
              </li>
              <li>
                <Link href="/comparador" className="hover:text-blue-400 transition-colors">
                  Comparador de Ações
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-blue-400 transition-colors">
                  Dashboard Premium
                </Link>
              </li>
              <li>
                <Link href="/backtest" className="hover:text-blue-400 transition-colors">
                  🚀 Backtesting
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-blue-400 transition-colors">
                  Análise com IA
                </Link>
              </li>
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h4 className="text-lg font-bold mb-4">Recursos</h4>
            <ul className="space-y-3 text-gray-300">
              <li>
                <Link href="/metodologia" className="hover:text-blue-400 transition-colors">
                  Modelos de Valuation
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-blue-400 transition-colors">
                  Análise Fundamentalista
                </Link>
              </li>
              <li>
                <Link href="/metodologia#dividend-yield" className="hover:text-blue-400 transition-colors">
                  Dividend Yield
                </Link>
              </li>
              <li>
                <Link href="/metodologia#formula-magica" className="hover:text-blue-400 transition-colors">
                  Fórmula Mágica
                </Link>
              </li>
              <li>
                <Link href="/backtesting-carteiras" className="hover:text-blue-400 transition-colors">
                  🚀 Backtesting Carteiras
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Empresa */}
          <div>
            <h4 className="text-lg font-bold mb-4">Empresa</h4>
            <ul className="space-y-3 text-gray-300">
              <li>
                <Link href="/sobre" className="hover:text-blue-400 transition-colors">
                  Sobre Nós
                </Link>
              </li>
              <li>
                <Link href="/fundador" className="hover:text-blue-400 transition-colors">
                  Fundador & CEO
                </Link>
              </li>
              <li>
                <Link href="/como-funciona" className="hover:text-blue-400 transition-colors">
                  Como Funciona
                </Link>
              </li>
              <li>
                <Link href="/metodologia" className="hover:text-blue-400 transition-colors">
                  Metodologia
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-blue-400 transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Suporte */}
          <div>
            <h4 className="text-lg font-bold mb-4">Suporte</h4>
            <ul className="space-y-3 text-gray-300">
              <li>
                <Link href="/contato#faq" className="hover:text-blue-400 transition-colors">
                  Central de Ajuda
                </Link>
              </li>
              <li>
                <Link href="/contato" className="hover:text-blue-400 transition-colors">
                  Contato
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-blue-400 transition-colors">
                  Status da Plataforma
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-lg font-bold mb-4">Legal</h4>
            <ul className="space-y-3 text-gray-300">
              <li>
                <Link href="/termos-de-uso" className="hover:text-blue-400 transition-colors">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link href="/lgpd" className="hover:text-blue-400 transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-blue-400 transition-colors">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/lgpd" className="hover:text-blue-400 transition-colors">
                  LGPD
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer Importante */}
        <div className="border-t border-gray-700 pt-8 mb-8">
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Target className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0" />
              <div>
                <h5 className="font-bold text-yellow-400 mb-2">⚠️ Aviso Importante</h5>
                <p className="text-sm text-gray-300 leading-relaxed">
                  <strong>Esta plataforma é uma ferramenta de apoio à decisão de investimento.</strong> 
                  Não oferecemos consultoria financeira ou recomendações de compra/venda. 
                  Todos os investimentos envolvem riscos e a rentabilidade passada não garante 
                  resultados futuros. Sempre consulte um profissional qualificado e faça sua 
                  própria análise antes de investir.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-gray-400 text-sm">
            © 2025 Preço Justo AI. Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <span>Dados fornecidos pela BRAPI</span>
            <span>•</span>
            <span>Powered by Google Gemini AI</span>
            <span>•</span>
            <span>Feito com ❤️ no Brasil</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
