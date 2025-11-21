import { Badge } from "@/components/ui/badge"
import { 
  BookOpen, 
  TrendingUp, 
  Users,
  Award,
} from "lucide-react"
import { getAllPosts, getCategoryCounts, getFeaturedPost } from "@/lib/blog-service"
import { BlogClient } from "./blog-client"

export const metadata = {
  title: "Blog de Análise Fundamentalista | Preço Justo AI",
  description: "Artigos completos sobre estratégias de investimento, análise de empresas e como usar nossa plataforma para encontrar as melhores oportunidades na B3.",
}

export default async function BlogPage() {
  // Carregar dados do servidor
  const allPosts = await getAllPosts()
  const categories = await getCategoryCounts()
  const featuredPost = await getFeaturedPost()

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <BookOpen className="w-4 h-4" />
              Blog Educativo
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Aprenda{" "}
              <span className="text-blue-600">Análise Fundamentalista</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Artigos completos sobre estratégias de investimento, análise de empresas 
              e como usar nossa plataforma para encontrar as melhores oportunidades na B3.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <Badge variant="outline" className="text-green-600 border-green-600 px-4 py-2">
                <Award className="w-4 h-4 mr-2" />
                Conteúdo Especializado
              </Badge>
              <Badge variant="outline" className="text-blue-600 border-blue-600 px-4 py-2">
                <Users className="w-4 h-4 mr-2" />
                Para Todos os Níveis
              </Badge>
              <Badge variant="outline" className="text-purple-600 border-purple-600 px-4 py-2">
                <TrendingUp className="w-4 h-4 mr-2" />
                Sempre Atualizado
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Client Component com interatividade */}
      <BlogClient 
        allPosts={allPosts}
        categories={categories}
        featuredPost={featuredPost}
      />
    </div>
  )
}
