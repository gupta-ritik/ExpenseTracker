/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@neon/config",
    "@neon/env",
    "pg",
    "imapflow",
    "mailparser",
    "unpdf",
  ],
  // PDF statements are posted to server actions. Vercel itself caps bodies at 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
