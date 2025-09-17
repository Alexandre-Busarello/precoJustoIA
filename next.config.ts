import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
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
