/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', '@anthropic-ai/sdk'],
  },
};

module.exports = nextConfig;
