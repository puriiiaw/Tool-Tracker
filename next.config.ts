import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // The ON!Track export is about 2 MB.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
