import nodePath from "path";
import type { NextConfig } from "next";

const hrNextConfig: NextConfig = {
  /** Evită confuzia când există un alt package-lock în folderul părinte */
  outputFileTracingRoot: nodePath.join(__dirname),
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  /** pdf-parse încearcă să încarce fișiere de test la bundling — rămâne modul Node nativ */
  serverExternalPackages: ["pdf-parse"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
};

export default hrNextConfig;
