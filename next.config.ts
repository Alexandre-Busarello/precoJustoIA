import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
