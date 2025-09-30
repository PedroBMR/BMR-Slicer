import type { NextConfig } from 'next';
import type { RuntimeCaching } from 'next-pwa';
import withPWA from 'next-pwa';

const runtimeCaching: RuntimeCaching[] = [
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api-cache',
      networkTimeoutSeconds: 10,
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 5 * 60
      },
      cacheableResponse: {
        statuses: [0, 200]
      }
    }
  },
  {
    urlPattern: /\/.*\.(?:stl|obj|ply|gltf|glb|zip)$/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'geometry-files',
      expiration: {
        maxEntries: 30,
        maxAgeSeconds: 7 * 24 * 60 * 60
      },
      cacheableResponse: {
        statuses: [0, 200]
      }
    }
  }
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      rules: {
        '*.ts': ['tsc --noEmit'],
        '*.tsx': ['tsc --noEmit']
      }
    }
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'three/addons/loaders/BufferGeometryLoader.js': 'three/src/loaders/BufferGeometryLoader.js',
      'three/addons/loaders/STLLoader.js': 'three/examples/jsm/loaders/STLLoader.js'
    };

    return config;
  }
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV !== 'production',
  register: true,
  skipWaiting: true,
  runtimeCaching
})(nextConfig);
