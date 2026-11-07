/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@hireflow/ui', '@hireflow/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@node-rs/argon2', 'pdf-parse', 'mammoth'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        child_process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
