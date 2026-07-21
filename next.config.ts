import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@kubernetes/client-node", "sharp"],
};

export default nextConfig;
