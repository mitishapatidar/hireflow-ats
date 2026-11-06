/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@hireflow/ui', '@hireflow/shared'],
  experimental: {
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
};

export default nextConfig;
