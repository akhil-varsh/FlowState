/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // FlowState is a local tool — no external image domains, no telemetry.
  images: { unoptimized: true },
};

export default nextConfig;
