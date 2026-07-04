import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@huggingface/transformers'] /* config options here */,
};

export default nextConfig;
