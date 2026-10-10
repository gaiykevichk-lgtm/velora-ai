import type { NextConfig } from 'next';
const nextConfig: NextConfig = { serverExternalPackages: ['pg'], images: { remotePatterns: [{ protocol: 'https', hostname: 'storage.yandexcloud.net', pathname: '/promto-user-static-sites-prod/design-assets/**' }] }, distDir: process.env.VELORA_DIST_DIR || '.next' };
export default nextConfig;
