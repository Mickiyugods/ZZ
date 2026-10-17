import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a production build run alongside `next dev` without sharing (and
  // corrupting) its .next folder: NEXT_DIST_DIR=.next-verify next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  devIndicators: false,
  // @privy-io/react-auth pulls in @headlessui/react -> @react-aria/*, whose
  // package.json "exports" maps webpack's default resolver trips on (works
  // fine under Node's own resolver — this forces Next's own loader/resolution
  // path for them instead).
  transpilePackages: ["@headlessui/react", "@react-aria/interactions", "@react-aria/focus", "react-aria"],
};

export default nextConfig;
