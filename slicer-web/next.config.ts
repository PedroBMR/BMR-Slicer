import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      rules: {
        '*.ts': ['tsc --noEmit'],
        '*.tsx': ['tsc --noEmit']
      }
    }
  }
};

export default nextConfig;
