import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "content.fantacalcio.it" }],
  },
};

export default config;
