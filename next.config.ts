import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: false,
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
        pathname: '/**',
      },
    ],
  },
  // Configuração para Turbopack: excluir pacotes que usam módulos Node.js do bundle do cliente
  serverExternalPackages: [
    '@deno/shim-deno',
    'redis',
    '@redis/client',
    'yahoo-finance2',
  ],
  async redirects() {
    return [
      // {
      //   source: '/:ticker',
      //   destination: '/acao/:ticker',
      //   permanent: true, // 301 redirect para SEO
      // },
    ]
  },
};

export default nextConfig;
