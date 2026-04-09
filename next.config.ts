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
    // uploadAsset allows 20MB per file; multipart FormData needs headroom above raw file size
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // When proxy runs, request body is buffered; must allow same size as serverActions
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
