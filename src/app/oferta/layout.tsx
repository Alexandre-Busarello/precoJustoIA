import Link from "next/link"
import Image from "next/image"

export default function OfertaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Header Minimalista - Apenas Logo Centralizado */}
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-center">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image 
                src="/logo-preco-justo.png" 
                alt="Preço Justo AI" 
                width={553}
                height={135}
                style={{ width: 'auto' }}
                className="h-12 sm:h-16 w-auto max-w-[200px] sm:max-w-[250px]"
              />
            </Link>
          </div>
        </div>
      </header>
      {children}
    </>
  )
}




