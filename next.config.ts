const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Evită confuzia când există un alt package-lock în folderul părinte */
  outputFileTracingRoot: path.join(__dirname),
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

module.exports = nextConfig;
