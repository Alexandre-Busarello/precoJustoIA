'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { SectionHeader } from '@/components/ui/section-header';

interface Step {
  title: string;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Acesse a Área do Investidor da B3',
    body: (
      <>
        <p>
          Entre em{' '}
          <a
            href="https://www.investidor.b3.com.br/login"
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-brand underline-offset-4 hover:underline"
          >
            investidor.b3.com.br
          </a>{' '}
          com seu CPF e senha.
        </p>
      </>
    ),
  },
  {
    title: 'Abra os extratos de negociação',
    body: (
      <p>
        No menu lateral, vá em <strong className="font-medium text-foreground">Extratos</strong> e depois na aba{' '}
        <strong className="font-medium text-foreground">Negociação</strong>.
      </p>
    ),
  },
  {
    title: 'Escolha o período e baixe o Excel',
    body: (
      <ul className="list-inside list-disc space-y-1">
        <li>Selecione o período (de preferência desde o início dos seus investimentos).</li>
        <li>
          Clique em <strong className="font-medium text-foreground">Baixar</strong> e escolha o arquivo em Excel.
        </li>
      </ul>
    ),
  },
  {
    title: 'Copie o conteúdo da planilha',
    body: (
      <p>
        Abra o arquivo no Excel ou no Google Sheets e copie todas as linhas (Ctrl + C). Ele costuma ter colunas como
        data, tipo de movimentação, produto, quantidade, preço e valor.
      </p>
    ),
  },
  {
    title: 'Cole na sua carteira',
    body: (
      <ol className="list-inside list-decimal space-y-1">
        <li>
          Abra a carteira e expanda <strong className="font-medium text-foreground">Registrar transações</strong>.
        </li>
        <li>
          Na aba <strong className="font-medium text-foreground">Colar texto</strong>, cole o conteúdo copiado.
        </li>
        <li>
          Clique em <strong className="font-medium text-foreground">Identificar transações</strong>: a IA reconhece o
          formato da B3.
        </li>
      </ol>
    ),
  },
  {
    title: 'Revise e salve',
    body: (
      <p>
        Confira datas, quantidades e valores na lista identificada e clique em{' '}
        <strong className="font-medium text-foreground">Salvar</strong>. Transações já cadastradas são ignoradas, então
        você pode colar o mesmo extrato de novo sem duplicar.
      </p>
    ),
  },
];

const EXAMPLE = `Data,Produto,Tipo,Quantidade,Preço,Valor
01/01/2024,PETR4,Compra,100,32.50,3250.00
15/01/2024,VALE3,Compra,50,65.00,3250.00
01/02/2024,PETR4,Dividendo,100,0.25,25.00
15/02/2024,VALE3,Venda,25,68.00,1700.00`;

export function PortfolioTutorialPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[{ label: 'Carteiras', href: '/carteira' }, { label: 'Importar histórico' }]}
        title="Importar histórico da B3"
        description="Traga suas negociações da Área do Investidor para a carteira em cerca de 5 minutos."
      />

      <div className="mt-8 space-y-10">
        <section aria-labelledby="tutorial-video" className="space-y-4">
          <SectionHeader id="tutorial-video" title="Vídeo" />
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
            <iframe
              src="https://www.youtube.com/embed/NLRfHdcDZ_I"
              title="Como importar dados da B3 para a carteira"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="h-full w-full"
            />
          </div>
        </section>

        <section aria-labelledby="tutorial-steps" className="space-y-4">
          <SectionHeader id="tutorial-steps" title="Passo a passo" />
          <ol className="space-y-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 items-center justify-center rounded-full border border-border text-sm font-medium tabular-nums text-muted-foreground"
                >
                  {index + 1}
                </span>
                <div className="space-y-1.5">
                  <h3 className="text-base font-medium text-foreground">{step.title}</h3>
                  <div className="space-y-2 text-sm leading-6 text-muted-foreground">{step.body}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="tutorial-tips" className="space-y-4">
          <SectionHeader id="tutorial-tips" title="Dicas" />
          <ul className="list-inside list-disc space-y-2 text-sm leading-6 text-muted-foreground">
            <li>Exporte desde o início dos investimentos para ter o histórico completo e o preço médio correto.</li>
            <li>
              O extrato precisa ter data, tipo, ticker, quantidade e preço. O que faltar pode ser completado depois na aba
              Transações.
            </li>
            <li>Variações de nomes de colunas da B3 são reconhecidas automaticamente.</li>
          </ul>
        </section>

        <section aria-labelledby="tutorial-example" className="space-y-4">
          <SectionHeader
            id="tutorial-example"
            title="Exemplo de conteúdo"
            description="O formato pode variar; os campos principais são identificados automaticamente."
          />
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-5 text-foreground">
            {EXAMPLE}
          </pre>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pronto para importar</h2>
            <p className="text-sm text-muted-foreground">Abra uma carteira ou crie a primeira.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/carteira">Minhas carteiras</Link>
            </Button>
            <Button asChild>
              <Link href="/carteira/nova">Criar carteira</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
