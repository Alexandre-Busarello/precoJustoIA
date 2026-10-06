import { Metadata } from "next"
import Link from "next/link"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"

export const metadata: Metadata = {
  title: "Política de privacidade (LGPD)",
  description:
    "Como o Preço Justo AI trata seus dados pessoais conforme a LGPD: dados coletados, finalidades, bases legais, compartilhamento, retenção, cookies e seus direitos como titular.",
  keywords: "LGPD, lei geral de proteção de dados, privacidade, dados pessoais, preço justo ai, direitos do titular",
  alternates: {
    canonical: "/lgpd",
  },
  robots: {
    index: true,
    follow: true,
  },
}

/** Tipografia de documento legal: prosa 68ch, títulos na escala reduzida e listas com marcadores neutros. */
const PROSE =
  "space-y-4 text-base leading-7 text-foreground [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:marker:text-muted-foreground [&_a]:text-brand [&_a]:underline-offset-4 hover:[&_a]:underline [&_dt]:font-medium [&_dd]:text-muted-foreground"

export default function LGPDPage() {
  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-10">
        <article className="mx-auto max-w-[68ch]">
          <Breadcrumbs items={[{ label: "Política de privacidade" }]} />
          <header className="space-y-2 border-b border-border pb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Política de privacidade</h1>
            <p className="text-base text-muted-foreground">
              Como o Preço Justo AI protege sua privacidade e cumpre a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
            </p>
            <p className="text-sm text-muted-foreground">Versão 1.0 · em vigor desde 1º de janeiro de 2025</p>
          </header>

          <div className={`mt-6 ${PROSE}`}>
            <h2 id="controlador">1. Controlador dos dados</h2>
            <p>
              Preço Justo AI. E-mail para questões de privacidade:{" "}
              <a href="mailto:privacidade@precojusto.ai">privacidade@precojusto.ai</a>.
            </p>

            <h2 id="dados-coletados">2. Quais dados coletamos</h2>
            <h3>Dados de identificação</h3>
            <ul>
              <li>Nome completo</li>
              <li>Endereço de e-mail</li>
              <li>Senha (criptografada)</li>
              <li>Data de cadastro</li>
            </ul>
            <h3>Dados de uso</h3>
            <ul>
              <li>Histórico de navegação na plataforma</li>
              <li>Ações pesquisadas e analisadas</li>
              <li>Configurações de preferências</li>
              <li>Dados de sessão e cookies</li>
            </ul>
            <h3>Dados técnicos</h3>
            <ul>
              <li>Endereço IP (anonimizado)</li>
              <li>Tipo de navegador e dispositivo</li>
              <li>Logs de acesso e segurança</li>
              <li>Dados de performance da plataforma</li>
            </ul>
            <h3>Dados de pagamento</h3>
            <ul>
              <li>Histórico de assinaturas</li>
              <li>Status de pagamento</li>
              <li>Dados de cartão processados pelo Stripe</li>
              <li>Faturas e recibos</li>
            </ul>

            <h2 id="uso">3. Como utilizamos seus dados</h2>
            <dl className="space-y-4">
              <div>
                <dt>Prestação de serviços</dt>
                <dd>
                  Fornecer análises fundamentalistas, rankings de ações, comparações e demais funcionalidades da plataforma. Base
                  legal: execução de contrato.
                </dd>
              </div>
              <div>
                <dt>Melhoria da plataforma</dt>
                <dd>
                  Analisar padrões de uso para melhorar a experiência do usuário, desenvolver novas funcionalidades e otimizar a
                  performance. Base legal: interesse legítimo.
                </dd>
              </div>
              <div>
                <dt>Comunicação</dt>
                <dd>
                  Enviar comunicações importantes sobre sua conta, atualizações de serviço e, com seu consentimento, newsletters
                  educativas sobre investimentos. Base legal: consentimento e interesse legítimo.
                </dd>
              </div>
              <div>
                <dt>Segurança e conformidade</dt>
                <dd>
                  Garantir a segurança da plataforma, prevenir fraudes e cumprir obrigações legais e regulatórias. Base legal:
                  obrigação legal e interesse legítimo.
                </dd>
              </div>
            </dl>

            <h2 id="direitos">4. Seus direitos como titular</h2>
            <ul>
              <li>Acesso: confirmar a existência de tratamento e acessar seus dados pessoais.</li>
              <li>Correção: corrigir dados incompletos, inexatos ou desatualizados.</li>
              <li>Eliminação: solicitar a eliminação de dados desnecessários ou tratados em desconformidade.</li>
              <li>Portabilidade: solicitar a portabilidade dos dados a outro fornecedor de serviço.</li>
              <li>Oposição: opor-se ao tratamento realizado com base no interesse legítimo.</li>
              <li>Informação: obter informações sobre compartilhamento de dados com terceiros.</li>
            </ul>
            <p>
              Para exercer qualquer um desses direitos, escreva para{" "}
              <a href="mailto:privacidade@precojusto.ai">privacidade@precojusto.ai</a>. Respondemos em até 15 dias úteis.
            </p>

            <h2 id="seguranca">5. Medidas de segurança</h2>
            <ul>
              <li>Criptografia: dados criptografados em trânsito (HTTPS/TLS) e em repouso.</li>
              <li>Controle de acesso: acesso restrito aos dados apenas para pessoas autorizadas.</li>
              <li>Monitoramento: logs de auditoria e monitoramento contínuo de segurança.</li>
              <li>Infraestrutura: hospedagem em provedores certificados (Vercel, PlanetScale).</li>
            </ul>

            <h2 id="retencao">6. Retenção de dados</h2>
            <ul>
              <li>Dados de conta: mantidos enquanto a conta estiver ativa e por 5 anos após a inativação.</li>
              <li>Dados de uso: logs de acesso por 6 meses e dados analíticos por 2 anos.</li>
              <li>Dados financeiros: mantidos por 5 anos conforme a legislação fiscal brasileira.</li>
              <li>Exclusão de conta: dados pessoais excluídos em até 30 dias após a solicitação.</li>
            </ul>

            <h2 id="compartilhamento">7. Compartilhamento de dados</h2>
            <p>
              Nunca vendemos, alugamos ou comercializamos seus dados pessoais. O compartilhamento ocorre apenas nas situações
              descritas abaixo, sempre com finalidades legítimas e transparentes.
            </p>
            <h3>Prestadores de serviço</h3>
            <ul>
              <li>Stripe: processamento de pagamentos e assinaturas.</li>
              <li>Provedores de e-mail: envio de comunicações transacionais e newsletters.</li>
              <li>Hospedagem: Vercel (aplicação) e PlanetScale (banco de dados).</li>
              <li>Analytics: dados anonimizados para análise de uso da plataforma.</li>
            </ul>
            <h3>Obrigações legais</h3>
            <p>Podemos compartilhar dados quando exigido por lei, ordem judicial ou autoridade competente:</p>
            <ul>
              <li>Cumprimento de decisões judiciais</li>
              <li>Atendimento a autoridades regulatórias</li>
              <li>Investigações de fraude ou atividades ilegais</li>
            </ul>

            <h2 id="cookies">8. Cookies e tecnologias similares</h2>
            <ul>
              <li>Essenciais, necessários para o funcionamento básico: autenticação, sessões de login e configurações de segurança.</li>
              <li>Analíticos, para entender como a plataforma é usada: páginas mais visitadas, tempo de permanência e funcionalidades utilizadas.</li>
              <li>Funcionais, para melhorar sua experiência: preferências de tema, configurações salvas e histórico de pesquisas.</li>
            </ul>
            <p>
              Você pode gerenciar suas preferências de cookies nas configurações do seu navegador. Desabilitar cookies essenciais
              pode afetar o funcionamento da plataforma.
            </p>

            <h2 id="alteracoes">9. Alterações nesta política</h2>
            <p>
              Esta política pode ser atualizada periodicamente para refletir mudanças em nossas práticas ou na legislação.
              Notificaremos sobre alterações significativas pelo e-mail cadastrado e/ou por aviso na plataforma.
            </p>

            <h2 id="duvidas">10. Dúvidas</h2>
            <p>
              Escreva para <a href="mailto:privacidade@precojusto.ai">privacidade@precojusto.ai</a> ou use a página de{" "}
              <Link href="/contato">contato</Link>. Veja também os <Link href="/termos-de-uso">Termos de uso</Link>.
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}
