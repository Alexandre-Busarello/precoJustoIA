import { Metadata } from "next"
import Link from "next/link"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "Termos de uso do Preço Justo AI: condições de uso da plataforma de análise fundamentalista de ações da B3, direitos, responsabilidades e regras de assinatura.",
  keywords: "termos de uso, condições de uso, preço justo ai, análise fundamentalista, B3, responsabilidades",
  alternates: {
    canonical: "/termos-de-uso",
  },
  robots: {
    index: true,
    follow: true,
  },
}

/** Tipografia de documento legal: prosa 68ch, títulos na escala reduzida e listas com marcadores neutros. */
const PROSE =
  "space-y-4 text-base leading-7 text-foreground [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:marker:text-muted-foreground [&_a]:text-brand [&_a]:underline-offset-4 hover:[&_a]:underline"

export default function TermosDeUsoPage() {
  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-10">
        <article className="mx-auto max-w-[68ch]">
          <Breadcrumbs items={[{ label: "Termos de uso" }]} />
          <header className="space-y-2 border-b border-border pb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Termos de uso</h1>
            <p className="text-base text-muted-foreground">
              Condições para uso da plataforma Preço Justo AI e direitos e responsabilidades de usuários e da empresa.
            </p>
            <p className="text-sm text-muted-foreground">Versão 1.2 · vigência a partir de 1º de janeiro de 2025 · última atualização em 1º de outubro de 2025</p>
          </header>

          <div className={`mt-6 ${PROSE}`}>
            <h2 id="identificacao">1. Identificação</h2>
            <ul>
              <li>Plataforma: precojusto.ai</li>
              <li>
                E-mail de contato: <a href="mailto:contato@precojusto.ai">contato@precojusto.ai</a>
              </li>
              <li>
                Suporte: <a href="mailto:suporte@precojusto.ai">suporte@precojusto.ai</a>
              </li>
            </ul>

            <h2 id="aceitacao">2. Aceitação dos termos</h2>
            <p>
              Ao acessar e utilizar a plataforma Preço Justo AI, você concorda integralmente com estes Termos de Uso. Se você não
              concorda com qualquer parte destes termos, não deve utilizar nossos serviços.
            </p>
            <p>
              Estes termos constituem um acordo legal vinculativo entre você e o Preço Justo AI. Recomendamos a leitura completa
              antes do uso.
            </p>

            <h2 id="servicos">3. Serviços</h2>
            <h3>Recursos gratuitos</h3>
            <ul>
              <li>Rankings básicos de ações</li>
              <li>Análise fundamentalista limitada</li>
              <li>Comparação básica de ações</li>
              <li>Acesso a dados financeiros básicos</li>
            </ul>
            <h3>Recursos Premium</h3>
            <ul>
              <li>Todos os modelos de valuation disponíveis</li>
              <li>Análise com inteligência artificial</li>
              <li>Backtesting de estratégias</li>
              <li>Comparações ilimitadas</li>
              <li>Dashboard personalizado</li>
            </ul>
            <h3>Não somos consultoria financeira</h3>
            <p>
              O Preço Justo AI é uma ferramenta de apoio à decisão de investimento. Não oferecemos consultoria financeira,
              recomendações de compra ou venda nem garantias de rentabilidade. Todas as análises são baseadas em dados históricos e
              modelos matemáticos que não garantem resultados futuros.
            </p>

            <h2 id="conta">4. Cadastro e conta de usuário</h2>
            <h3>Requisitos para cadastro</h3>
            <ul>
              <li>Ser maior de 18 anos ou ter autorização dos responsáveis</li>
              <li>Fornecer informações verdadeiras e atualizadas</li>
              <li>Manter a confidencialidade das credenciais de acesso</li>
              <li>Aceitar estes Termos de Uso e a Política de Privacidade</li>
            </ul>
            <h3>Responsabilidades do usuário</h3>
            <ul>
              <li>Manter suas informações de conta atualizadas</li>
              <li>Não compartilhar credenciais de acesso com terceiros</li>
              <li>Notificar imediatamente sobre uso não autorizado da conta</li>
              <li>Usar a plataforma apenas para finalidades legítimas</li>
            </ul>
            <h3>Suspensão e encerramento</h3>
            <p>Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos, incluindo:</p>
            <ul>
              <li>Uso indevido da plataforma ou tentativas de fraude</li>
              <li>Compartilhamento não autorizado de credenciais</li>
              <li>Atividades que prejudiquem outros usuários ou a plataforma</li>
              <li>Inadimplência prolongada em assinaturas pagas</li>
            </ul>

            <h2 id="assinaturas">5. Assinaturas e pagamentos</h2>
            <h3>Planos de assinatura</h3>
            <ul>
              <li>Plano gratuito: acesso limitado aos recursos básicos</li>
              <li>Plano Premium: acesso completo a todos os recursos</li>
              <li>
                Preços e condições detalhadas disponíveis na página de <Link href="/planos">planos</Link>
              </li>
            </ul>
            <h3>Condições de pagamento</h3>
            <ul>
              <li>Pagamentos processados via Stripe (seguro e criptografado)</li>
              <li>Cobrança recorrente conforme periodicidade escolhida</li>
              <li>Preços em reais (BRL) incluindo impostos aplicáveis</li>
              <li>Faturas enviadas por e-mail após cada cobrança</li>
            </ul>
            <h3>Cancelamento e reembolso</h3>
            <ul>
              <li>Cancelamento pode ser feito a qualquer momento pelo usuário</li>
              <li>Acesso mantido até o final do período já pago</li>
              <li>Reembolsos conforme política específica e legislação aplicável</li>
              <li>Direito de arrependimento de 7 dias para novos usuários</li>
            </ul>

            <h2 id="uso">6. Uso adequado da plataforma</h2>
            <h3>Uso permitido</h3>
            <ul>
              <li>Análise pessoal de investimentos</li>
              <li>Pesquisa e educação financeira</li>
              <li>Comparação de ações da B3</li>
              <li>Uso dos recursos conforme plano contratado</li>
              <li>Compartilhamento de insights pessoais</li>
            </ul>
            <h3>Uso proibido</h3>
            <ul>
              <li>Revenda ou redistribuição de dados</li>
              <li>Uso automatizado (bots, scrapers)</li>
              <li>Tentativas de acesso não autorizado</li>
              <li>Compartilhamento de credenciais de conta</li>
              <li>Atividades que sobrecarreguem a plataforma</li>
            </ul>
            <h3>Consequências do uso inadequado</h3>
            <p>
              O uso inadequado da plataforma pode resultar em suspensão ou encerramento da conta, sem direito a reembolso, além de
              possíveis medidas legais cabíveis. Monitoramos o uso da plataforma para garantir conformidade com estes termos.
            </p>

            <h2 id="limitacoes">7. Limitações e avisos</h2>
            <h3>Aviso de risco de investimento</h3>
            <p>
              Todos os investimentos envolvem riscos. A rentabilidade passada não garante resultados futuros. As análises fornecidas
              são baseadas em dados históricos e modelos matemáticos que podem não refletir condições futuras do mercado.
            </p>
            <p>
              Não somos consultores financeiros. Nossas análises são ferramentas de apoio à decisão, não recomendações de
              investimento. Sempre consulte um profissional qualificado antes de tomar decisões de investimento.
            </p>
            <h3>Limitações de responsabilidade</h3>
            <ul>
              <li>Não garantimos precisão absoluta dos dados de terceiros</li>
              <li>Não nos responsabilizamos por decisões de investimento dos usuários</li>
              <li>Limitamos nossa responsabilidade ao valor pago pelos serviços</li>
              <li>Não garantimos disponibilidade integral da plataforma</li>
            </ul>
            <h3>Fontes de dados</h3>
            <p>Utilizamos dados de fontes reconhecidas, mas não controlamos sua precisão:</p>
            <ul>
              <li>BRAPI (dados financeiros e cotações)</li>
              <li>Fundamentus (indicadores fundamentalistas)</li>
              <li>Status Invest (dados complementares)</li>
              <li>Dados podem apresentar atrasos ou inconsistências</li>
            </ul>

            <h2 id="propriedade">8. Propriedade intelectual</h2>
            <p>
              Todo o conteúdo da plataforma Preço Justo AI, incluindo mas não limitado a textos, gráficos, logos, ícones, imagens,
              algoritmos, código-fonte e metodologias de análise, é propriedade exclusiva do Preço Justo AI ou de seus licenciadores.
            </p>
            <p>
              É proibida a reprodução, distribuição, modificação ou uso comercial de qualquer conteúdo da plataforma sem autorização
              expressa por escrito. O uso da plataforma não confere ao usuário qualquer direito de propriedade intelectual sobre o
              conteúdo.
            </p>
            <p>
              Respeitamos os direitos de propriedade intelectual de terceiros e esperamos que nossos usuários façam o mesmo. Caso
              identifique violação de direitos autorais, entre em contato conosco imediatamente.
            </p>

            <h2 id="lei">9. Lei aplicável e foro</h2>
            <p>
              Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil, incluindo mas não limitado ao Código de
              Defesa do Consumidor (Lei 8.078/90), Lei Geral de Proteção de Dados (Lei 13.709/18) e Marco Civil da Internet (Lei
              12.965/14).
            </p>
            <p>
              Todas as relações jurídicas decorrentes do uso da plataforma serão interpretadas conforme a legislação brasileira,
              independentemente de conflitos com leis de outros países.
            </p>
            <p>
              Para dirimir quaisquer controvérsias decorrentes destes Termos de Uso, fica eleito o foro da comarca onde o usuário
              possui domicílio, conforme estabelecido pelo Código de Defesa do Consumidor.
            </p>
            <p>
              Buscamos sempre resolver questões através de diálogo direto. Em caso de necessidade, também aceitamos mediação e
              arbitragem como métodos alternativos de resolução de conflitos.
            </p>

            <h2 id="alteracoes">10. Alterações nos termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. Alterações significativas serão
              comunicadas através de e-mail e/ou aviso na plataforma com antecedência mínima de 30 dias.
            </p>
            <p>
              O uso continuado da plataforma após as alterações constitui aceitação dos novos termos. Caso não concorde com as
              modificações, você pode cancelar sua conta a qualquer momento.
            </p>

            <h2 id="duvidas">11. Dúvidas</h2>
            <p>
              Escreva para <a href="mailto:suporte@precojusto.ai">suporte@precojusto.ai</a> ou use a página de{" "}
              <Link href="/contato">contato</Link>. Veja também a <Link href="/lgpd">Política de privacidade</Link>.
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}
