import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium-min", "playwright-core"],
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    // Allow asset uploads up to 8MB (uploadAsset.ts); 12MB gives FormData overhead headroom
    serverActions: {
      bodySizeLimit: "12mb",
    },
    // When proxy runs, request body is buffered; must allow same size as serverActions
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
