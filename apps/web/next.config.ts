import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@healthquest/db"],
};

export default nextConfig;
