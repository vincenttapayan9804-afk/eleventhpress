import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // PDFKit reads its .afm font-metric files from disk at runtime — keep it
  // out of the webpack bundle so those assets are traced and shipped as-is.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
