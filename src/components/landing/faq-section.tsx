import { cn } from "@/lib/utils"

interface FAQItem {
  question: string
  answer: string
  /** @deprecated Os itens não exibem mais ícones. */
  iconName?: string
  /** @deprecated Os itens não exibem mais ícones. */
  iconColorClass?: string
}

interface FAQSectionProps {
  title?: string
  description?: string
  faqs: FAQItem[]
  className?: string
  id?: string
}

/** Perguntas frequentes em acordeão nativo (`<details>`), todas fechadas por padrão. */
export function FAQSection({
  title = "Perguntas frequentes",
  description,
  faqs,
  className,
  id,
}: FAQSectionProps) {
  return (
    <section id={id} data-faq-section className={cn("bg-background py-16 sm:py-20", className)}>
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-base text-muted-foreground">{description}</p>}

        <div className="mt-8 divide-y divide-border border-y border-border">
          {faqs.map((faq) => (
            <details key={faq.question} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-medium text-foreground marker:content-none hover:text-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {faq.question}
                <span aria-hidden="true" className="w-4 shrink-0 text-center text-lg leading-none text-muted-foreground">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <p className="max-w-[68ch] pb-5 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
