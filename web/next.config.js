const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Use zustand shim so the deprecated default export is never used (no console warning).
    config.resolve.alias['zustand'] = path.resolve(__dirname, 'src/lib/zustand-shim.ts');
    config.resolve.alias['zustand-original'] = path.resolve(__dirname, 'node_modules/zustand/esm/index.mjs');
    return config;
  },
};

module.exports = nextConfig;
