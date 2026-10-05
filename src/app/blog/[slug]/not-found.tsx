import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function BlogPostNotFound() {
  return (
    <div className="bg-background">
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Artigo não encontrado</h1>
        <p className="mt-2 text-base text-muted-foreground">O artigo que você procura não existe ou foi removido.</p>
        <Button className="mt-6" asChild>
          <Link href="/blog">Ver todos os artigos</Link>
        </Button>
      </div>
    </div>
  )
}
