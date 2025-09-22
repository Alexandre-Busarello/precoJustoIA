import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/providers/session-provider";
import Header from "@/components/header";
import { StructuredData } from "@/components/structured-data";
import { SessionRefreshProvider } from "@/components/session-refresh-provider";
import { Toaster } from "sonner";
import AdminLink from "@/components/admin-link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Preço Justo AI - Análise Fundamentalista com IA",
    template: "%s | Preço Justo AI"
  },
  description: "Plataforma completa de análise fundamentalista com IA para ações da B3. Encontre ações subvalorizadas usando modelos consagrados de valuation como Graham, Dividend Yield e Fórmula Mágica.",
  keywords: "análise fundamentalista, ações B3, bovespa, investimentos, valuation, Graham, dividend yield, fórmula mágica, IA, inteligência artificial, ranking ações, comparador ações",
  authors: [{ name: "Preço Justo AI" }],
  creator: "Preço Justo AI",
  publisher: "Preço Justo AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://precojusto.ai'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://precojusto.ai',
    siteName: 'Preço Justo AI',
    title: 'Preço Justo AI - Análise Fundamentalista com IA',
    description: 'Plataforma completa de análise fundamentalista com IA para ações da B3. Encontre ações subvalorizadas usando modelos consagrados de valuation.',
    images: [
      {
        url: '/logo-preco-justo.png',
        width: 1200,
        height: 630,
        alt: 'Preço Justo AI - Análise Fundamentalista com IA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Preço Justo AI - Análise Fundamentalista com IA',
    description: 'Plataforma completa de análise fundamentalista com IA para ações da B3.',
    images: ['/logo-preco-justo.png'],
    creator: '@PrecoJustoAI',
    site: '@PrecoJustoAI',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code', // Substitua pelo seu código do Google Search Console
  },
  category: 'finance',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <StructuredData type="website" />
        <StructuredData type="organization" />
        <StructuredData type="product" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <SessionRefreshProvider>
            <div className="min-h-screen bg-background">
              <Header />
              <main>
                {children}
              </main>
              <AdminLink />
            </div>
            <Toaster position="top-right" />
          </SessionRefreshProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
