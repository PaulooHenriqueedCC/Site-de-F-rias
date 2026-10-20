/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ["pdf-parse", "bcryptjs"] },
};
export default nextConfig;
