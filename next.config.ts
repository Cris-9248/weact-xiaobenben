import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone — a minimal server bundle for the Docker runtime stage.
  // public/ and .next/static are NOT copied into it; the Dockerfile does that.
  output: "standalone",
};

export default nextConfig;
