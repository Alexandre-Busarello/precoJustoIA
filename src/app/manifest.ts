import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Preço Justo AI - Análise Fundamentalista com IA',
    short_name: 'Preço Justo AI',
    description: 'Plataforma completa de análise fundamentalista com IA para ações da B3. Encontre ações subvalorizadas usando modelos consagrados de valuation.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    orientation: 'portrait',
    categories: ['finance', 'business', 'productivity'],
    lang: 'pt-BR',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/logo-preco-justo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/logo-preco-justo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/logo-preco-justo.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Análise de Ações com IA'
      },
      {
        src: '/logo-preco-justo.png',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Ranking de Ações'
      }
    ],
    shortcuts: [
      {
        name: 'Ranking de Ações',
        short_name: 'Ranking',
        description: 'Veja o ranking das melhores ações',
        url: '/ranking',
        icons: [{ src: '/logo-preco-justo.png', sizes: '96x96' }]
      },
      {
        name: 'Comparador',
        short_name: 'Comparar',
        description: 'Compare ações lado a lado',
        url: '/comparador',
        icons: [{ src: '/logo-preco-justo.png', sizes: '96x96' }]
      },
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Acesse seu dashboard pessoal',
        url: '/dashboard',
        icons: [{ src: '/logo-preco-justo.png', sizes: '96x96' }]
      }
    ]
  }
}
