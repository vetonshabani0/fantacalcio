import type { NextConfig } from "next";

/**
 * The static build (GitHub Pages) drops every server route and ships only the
 * live board, which reads the public feed straight from the browser. The normal
 * build keeps the API routes, the SSE poller and the authenticated league
 * features, none of which can exist on static hosting.
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.STATIC_BASE_PATH ?? "";

const config: NextConfig = isStatic
  ? {
      output: "export",
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default config;
