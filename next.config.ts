import nodePath from "path";
import type { NextConfig } from "next";

/**
 * Production-oriented Next.js config.
 * - `output: "standalone"` — Docker / self-hosted / compatible with Vercel.
 * - Landing marketing page is `src/app/page.tsx` at `/` (no `/landing` route).
 *   Only add `source: "/", destination: "/landing"` after you create `app/landing/page.tsx`.
 */
const hrNextConfig: NextConfig = {
  /** Evită confuzia când există un alt package-lock în folderul părinte */
  outputFileTracingRoot: nodePath.join(__dirname),

  output: "standalone",

  poweredByHeader: false,
  reactStrictMode: true,

  experimental: {
    // Example: enable only if you rely on a flag still under experimental in your Next version.
    // serverActions: { allowedOrigins: ["https://your-domain.com"] },
  },

  async rewrites() {
    return [
      { source: "/api/timesheets", destination: "/api/attendance" },
      {
        source: "/api/timesheets/:path*",
        destination: "/api/attendance/:path*",
      },
      { source: "/api/payslips", destination: "/api/payroll" },
      { source: "/api/payslips/:path*", destination: "/api/payroll/:path*" },
      { source: "/api/companies", destination: "/api/organization/companies" },
      { source: "/api/countries", destination: "/api/organization/countries" },
      {
        source: "/api/fluturasi/send-email",
        destination: "/api/payroll/send-email",
      },
    ];
  },

  async redirects() {
    return [
      // {
      //   source: "/",
      //   destination: "/landing",
      //   permanent: false,
      // },
      {
        source: "/panou-de-control",
        destination: "/dashboard",
        permanent: true,
      },
      { source: "/angajati", destination: "/employees", permanent: true },
      {
        source: "/angajati/nou",
        destination: "/employees/new",
        permanent: true,
      },
      {
        source: "/angajati/:path*",
        destination: "/employees/:path*",
        permanent: true,
      },
      { source: "/documente", destination: "/documents", permanent: true },
      {
        source: "/documente/:path*",
        destination: "/documents/:path*",
        permanent: true,
      },
      { source: "/detasari", destination: "/deployments", permanent: true },
      {
        source: "/detasari/:path*",
        destination: "/deployments/:path*",
        permanent: true,
      },
      { source: "/importuri", destination: "/imports", permanent: true },
      {
        source: "/importuri/:path*",
        destination: "/imports/:path*",
        permanent: true,
      },
      {
        source: "/importuri-in-asteptare",
        destination: "/imports/pending",
        permanent: true,
      },
      {
        source: "/importuri-in-asteptare/:path*",
        destination: "/imports/pending/:path*",
        permanent: true,
      },
      {
        source: "/import/manual",
        destination: "/imports/manual",
        permanent: true,
      },
      {
        source: "/import/email",
        destination: "/imports/email",
        permanent: true,
      },
      { source: "/rapoarte", destination: "/reports", permanent: true },
      {
        source: "/rapoarte/:path*",
        destination: "/reports/:path*",
        permanent: true,
      },
      { source: "/plata", destination: "/pay", permanent: true },
      { source: "/plata/:path*", destination: "/pay/:path*", permanent: true },
      { source: "/pontaj", destination: "/attendance", permanent: true },
      {
        source: "/pontaj/:path*",
        destination: "/attendance/:path*",
        permanent: true,
      },
      { source: "/fluturasi", destination: "/payroll", permanent: true },
      {
        source: "/fluturasi/:path*",
        destination: "/payroll/:path*",
        permanent: true,
      },
      { source: "/setari", destination: "/settings", permanent: true },
      {
        source: "/setari/:path*",
        destination: "/settings/:path*",
        permanent: true,
      },
      { source: "/utilizatori", destination: "/users", permanent: true },
      {
        source: "/utilizatori/:path*",
        destination: "/users/:path*",
        permanent: true,
      },
      { source: "/firme", destination: "/settings/companies", permanent: true },
      { source: "/tari", destination: "/settings/countries", permanent: true },
      {
        source: "/configurari/email",
        destination: "/settings/email",
        permanent: true,
      },
    ];
  },

  /** pdf-parse încearcă să încarce fișiere de test la bundling — rămâne modul Node nativ */
  serverExternalPackages: [
    "pdf-parse",
    "ws",
    "@neondatabase/serverless",
    "@prisma/adapter-neon",
  ],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  images: {
    formats: ["image/avif", "image/webp"],
    /** Prefer `remotePatterns` over deprecated `domains` (Next 14+). */
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "", pathname: "/**" },
      { protocol: "https", hostname: "localhost", port: "", pathname: "/**" },
      // { protocol: "https", hostname: "cdn.example.com", pathname: "/**" },
    ],
  },
};

export default hrNextConfig;
