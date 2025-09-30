import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AuthProvider from "@/providers/session-provider";
import Header from "@/components/header";
import { StructuredData } from "@/components/structured-data";
import { SessionRefreshProvider } from "@/components/session-refresh-provider";
import { AlfaProvider } from "@/contexts/alfa-context";
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
    default: "Preço Justo AI - Análise Fundamentalista de Ações B3 com IA",
    template: "%s | Preço Justo AI - Análise Fundamentalista Ações B3"
  },
  description: "🚀 Plataforma completa de análise fundamentalista com IA para ações da B3/Bovespa. Encontre ações subvalorizadas usando modelos consagrados: Graham, Dividend Yield, Fórmula Mágica + 5 estratégias. Rankings gratuitos, comparador e preço justo de +350 empresas.",
  keywords: "análise fundamentalista ações, ações B3, bovespa investimentos, como investir em ações, melhores ações B3, valuation ações, preço justo ações, dividend yield, fórmula mágica greenblatt, benjamin graham, ranking ações bovespa, comparador ações B3, investir bolsa valores, ações subvalorizadas, análise técnica fundamentalista",
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
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
    ],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://precojusto.ai',
    siteName: 'Preço Justo AI',
    title: 'Preço Justo AI - Análise Fundamentalista de Ações B3 com IA',
    description: '🚀 Plataforma completa de análise fundamentalista com IA para ações da B3/Bovespa. Encontre ações subvalorizadas usando modelos consagrados: Graham, Dividend Yield, Fórmula Mágica + 5 estratégias.',
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
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <StructuredData type="website" />
        <StructuredData type="organization" />
        <StructuredData type="product" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-G7T3PKSEY4"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-G7T3PKSEY4');
          `}
        </Script>
        <AuthProvider>
          <SessionRefreshProvider>
            <AlfaProvider>
              <div className="min-h-screen bg-background">
                <Header />
                <main>
                  {children}
                </main>
                <AdminLink />
              </div>
              <Toaster position="top-right" />
            </AlfaProvider>
          </SessionRefreshProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
