/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: [process.env.SHOPIFY_APP_URL || 'http://localhost:3000']
    }
  }
};

module.exports = nextConfig;
