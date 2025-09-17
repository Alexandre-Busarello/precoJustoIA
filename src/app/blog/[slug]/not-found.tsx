import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, ArrowLeft, Search } from "lucide-react"
import Link from "next/link"

export default function BlogPostNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="border-0 shadow-xl">
              <CardContent className="p-12">
                <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-8">
                  <BookOpen className="w-12 h-12 text-blue-600" />
                </div>
                
                <h1 className="text-3xl sm:text-4xl font-bold mb-4">
                  Artigo Não Encontrado
                </h1>
                
                <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                  O artigo que você está procurando não existe ou foi removido. 
                  Que tal explorar outros conteúdos do nosso blog?
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700" asChild>
                    <Link href="/blog" className="flex items-center gap-2">
                      <ArrowLeft className="w-5 h-5" />
                      Voltar ao Blog
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link href="/blog" className="flex items-center gap-2">
                      <Search className="w-5 h-5" />
                      Explorar Artigos
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
