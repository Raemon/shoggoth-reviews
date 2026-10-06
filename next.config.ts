import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  turbopack: { root: process.cwd() },
  async redirects() {
    return [{ source: '/:owner/:repo/tree/:name+', destination: '/:owner/:repo/branch/:name+', permanent: false }];
  },
};

export default nextConfig;
