import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AuthProvider from "@/providers/session-provider";
import { QueryProvider } from "@/providers/query-provider";
import Header from "@/components/header";
import { StructuredData } from "@/components/structured-data";
import { SessionRefreshProvider } from "@/components/session-refresh-provider";
import AdminLink from "@/components/admin-link";
import { ScrollToTop } from "@/components/scroll-to-top";
import { LastLoginUpdater } from "@/components/last-login-updater";
import { TrackingProvider } from "@/components/tracking-provider";
import { OnboardingProvider } from "@/components/onboarding-provider";
import { ExitIntentProvider } from "@/components/exit-intent-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { AppToaster } from "@/components/app-toaster";
import { ShellProvider } from "@/components/shell-context";
import { SiteFooter } from "@/components/footer";
import { BenChatFAB } from "@/components/ben-chat-fab";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { CacheCleanupOnLogin } from "@/components/cache-cleanup-on-login";
import { GoogleAdsConversionPixel } from "@/components/google-ads-conversion-pixel";
import { MicrosoftClarity } from "@/components/microsoft-clarity";
import { OAuthNewUserHandler } from "@/components/oauth-new-user-handler";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://precojusto.ai'),
  title: {
    default: "Preço Justo AI - Análise Fundamentalista de Ações B3 com IA",
    template: "%s | Preço Justo AI"
  },
  description: "Análise fundamentalista gratuita de ações B3 com IA. Modelos consagrados: Graham, Método Barsi, Fórmula Mágica + 5 estratégias. Rankings e comparador de +500 empresas.",
  keywords: "análise fundamentalista ações, ações B3, bovespa investimentos, como investir em ações, melhores ações B3, valuation ações, preço justo ações, dividend yield, fórmula mágica greenblatt, benjamin graham, ranking ações bovespa, comparador ações B3, investir bolsa valores, ações subvalorizadas, análise técnica fundamentalista",
  authors: [{ name: "Preço Justo AI" }],
  creator: "Preço Justo AI",
  publisher: "Preço Justo AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        type: 'image/x-icon',
        sizes: 'any',
      },
    ],
    shortcut: '/favicon.ico',
    apple: [
      {
        url: '/favicon.ico',
        sizes: '180x180',
      },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://precojusto.ai',
    siteName: 'Preço Justo AI',
    title: 'Preço Justo AI - Análise Fundamentalista de Ações B3 com IA',
    description: 'Análise fundamentalista gratuita de ações B3 com IA. Modelos consagrados: Graham, Método Barsi, Fórmula Mágica + 5 estratégias. Rankings e comparador de +500 empresas.',
    images: [
      {
        url: 'https://precojusto.ai/logo-preco-justo.png',
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0f12' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Favicon explícito para máxima compatibilidade com Google */}
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/favicon.ico" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <StructuredData type="website" />
        <StructuredData type="organization" />
        <StructuredData type="product" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        {/* Google Analytics & Google Ads */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-G7T3PKSEY4"
          strategy="afterInteractive"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17611977676"
          strategy="afterInteractive"
        />
        <Script id="google-tags" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-G7T3PKSEY4');
            gtag('config', 'AW-17611977676');
          `}
        </Script>
        {/* Microsoft Clarity - Mapa de Calor Gratuito */}
        <MicrosoftClarity />
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <SessionRefreshProvider>
                <TrackingProvider>
                  <ShellProvider>
                    <CacheCleanupOnLogin />
                    <LastLoginUpdater />
                    <OnboardingProvider />
                    <ExitIntentProvider />
                    <ScrollToTop />
                    <Suspense fallback={null}>
                      <OAuthNewUserHandler />
                      <GoogleAdsConversionPixel />
                    </Suspense>
                    <div className="flex min-h-dvh flex-col">
                      {/* Header não é exibido em /oferta e /parceiros (layout próprio) */}
                      <Header />
                      <main className="flex-1">
                        {children}
                      </main>
                      <SiteFooter />
                    </div>
                    <AdminLink />
                    <BenChatFAB />
                    <MobileBottomNav />
                    <AppToaster />
                  </ShellProvider>
                </TrackingProvider>
              </SessionRefreshProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
