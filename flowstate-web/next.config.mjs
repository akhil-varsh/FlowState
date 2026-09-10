/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone output keeps the production Docker/host image small.
  output: "standalone",
  eslint: {
    // CI runs `next lint` as its own step; don't fail the build on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
