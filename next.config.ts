import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Ensure the bundled seed SQLite database (read by src/lib/db.ts on
  // Vercel, where the filesystem is otherwise read-only) is traced into
  // the serverless function output — it's only referenced via a runtime
  // fs.copyFileSync path string, which static tracing can miss.
  outputFileTracingIncludes: {
    "/api/**/*": ["./prisma/seed.db"],
  },
};

export default nextConfig;
